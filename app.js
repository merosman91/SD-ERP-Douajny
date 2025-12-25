// --- 1. CONFIG & STATE ---
const App = {
    state: {
        config: { pin: '1234', laborRate: 0.5, elecRate: 30, chickPrice: 3.5 },
        marketPrice: 15 // Selling price per kg
    },

    init: async function() {
        try {
            await DB.init();
            // Load config or create default
            const savedConfig = localStorage.getItem('poultry_config');
            if(savedConfig) this.state.config = JSON.parse(savedConfig);
            
            // Check if current cycle exists, if not show setup
            const cycles = await DB.getAll('current_cycle');
            if(cycles.length === 0) {
                setTimeout(() => {
                    document.getElementById('splashScreen').style.opacity = '0';
                    setTimeout(() => {
                        document.getElementById('splashScreen').style.display = 'none';
                        this.router('newCycle');
                    }, 500);
                }, 2000);
            } else {
                setTimeout(() => {
                    document.getElementById('splashScreen').style.opacity = '0';
                    setTimeout(() => {
                        document.getElementById('splashScreen').style.display = 'none';
                        this.startApp(cycles[0]); // Load first cycle as active
                    }, 500);
                }, 2000);
            }
        } catch(e) { console.error("DB Init Failed", e); alert("فشل في تحميل قاعدة البيانات"); }
    },

    startApp: function(cycle) {
        this.state.currentCycle = cycle;
        document.getElementById('appContainer').classList.remove('hidden');
        document.getElementById('headerCycle').innerText = cycle.name;
        this.router('dashboard');
    },

    // --- 2. ROUTER ---
    router: async function(screenId, params = {}) {
        const container = document.getElementById('mainContent');
        const header = document.getElementById('headerTitle');
        const back = document.getElementById('backBtn');
        const mainNav = document.getElementById('mainNav');

        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        const isRoot = ['dashboard', 'production', 'inventory', 'finance', 'health', 'settings', 'reports'].includes(screenId);
        
        if (isRoot) {
            mainNav.classList.remove('hidden'); back.classList.add('hidden');
            this.updateNavActive(screenId);
        } else {
            mainNav.classList.add('hidden'); back.classList.remove('hidden');
        }

        switch(screenId) {
            case 'dashboard': await Views.renderDashboard(container, header); break;
            case 'production': await Views.renderProduction(container, header); break;
            case 'inventory': await Views.renderInventory(container, header); break;
            case 'finance': await Views.renderFinance(container, header); break;
            case 'health': await Views.renderHealth(container, header); break;
            case 'reports': await Views.renderReports(container, header); break;
            case 'settings': await Views.renderSettings(container, header); break;
            case 'newCycle': await Views.renderNewCycle(container, header); break;
            default: container.innerHTML = 'جاري العمل...';
        }
    },

    updateNavActive: function(target) {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('text-primary'); btn.classList.add('text-slate-400');
            if(btn.dataset.target === target) { btn.classList.add('text-primary'); btn.classList.remove('text-slate-400'); }
        });
    },

    goBack: function() { this.router('dashboard'); },
    closeModal: function(id) { document.getElementById(id).classList.add('hidden'); },

    // --- 3. LOGIC: CALCULATIONS ---
    calculateDashboardKPIs: async function() {
        const c = this.state.currentCycle;
        if(!c) return null;
        
        // Date Logic
        const today = new Date();
        const start = new Date(c.startDate);
        const ageDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));

        // Get Logs
        const logs = await DB.getAllByIndex('daily_logs', 'cycleId', c.id);
        
        const totalMortality = logs.reduce((a, l) => a + (parseInt(l.mortality) || 0), 0);
        const totalFeedKg = logs.reduce((a, l) => a + (parseFloat(l.feedKg) || 0), 0);
        const totalWaterL = logs.reduce((a, l) => a + (parseFloat(l.waterL) || 0), 0);
        
        // Current Weight (Latest log or initial)
        let currentWeightG = c.startWeight;
        if(logs.length > 0) {
            // Get last log with weight
            const wLogs = logs.filter(l => l.weight).sort((a,b) => b.id - a.id);
            if(wLogs.length > 0) currentWeightG = wLogs[0].weight;
        }
        const totalWeightKg = (c.initialCount - totalMortality) * (currentWeightG / 1000);

        // FCR
        const fcr = totalWeightKg ? (totalFeedKg / totalWeightKg).toFixed(2) : 0;

        // Mortality Rate
        const mortRate = ((totalMortality / c.initialCount) * 100).toFixed(1);

        // Costs
        // Fixed
        const chickCost = c.initialCount * c.chickPrice;
        const medCost = (c.medsCost || 0); // From cycle settings or inventory
        // Variable
        const daysActive = ageDays; // Logs might not cover all days yet
        const laborCost = daysActive * (c.laborRate || this.state.config.laborRate) * c.initialCount;
        const elecCost = daysActive * (c.elecRate || this.state.config.elecRate);
        
        // Feed Cost (Estimate based on logs)
        const feedCost = totalFeedKg * 2; // Avg price
        
        const totalCost = chickCost + medCost + laborCost + elecCost + feedCost;

        return {
            ageDays, totalMortality, mortRate, totalFeedKg, fcr, currentWeightG, totalWeightKg, totalCost
        };
    },

    calculateFinance: async function() {
        const c = this.state.currentCycle;
        const kpi = await this.calculateDashboardKPIs();
        
        // Income Forecast
        const finalWeightTarget = c.targetWeight || 2500; // grams
        const finalWeightKg = finalWeightTarget / 1000;
        const projectedBirds = c.initialCount - kpi.totalMortality;
        const projectedIncome = projectedBirds * finalWeightKg * this.state.marketPrice;
        const projectedProfit = projectedIncome - (kpi.totalCost + (c.targetDays - kpi.ageDays) * (c.laborRate*c.initialCount)); // Very rough projection

        return { ...kpi, projectedIncome, projectedProfit };
    }
};

// --- 4. VIEWS (UI) ---
const Views = {
    // DASHBOARD
    renderDashboard: async function(c, h) {
        h.innerText = 'لوحة التحكم';
        const kpi = await App.calculateDashboardKPIs();
        const inv = await DB.getAll('inventory');
        const lowStock = inv.filter(i => i.qty <= i.minStock);
        const vaccines = await DB.getAllByIndex('health_records', 'type', 'vaccine');
        
        // Alerts
        let alertsHtml = '';
        if(lowStock.length > 0) alertsHtml += `<div class="bg-red-900/20 border border-red-800 p-2 rounded text-red-200 text-xs mb-2"><i class="fa-solid fa-triangle-exclamation"></i> تنبيه: نقص في المخزون (${lowStock.length} أصناف)</div>`;
        
        // Vaccine Alert (Simple Logic: check if any vaccine is scheduled soon - simplified here)
        if(vaccines.length > 0 && kpi.ageDays > 5 && vaccines.length < 2) {
             alertsHtml += `<div class="bg-yellow-900/20 border border-yellow-800 p-2 rounded text-yellow-200 text-xs mb-2"><i class="fa-solid fa-syringe"></i> تنبيه: موعد تلقيح قادم</div>`;
        }

        c.innerHTML = `
            <div class="screen active space-y-4">
                <!-- Summary Header -->
                <div class="bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 p-4 rounded-xl shadow-lg">
                    <div class="flex justify-between items-end">
                        <div>
                            <p class="text-xs text-gray-400">يوم الدورة</p>
                            <h2 class="text-3xl font-bold text-white">${kpi.ageDays} / ${kpi.totalDays || '-'}</h2>
                        </div>
                        <div class="text-left">
                            <p class="text-xs text-gray-400">طيور حية</p>
                            <h2 class="text-3xl font-bold text-white">${(App.state.currentCycle.initialCount - kpi.totalMortality).toLocaleString()}</h2>
                        </div>
                    </div>
                </div>

                ${alertsHtml}

                <!-- KPI Grid -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="card p-4 flex justify-between items-center">
                        <div><p class="text-xs text-gray-400">متوسط الوزن</p><h3 class="text-xl font-bold text-white">${(kpi.currentWeightG/1000).toFixed(2)} كجم</h3></div>
                        <i class="fa-solid fa-scale-balanced text-gray-500 text-xl"></i>
                    </div>
                    <div class="card p-4 flex justify-between items-center">
                        <div><p class="text-xs text-gray-400">معدل النفوق</p><h3 class="text-xl font-bold ${kpi.mortRate < 2 ? 'text-green-500' : 'text-red-500'}">${kpi.mortRate}%</h3></div>
                        <i class="fa-solid fa-skull text-gray-500 text-xl"></i>
                    </div>
                    <div class="card p-4 flex justify-between items-center">
                        <div><p class="text-xs text-gray-400">FCR (الحالي)</p><h3 class="text-xl font-bold text-white">${kpi.fcr}</h3></div>
                        <i class="fa-solid fa-chart-pie text-gray-500 text-xl"></i>
                    </div>
                    <div class="card p-4 flex justify-between items-center">
                        <div><p class="text-xs text-gray-400">التكلفة التراكمية</p><h3 class="text-xl font-bold text-white">${kpi.totalCost.toLocaleString()} ر.س</h3></div>
                        <i class="fa-solid fa-coins text-gray-500 text-xl"></i>
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="grid grid-cols-2 gap-3">
                    <button onclick="App.router('production')" class="card p-4 text-center hover:bg-gray-700 transition">
                        <i class="fa-solid fa-pen-to-square text-primary text-2xl mb-2"></i>
                        <p class="text-white font-bold text-sm">السجل اليومي</p>
                        <p class="text-xs text-gray-500">نفوق، علف، بيئة</p>
                    </button>
                    <button onclick="App.router('finance')" class="card p-4 text-center hover:bg-gray-700 transition">
                        <i class="fa-solid fa-file-invoice-dollar text-secondary text-2xl mb-2"></i>
                        <p class="text-white font-bold text-sm">المالية</p>
                        <p class="text-xs text-gray-500">التكاليف، الربح</p>
                    </button>
                </div>
            </div>`;
    },

    // PRODUCTION (Daily Log)
    renderProduction: async function(c, h) {
        h.innerText = 'الإنتاج اليومي';
        const logs = await DB.getAllByIndex('daily_logs', 'cycleId', App.state.currentCycle.id);
        
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="card p-4">
                    <h4 class="text-white font-bold mb-4">تسجيل يوم جديد</h4>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Mortality -->
                        <div class="bg-gray-800 p-3 rounded-lg border border-gray-700">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-white font-bold text-sm">الوفيات</span>
                                <input type="number" id="logMortality" class="w-16 text-center bg-gray-900 border border-gray-700 text-white p-1 rounded text-sm" placeholder="0">
                            </div>
                            <button onclick="if(document.getElementById('logMortality').value > 0) { document.getElementById('mortalityModal').classList.remove('hidden'); } else alert('أدخل عدد الوفيات أولاً'); }" class="w-full bg-gray-700 text-xs text-gray-300 py-1 rounded hover:bg-gray-600">تحديد السبب</button>
                        </div>

                        <!-- Feed -->
                        <div class="bg-gray-800 p-3 rounded-lg border border-gray-700">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-white font-bold text-sm">العلف (كجم)</span>
                                <input type="number" id="logFeed" class="flex-1 bg-gray-900 border border-gray-700 text-white p-1 rounded text-sm" placeholder="0.0">
                            </div>
                            <div class="flex gap-2 mt-2">
                                <select id="logFeedSource" class="flex-1 bg-gray-900 border border-gray-700 text-xs rounded"><option value="">بدون خصم</option>${(await DB.getAll('inventory')).map(i=>`<option value="${i.id}">${i.name}</option>`).join('')}</select>
                                <div class="flex items-center"><input type="checkbox" id="deductStock" class="w-4 h-4 text-primary rounded"><span class="text-xs text-gray-400 mr-1">خصم</span></div>
                            </div>
                        </div>

                        <!-- Water -->
                        <div class="bg-gray-800 p-3 rounded-lg border border-gray-700">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-white font-bold text-sm">المياه (لتر)</span>
                                <input type="number" id="logWater" class="flex-1 bg-gray-900 border border-gray-700 text-white p-1 rounded text-sm" placeholder="0">
                            </div>
                            <input type="text" id="logWaterNote" class="w-full bg-gray-900 border border-gray-700 text-white p-1 rounded text-xs mt-2" placeholder="ملاحظة الجودة">
                        </div>

                        <!-- Weight -->
                        <div class="bg-gray-800 p-3 rounded-lg border border-gray-700">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-white font-bold text-sm">متوسط وزن العينة (جرام)</span>
                                <input type="number" id="logWeight" class="w-24 bg-gray-900 border border-gray-700 text-white p-1 rounded text-sm">
                            </div>
                            <p class="text-xs text-gray-500">تسجيل متوسط وزن 10 طيور كعينة</p>
                        </div>

                        <!-- Environment -->
                        <div class="bg-gray-800 p-3 rounded-lg border border-gray-700">
                             <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="text-xs text-gray-400 font-bold block mb-1">الحرارة (°C)</label>
                                    <div class="flex gap-1">
                                        <input type="number" id="logTempMin" class="w-full p-1 bg-gray-900 border border-gray-700 text-white rounded text-sm" placeholder="دنى">
                                        <input type="number" id="logTempMax" class="w-full p-1 bg-gray-900 border border-gray-700 text-white rounded text-sm" placeholder="أعلى">
                                    </div>
                                </div>
                                <div>
                                    <label class="text-xs text-gray-400 font-bold block mb-1">الرطوبة (%)</label>
                                    <input type="number" id="logHum" class="w-full p-1 bg-gray-900 border border-gray-700 text-white rounded text-sm" placeholder="60">
                                </div>
                             </div>
                        </div>
                    </div>
                    
                    <button onclick="Actions.saveDailyLog()" class="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-600 transition mt-4">حفظ السجل</button>
                </div>

                <!-- Recent Logs List -->
                <div class="space-y-2">
                    <h4 class="text-white font-bold mb-2 text-sm">سجلات الأيام الماضية</h4>
                    ${logs.slice().reverse().slice(0, 10).map(l => `
                        <div class="card p-3 border-r-4 border-gray-600">
                            <div class="flex justify-between mb-2">
                                <div>
                                    <p class="text-white font-bold text-sm">${l.date}</p>
                                    <p class="text-xs text-gray-500">عمر ${l.age} يوم</p>
                                </div>
                                <div class="flex gap-2 text-xs">
                                    <span class="bg-red-900/30 text-red-200 px-2 py-1 rounded border border-red-800"><i class="fa-solid fa-skull-cross"></i> ${l.mortality || 0}</span>
                                    <span class="bg-orange-900/30 text-orange-200 px-2 py-1 rounded border border-orange-800"><i class="fa-solid fa-wheat-awn"></i> ${l.feedKg || 0}</span>
                                    <span class="bg-blue-900/30 text-blue-200 px-2 py-1 rounded border border-blue-800"><i class="fa-solid fa-weight-hanging"></i> ${l.weight || '-'}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    },

    // INVENTORY
    renderInventory: async function(c, h) {
        h.innerText = 'المخزون';
        const items = await DB.getAll('inventory');
        c.innerHTML = `
            <div class="screen active space-y-4">
                <button onclick="Actions.addInventory()" class="card p-4 flex items-center gap-3 text-white hover:bg-gray-700">
                    <div class="bg-gray-700 p-2 rounded-lg"><i class="fa-solid fa-plus text-xl"></i></div>
                    <div class="text-right"><h3 class="font-bold">إضافة صنف جديد</h3><p class="text-xs text-gray-500">أدوية، علف، أدوات</p></div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${items.map(item => {
                        const isLow = item.qty <= item.minStock;
                        const isExpired = item.expiry && new Date(item.expiry) < new Date();
                        return `
                        <div class="card p-4 border-r-4 ${isLow ? 'border-red-500' : 'border-primary'} relative">
                            ${isExpired ? '<div class="absolute top-0 right-0 bg-red-500 text-white text-[10px] px-2 py-1 font-bold">منتهي الصلاحية</div>' : ''}
                            <div class="flex justify-between items-start mb-2">
                                <div><h4 class="text-white font-bold text-lg">${item.name}</h4><p class="text-xs text-gray-500">الوحدة: ${item.unit}</p></div>
                                <div class="flex items-center gap-2">
                                    <button onclick="Actions.adjustInv(${item.id}, 1)" class="w-8 h-8 rounded bg-gray-700 text-white hover:bg-gray-600"><i class="fa-solid fa-plus"></i></button>
                                    <button onclick="Actions.adjustInv(${item.id}, -1)" class="w-8 h-8 rounded bg-gray-700 text-white hover:bg-gray-600"><i class="fa-solid fa-minus"></i></button>
                                </div>
                            </div>
                            <div class="text-center mt-2">
                                <span class="text-2xl font-black ${isLow ? 'text-red-500' : 'text-primary'}">${item.qty}</span>
                                ${isLow ? '<p class="text-xs text-red-500 font-bold">! منخفض</p>' : ''}
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
    },

    // FINANCE
    renderFinance: async function(c, h) {
        h.innerText = 'الحسابات المالية';
        const fin = await App.calculateFinance();
        const txs = await DB.getAll('financial');

        c.innerHTML = `
            <div class="screen active space-y-4">
                <!-- Overview Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="card p-4">
                        <p class="text-xs text-gray-400">التكلفة حتى الآن</p>
                        <h3 class="text-2xl font-bold text-white">${fin.totalCost.toLocaleString()} ر.س</h3>
                    </div>
                    <div class="card p-4">
                        <p class="text-xs text-gray-400">توقعات الربح</p>
                        <h3 class="text-2xl font-bold text-green-500">${fin.projectedProfit.toLocaleString()} ر.س</h3>
                    </div>
                </div>

                <!-- Cost Breakdown -->
                <div class="card p-4">
                    <h4 class="text-white font-bold mb-3 text-sm border-b border-gray-700 pb-2">تفاصيل التكاليفة</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between text-sm"><span class="text-gray-400">تكلفة الكتاكيت</span><span class="text-white font-bold">${fin.chickCost.toLocaleString()}</span></div>
                        <div class="flex justify-between text-sm"><span class="text-gray-400">الأعلاف المستهلكة</span><span class="text-white font-bold">${fin.feedCost.toLocaleString()}</span></div>
                        <div class="flex justify-between text-sm"><span class="text-gray-400">الأدوية واللقاحات</span><span class="text-white font-bold">${(fin.medsCost||0).toLocaleString()}</span></div>
                        <div class="flex justify-between text-sm"><span class="text-gray-400">الأيدي العاملة (عمالة، كهرباء)</span><span class="text-white font-bold">${(fin.laborCost + fin.elecCost).toLocaleString()}</span></div>
                    </div>
                </div>

                <!-- Transaction Log -->
                <div class="card p-4">
                     <h4 class="text-white font-bold mb-3 text-sm border-b border-gray-700 pb-2">سجل المعاملات (دخل/مصروف)</h4>
                     ${txs.slice().reverse().map(t => `<div class="flex justify-between items-center py-2 border-b border-gray-800 last:border-0"><div><p class="text-white font-bold text-sm">${t.desc}</p><p class="text-xs text-gray-500">${t.date}</p></div><span class="font-bold ${t.type==='income'?'text-green-500':'text-red-500'}">${t.amount}</span></div>`).join('')}
                </div>
            </div>`;
    },

    // HEALTH
    renderHealth: async function(c, h) {
        h.innerText = 'السجل الصحي';
        const logs = await DB.getAllByIndex('health_records', 'cycleId', App.state.currentCycle.id);
        const mortLogs = await DB.getAllByIndex('daily_logs', 'cycleId', App.state.currentCycle.id);
        
        // Mortality Cause Analysis
        const causes = {};
        mortLogs.forEach(l => { if(l.mortalityCause) { causes[l.mortalityCause] = (causes[l.mortalityCause] || 0) + l.mortality; } });

        c.innerHTML = `
            <div class="screen active space-y-4">
                <!-- Vaccination Status -->
                <div class="card p-4 border border-green-900/50">
                    <h4 class="text-white font-bold mb-2 text-sm">جدول التحصين</h4>
                    <div class="flex gap-2 overflow-x-auto pb-2">
                        <div class="min-w-[100px] bg-gray-800 p-2 rounded border border-gray-700 text-center">
                            <p class="text-xs text-gray-400">يوم 1</p>
                            <i class="fa-solid fa-check text-green-500"></i>
                        </div>
                        <div class="min-w-[100px] bg-gray-800 p-2 rounded border border-gray-700 text-center">
                            <p class="text-xs text-gray-400">يوم 7</p>
                            <i class="fa-solid fa-check text-green-500"></i>
                        </div>
                        <div class="min-w-[100px] bg-gray-800 p-2 rounded border border-yellow-700 text-center">
                            <p class="text-xs text-yellow-500">يوم 14</p>
                            <span class="text-xs">قادم</span>
                        </div>
                    </div>
                </div>

                <!-- Add Record -->
                <div class="card p-4">
                    <h4 class="text-white font-bold mb-3 text-sm">تسجيل جديد</h4>
                    <div class="grid grid-cols-2 gap-3 mb-3">
                        <select id="healthType" class="w-full p-2 bg-gray-900 border border-gray-700 text-white rounded"><option value="vaccine">لقاح</option><option value="medicine">علاج</option></select>
                        <input type="text" id="healthName" class="w-full p-2 bg-gray-900 border border-gray-700 text-white rounded" placeholder="الاسم">
                        <input type="date" id="healthDate" class="w-full p-2 bg-gray-900 border border-gray-700 text-white rounded">
                    </div>
                    <textarea id="healthDesc" class="w-full p-2 bg-gray-900 border border-gray-700 text-white rounded mb-3 text-sm" placeholder="الأعراض، الجرعة، النتيجة"></textarea>
                    <button onclick="Actions.addHealth()" class="w-full bg-green-600 text-white py-2 rounded-lg font-bold">حفظ</button>
                </div>

                <!-- Cause Analysis Chart -->
                <div class="card p-4">
                    <h4 class="text-white font-bold mb-2 text-sm">توزيع أسباب النفوق</h4>
                    <div class="h-40">
                        <canvas id="mortalityChart"></canvas>
                    </div>
                </div>
            </div>`;
        // Render Chart
        setTimeout(() => {
            const ctx = document.getElementById('mortalityChart');
            if(ctx) new Chart(ctx, { type: 'bar', data: { labels: Object.keys(causes), datasets: [{ label: 'عدد النفوق', data: Object.values(causes), backgroundColor: '#ef4444' }] }, options: { responsive: true, scales: { y: { beginAtZero: true } } } });
        }, 100);
    },

    // REPORTS
    renderReports: async function(c, h) {
        h.innerText = 'التقارير';
        const kpi = await App.calculateFinance();
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="card p-6 text-center">
                    <h2 class="text-3xl font-bold text-white mb-2">تقرير نهاية الدورة (محاكاة)</h2>
                    <div class="grid grid-cols-2 gap-4 mt-4">
                        <div class="bg-gray-800 p-3 rounded"><p class="text-xs text-gray-400">معدل النفوق</p><h3 class="text-2xl font-bold text-red-500">${kpi.mortRate}%</h3></div>
                        <div class="bg-gray-800 p-3 rounded"><p class="text-xs text-gray-400">FCR النهائي</p><h3 class="text-2xl font-bold text-primary">${kpi.fcr}</h3></div>
                    </div>
                    <p class="text-gray-400 text-sm mt-4">انقر هنا لتحميل التقرير الكامل</p>
                </div>
                <button onclick="Actions.exportReport()" class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><i class="fa-solid fa-file-pdf"></i> تصدير PDF</button>
            </div>`;
    },

    // SETTINGS
    renderSettings: async function(c, h) {
        h.innerText = 'الإعدادات';
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="card p-4">
                    <h4 class="text-white font-bold mb-4">إعدادات المزرعة</h4>
                    <div class="space-y-3">
                        <input type="text" id="setFarm" class="w-full p-2 bg-gray-900 border border-gray-700 text-white rounded" placeholder="اسم المزرعة">
                        <div class="flex gap-3">
                            <input type="number" id="setTargetDays" class="w-full p-2 bg-gray-900 border border-gray-700 text-white rounded" placeholder="أيام التسمين المستهدف (45)">
                            <input type="number" id="setTargetWeight" class="w-full p-2 bg-gray-900 border border-gray-700 text-white rounded" placeholder="الوزن المستهدف (جرام)">
                        </div>
                        <button onclick="Actions.saveSettings()" class="w-full bg-primary text-white py-2 rounded font-bold">حفظ</button>
                    </div>
                </div>`;
    },

    // NEW CYCLE SETUP
    renderNewCycle: async function(c, h) {
        h.innerText = 'إعداد دورة جديدة';
        c.innerHTML = `
            <div class="screen active flex flex-col items-center justify-center h-full p-6">
                <div class="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-white mb-4 animate-bounce">
                    <i class="fa-solid fa-feather-pointed text-3xl"></i>
                </div>
                <h2 class="text-2xl font-bold text-white mb-2">ابدأ دورة جديدة</h2>
                <div class="w-full max-w-sm space-y-4 mt-8">
                    <input type="text" id="cycleName" class="w-full p-3 bg-gray-800 border border-gray-600 rounded text-white" placeholder="اسم الدورة (مثال: يناير 2024)">
                    <input type="number" id="cycleCount" class="w-full p-3 bg-gray-800 border border-gray-600 rounded text-white" placeholder="عدد الكتاكيت">
                    <input type="number" id="cyclePrice" class="w-full p-3 bg-gray-800 border border-gray-600 rounded text-white" placeholder="سعر الكتكيتة">
                    <input type="date" id="cycleStart" class="w-full p-3 bg-gray-800 border border-gray-600 rounded text-white">
                    <input type="number" id="cycleMeds" class="w-full p-3 bg-gray-800 border border-gray-600 rounded text-white" placeholder="تكلفة التحصين المبدئية">
                    <button onclick="Actions.startNewCycle()" class="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg">بدء الدورة</button>
                </div>
            </div>`;
    }
};

// --- 5. ACTIONS (LOGIC) ---
const Actions = {
    saveDailyLog: async function() {
        const cycleId = App.state.currentCycle.id;
        const cycle = await DB.get('current_cycle', cycleId);
        
        const mortality = parseInt(document.getElementById('logMortality').value) || 0;
        const feed = parseFloat(document.getElementById('logFeed').value) || 0;
        const water = parseFloat(document.getElementById('logWater').value) || 0;
        const weight = parseInt(document.getElementById('logWeight').value) || 0;
        
        // Environment (Min, Max, Avg)
        const tMin = parseFloat(document.getElementById('logTempMin').value) || 0;
        const tMax = parseFloat(document.getElementById('logTempMax').value) || 0;
        const hum = parseFloat(document.getElementById('logHum').value) || 0;
        const temp = tMax > 0 ? (tMin + tMax) / 2 : tMin; // Simple avg

        const age = Math.floor((new Date() - new Date(cycle.startDate)) / (1000 * 60 * 60 * 24));

        // Logic: Deduct Inventory
        const srcId = document.getElementById('logFeedSource').value;
        const deduct = document.getElementById('deductStock').checked;
        if(deduct && srcId) {
            const item = await DB.get('inventory', parseInt(srcId));
            if(item && item.qty < feed) return alert('الكمية في المخزون لا تكفي!');
            item.qty -= feed;
            await DB.update('inventory', item);
        }

        // Save Log
        await DB.add('daily_logs', {
            cycleId, age,
            mortality, mortalityCause: null, // Set later
            feedKg: feed, waterL: water,
            weight, temp, humidity: hum,
            date: new Date().toLocaleDateString()
        });

        // Update Cycle
        cycle.count -= mortality;
        if(weight > 0) cycle.weight = weight; // Update current weight
        await DB.update('current_cycle', cycle);

        App.router('production');
    },

    saveMortality: async function(cause) {
        const logs = await DB.getAllByIndex('daily_logs', 'cycleId', App.state.currentCycle.id);
        // Find last log with mortality
        const lastLog = logs.slice().reverse().find(l => l.mortality > 0);
        if(lastLog) {
            lastLog.mortalityCause = cause;
            await DB.update('daily_logs', lastLog);
        }
        App.closeModal('mortalityModal');
        App.router('production'); // Refresh to show cause maybe
    },

    addInventory: async function() {
        const name = prompt("اسم الصنف:");
        const unit = prompt("الوحدة:");
        if(name) { await DB.add('inventory', { name, unit, qty: 0, minStock: 10 }); App.router('inventory'); }
    },

    adjustInv: async function(id, delta) {
        const item = await DB.get('inventory', id);
        item.qty += delta;
        await DB.update('inventory', item);
        App.router('inventory');
    },

    addHealth: async function() {
        const type = document.getElementById('healthType').value;
        const name = document.getElementById('healthName').value;
        const desc = document.getElementById('healthDesc').value;
        const date = document.getElementById('healthDate').value;
        if(name && date) {
            await DB.add('health_records', { cycleId: App.state.currentCycle.id, type, name, desc, date });
            App.router('health');
        }
    },

    saveSettings: async function() {
        const name = document.getElementById('setFarm').value;
        const days = parseInt(document.getElementById('setTargetDays').value);
        const weight = parseInt(document.getElementById('setTargetWeight').value);
        if(name && days && weight) {
            localStorage.setItem('poultry_config', JSON.stringify({ farmName: name, targetDays: days, targetWeight: weight }));
            alert('تم حفظ الإعدادات');
        }
    },

    startNewCycle: async function() {
        const name = document.getElementById('cycleName').value;
        const count = parseInt(document.getElementById('cycleCount').value);
        const price = parseFloat(document.getElementById('cyclePrice').value);
        const start = document.getElementById('cycleStart').value;
        const meds = parseFloat(document.getElementById('cycleMeds').value) || 0;
        
        if(name && count && start) {
            await DB.add('current_cycle', {
                name, initialCount: count, count, chickPrice: price,
                startDate: start, targetDays: 45, targetWeight: 2500,
                medsCost: meds, status: 'active', weight: 0,
                laborRate: 0.5, elecRate: 30
            });
            App.startApp({ id: 1, ...arguments });
        }
    },

    exportReport: async function() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("تقرير نهاية الدورة", 14, 14);
        doc.save("Report.pdf");
    }
};

// --- 6. BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => { App.init(); });
