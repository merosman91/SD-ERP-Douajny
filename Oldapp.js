// --- 1. APP CONFIG & STATE ---
const App = {
    state: {
        currentFlockId: null,
        config: { pin: '1234', currency: 'SAR', laborPerBird: 1.5, elecPerDay: 50, rentPerDay: 100 },
        standardCurves: {
            'Ross 308': [40, 80, 130, 190, 250, 320, 400, 480, 560, 640, 720, 810, 900, 990, 1080, 1170, 1260, 1350, 1440, 1530, 1620, 1710, 1800, 1890, 1980, 2070, 2160, 2250, 2340, 2430, 2520, 2610, 2700, 2790, 2880, 2970, 3060, 3150, 3240, 3330, 3420],
            'Cobb 500': [42, 85, 135, 200, 260, 330, 410, 490, 570, 650, 730, 820, 910, 1000, 1090, 1180, 1270, 1360, 1450, 1540, 1630, 1720, 1810, 1900, 1990, 2080, 2170, 2260, 2350, 2440, 2530, 2620, 2710, 2800, 2890, 2980, 3070, 3160, 3250, 3340, 3430]
        }
    },

    init: async function() {
        try {
            await DB.init();
            const logged = localStorage.getItem('erp_full_cycle_login');
            if(logged) {
                this.startApp();
            } else {
                setTimeout(() => {
                    document.getElementById('splashScreen').style.opacity = '0';
                    setTimeout(() => {
                        document.getElementById('splashScreen').style.display = 'none';
                        document.getElementById('loginScreen').classList.remove('hidden');
                    }, 500);
                }, 2000);
            }
        } catch(e) { console.error("DB Init Error", e); alert("خطأ في تحميل قاعدة البيانات"); }
    },

    login: function() {
        const pin = document.getElementById('pinInput').value;
        if(pin === this.state.config.pin) {
            localStorage.setItem('erp_full_cycle_login', 'true');
            document.getElementById('loginScreen').classList.add('hidden');
            this.startApp();
        } else alert('رمز خاطئ');
    },

    startApp: function() { document.getElementById('appContainer').classList.remove('hidden'); this.router('dashboard'); },

    // --- 2. ROUTER ---
    router: async function(screenId, params = {}) {
        const c = document.getElementById('mainContent');
        const h = document.getElementById('headerTitle');
        const back = document.getElementById('backBtn');
        const nav = document.getElementById('mainNav');

        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        const topLevel = ['dashboard', 'flocks', 'inventory', 'reports', 'settings'];
        const isRoot = topLevel.includes(screenId);
        
        if (isRoot) { nav.classList.remove('hidden'); back.classList.add('hidden'); this.updateNav(screenId); }
        else { nav.classList.add('hidden'); back.classList.remove('hidden'); }

        if (params.flockId) this.state.currentFlockId = params.flockId;

        switch(screenId) {
            case 'dashboard': await Views.renderDashboard(c, h); break;
            case 'flocks': await Views.renderFlocks(c, h); break;
            case 'addFlock': await Views.renderAddFlock(c, h); break;
            case 'flockDetails': await Views.renderFlockDetails(c, h); break;
            case 'dailyLog': await Views.renderDailyLog(c, h); break;
            case 'financials': await Views.renderFinancials(c, h); break;
            case 'inventory': await Views.renderInventory(c, h); break;
            case 'health': await Views.renderHealth(c, h); break;
            case 'kpi': await Views.renderKPIs(c, h); break; // Special Deep Analysis
            case 'reports': await Views.renderReports(c, h); break;
        }
    },

    updateNav: function(target) {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('text-emerald-500'); btn.classList.add('text-slate-400');
            if(btn.dataset.target === target) { btn.classList.add('text-emerald-500'); btn.classList.remove('text-slate-400'); }
        });
    },

    goBack: function() { if(this.state.currentFlockId) this.router('flockDetails', {flockId: this.state.currentFlockId}); else this.router('dashboard'); },

    // --- 3. FINANCIAL LOGIC ENGINE (The Core) ---
    calculateFlockFinancials: async function(flockId) {
        const flock = await DB.get('flocks', flockId);
        if(!flock) return null;

        // 1. Fixed Costs
        const chickCost = flock.count * flock.price;
        const daysActive = Math.floor((new Date() - new Date(flock.startDate)) / (1000 * 60 * 60 * 24));
        const laborCost = flock.count * (flock.labor || this.state.config.laborPerBird); // Total labor
        const miscCost = (daysActive * this.state.config.elecPerDay) + (daysActive * this.state.config.rentPerDay);

        // 2. Variable Costs (from Daily Logs)
        const dailyLogs = await DB.getAllByIndex('daily_logs', 'flockId', flockId);
        const totalFeedKg = dailyLogs.reduce((a, b) => a + parseFloat(b.feedKg || 0), 0);
        const totalWaterL = dailyLogs.reduce((a, b) => a + parseFloat(b.waterL || 0), 0);
        const totalMortality = dailyLogs.reduce((a, b) => a + parseInt(b.mortality || 0), 0);

        // 3. Get Inventory Costs (Feed & Meds used)
        // (Simplification: Assuming feed price ~2 SAR/kg, Meds stored cost already accounted. We just calculate value of consumed feed for ROI)
        const feedPrice = 2; 
        const feedCost = totalFeedKg * feedPrice;
        
        // 4. Health Costs
        const healthLogs = await DB.getAllByIndex('health_logs', 'flockId', flockId);
        // Filter only expenses (medicine), ignoring vaccines usually prepaid or low cost for this demo
        const medsCost = healthLogs.reduce((a, b) => a + (b.type === 'medicine' ? b.cost : 0), 0);

        const totalCost = chickCost + laborCost + miscCost + feedCost + medsCost;
        
        // 5. Revenue (Sales)
        const sales = await DB.getAll('financial'); // All sales for now
        const flockSales = sales.filter(s => s.flockId == flockId && s.type === 'income');
        const totalRevenue = flockSales.reduce((a, b) => a + b.amount, 0);

        return {
            chickCost: chickCost,
            feedCost: feedCost,
            medsCost: medsCost,
            laborCost: laborCost,
            miscCost: miscCost,
            totalCost: totalCost,
            totalRevenue: totalRevenue,
            profit: totalRevenue - totalCost,
            totalFeedKg: totalFeedKg,
            totalWaterL: totalWaterL,
            totalMortality: totalMortality
        };
    },

    calculateKPIs: async function(flockId) {
        const fin = await this.calculateFlockFinancials(flockId);
        const flock = await DB.get('flocks', flockId);
        const dailyLogs = await DB.getAllByIndex('daily_logs', 'flockId', flockId);
        
        if(!flock || !fin) return null;

        const currentAge = Math.floor((new Date() - new Date(flock.startDate)) / (1000 * 60 * 60 * 24));
        
        // Weight Logic
        let currentWeightGrams = flock.weight; // Default static
        // Try to get latest weight from daily logs
        const sortedLogs = dailyLogs.sort((a,b) => b.id - a.id);
        if(sortedLogs.length > 0 && sortedLogs[0].weight) {
            currentWeightGrams = sortedLogs[0].weight;
        }

        const totalWeightProducedKg = (flock.count * currentWeightGrams) / 1000;
        
        // FCR = Total Feed / Total Weight Produced
        const fcr = totalWeightProducedKg ? (fin.totalFeedKg / totalWeightProducedKg).toFixed(2) : 0;

        // Mortality Rate %
        const mortalityRate = ((fin.totalMortality) / flock.count * 100).toFixed(2);

        // Cost per Kg
        const costPerKg = totalWeightProducedKg ? (fin.totalCost / totalWeightProducedKg).toFixed(2) : 0;

        // Expected Weight
        const breedCurve = this.state.standardCurves[flock.breed] || [];
        const expected = breedCurve[currentAge - 1] || 0;

        return {
            flockName: flock.name,
            age: currentAge,
            currentWeight: (currentWeightGrams/1000).toFixed(2),
            fcr: fcr,
            mortalityRate: mortalityRate,
            costPerKg: costPerKg,
            profit: fin.profit,
            totalCost: fin.totalCost,
            totalRevenue: fin.totalRevenue,
            expectedWeight: (expected/1000).toFixed(2),
            curve: breedCurve
        };
    }
};

// --- 4. VIEWS (UI Generators) ---
const Views = {
    renderDashboard: async function(c, h) {
        h.innerText = 'لوحة التحكم';
        const flocks = await DB.getAll('flocks');
        const active = flocks.filter(f => f.status === 'active');
        
        // Calculate Dashboard KPIs (Sum of all active)
        let totalProfit = 0;
        for(const f of active) {
            const kpi = await App.calculateKPIs(f.id);
            totalProfit += (kpi ? kpi.profit : 0);
        }

        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-emerald-500">
                        <p class="text-xs text-slate-400">عدد الدورات</p>
                        <h3 class="text-2xl font-bold dark:text-white">${active.length}</h3>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-blue-500">
                        <p class="text-xs text-slate-400">صافي الربح</p>
                        <h3 class="text-2xl font-bold text-blue-600">${totalProfit.toLocaleString()}</h3>
                    </div>
                </div>
                <button onclick="App.router('addFlock')" class="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg mb-4">دورة جديدة</button>
                <h4 class="font-bold dark:text-white mb-2">الدورات النشطة</h4>
                <div class="space-y-2">
                    ${active.map(f => `<div onclick="App.router('flockDetails', {flockId: ${f.id}})" class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer">
                        <div class="flex justify-between">
                            <h3 class="font-bold dark:text-white">${f.name}</h3>
                            <span class="text-xs bg-emerald-100 text-emerald-600 px-2 py-1 rounded">نشطة</span>
                        </div>
                        <p class="text-xs text-slate-500">${f.breed} - ${f.startDate}</p>
                    </div>`).join('')}
                </div>
            </div>`;
    },

    renderFlocks: async function(c, h) {
        h.innerText = 'إدارة الدورات';
        const flocks = await DB.getAll('flocks');
        c.innerHTML = `
            <div class="screen active space-y-4">
                ${flocks.map(f => {
                    const age = Math.floor((new Date() - new Date(f.startDate)) / (1000 * 60 * 60 * 24));
                    return `
                        <div onclick="App.router('flockDetails', {flockId: ${f.id}})" class="bg-white dark:bg-darkcard p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer">
                            <div class="flex justify-between items-start mb-2">
                                <div><h3 class="font-bold text-lg dark:text-white">${f.name}</h3><p class="text-xs text-slate-500">${f.breed} • عمر ${age} يوم</p></div>
                                <span class="text-xs font-bold ${f.status === 'active' ? 'text-emerald-500' : 'text-slate-500'}">${f.status === 'active' ? 'جارية' : 'مكتملة'}</span>
                            </div>
                        </div>`;
                }).join('')}
            </div>`;
    },

    renderFlockDetails: async function(c, h, id) {
        const flock = await DB.get('flocks', id);
        if(!flock) return App.router('flocks');
        h.innerText = flock.name;

        c.innerHTML = `
            <div class="screen active space-y-6">
                <div class="bg-gradient-to-l from-emerald-500 to-teal-600 p-6 rounded-2xl text-white shadow-lg">
                    <h2 class="text-2xl font-bold mb-2">${flock.name}</h2>
                    <div class="flex gap-4 text-emerald-100 text-sm">
                        <span><i class="fa-solid fa-dove"></i> ${f.breed}</span>
                        <span><i class="fa-solid fa-calendar"></i> ${f.startDate}</span>
                        <span><i class="fa-solid fa-users"></i> ${f.count}</span>
                    </div>
                </div>

                <!-- Main Navigation Grid -->
                <div class="grid grid-cols-2 gap-4">
                    <button onclick="App.router('dailyLog')" class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm text-center hover:shadow-md transition">
                        <i class="fa-solid fa-clipboard-list text-2xl mb-2 text-orange-500"></i>
                        <p class="font-bold dark:text-white">السجل اليومي</p>
                        <p class="text-xs text-slate-400">نفوق، علف، بيئة</p>
                    </button>
                    <button onclick="App.router('financials')" class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm text-center hover:shadow-md transition">
                        <i class="fa-solid fa-coins text-2xl mb-2 text-blue-500"></i>
                        <p class="font-bold dark:text-white">المالية</p>
                        <p class="text-xs text-slate-400">الدخل، المصروف، الأرباح</p>
                    </button>
                    <button onclick="App.router('kpi')" class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm text-center hover:shadow-md transition">
                        <i class="fa-solid fa-chart-line text-2xl mb-2 text-red-500"></i>
                        <p class="font-bold dark:text-white">تحليل الأداء</p>
                        <p class="text-xs text-slate-400">FCR، وزن، تكلفة</p>
                    </button>
                    <button onclick="App.router('health')" class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm text-center hover:shadow-md transition">
                        <i class="fa-solid fa-staff-snake text-2xl mb-2 text-green-500"></i>
                        <p class="font-bold dark:text-white">السجل الصحي</p>
                        <p class="text-xs text-slate-400">لقاح، علاج</p>
                    </button>
                </div>
            </div>`;
    },

    // NEW: DAILY LOG VIEW
    renderDailyLog: async function(c, h) {
        h.innerText = 'السجل اليومي';
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                    <h3 class="font-bold mb-4 dark:text-white">تسجيل اليوم</h3>
                    <p class="text-xs text-slate-400 mb-4">قم بتسجيل البيانات اليومية للحفظ على دقة المخزون وحسابات الـ FCR.</p>
                    
                    <div class="space-y-4">
                        <!-- 1. Mortality -->
                        <div class="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100">
                            <div class="flex justify-between items-center mb-2">
                                <label class="text-sm font-bold text-red-700">نفق (عدد)</label>
                                <input type="number" id="logMortality" class="w-20 p-2 border rounded dark:bg-slate-800 dark:text-white text-center" value="0">
                            </div>
                        </div>

                        <!-- 2. Weight Sampling -->
                        <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100">
                            <div class="flex justify-between items-center mb-2">
                                <label class="text-sm font-bold text-blue-700">متوسط الوزن (غرام)</label>
                                <input type="number" id="logWeight" class="w-24 p-2 border rounded dark:bg-slate-800 dark:text-white text-center" placeholder="مثلاً: 900">
                            </div>
                        </div>

                        <!-- 3. Feed & Water -->
                        <div class="grid grid-cols-2 gap-3">
                            <div class="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-100">
                                <label class="text-sm font-bold text-orange-700 mb-2">علف (كجم)</label>
                                <div class="flex items-center gap-2">
                                    <input type="number" id="logFeed" class="flex-1 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="0">
                                    <select id="feedSrc" class="p-1 border rounded text-xs dark:bg-slate-800 dark:text-white"><option value="">-</option><option value="starter">مبدئي</option><option value="finisher">نهائي</option></select>
                                </div>
                            </div>
                            <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100">
                                <label class="text-sm font-bold text-blue-700 mb-2">مياه (لتر)</label>
                                <input type="number" id="logWater" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="0">
                            </div>
                        </div>

                        <!-- 4. Environment -->
                        <div class="grid grid-cols-2 gap-3">
                            <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl border border-yellow-100">
                                <label class="text-sm font-bold text-yellow-700 mb-2">الحرارة (°C)</label>
                                <input type="number" id="logTemp" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="25">
                            </div>
                            <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl border border-gray-300">
                                <label class="text-sm font-bold text-gray-700 mb-2">الرطوبة (%)</label>
                                <input type="number" id="logHum" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="60">
                            </div>
                        </div>

                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="deductFeed" class="w-5 h-5 text-emerald-500 rounded">
                            <label class="text-sm font-bold dark:text-white">خصم من المخزون (العلف فقط)</label>
                        </div>

                        <button onclick="Actions.saveDailyLog()" class="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg mt-2">حفظ السجل اليومي</button>
                    </div>

                    <!-- Recent Logs List -->
                    <h4 class="font-bold mb-2 dark:text-white">سجلات الأيام السابقة</h4>
                    <div class="space-y-2 max-h-60 overflow-y-auto">
                        ${((await DB.getAllByIndex('daily_logs', 'flockId', App.state.currentFlockId)) || []).slice().reverse().slice(0, 5).map(l => `
                            <div class="bg-white dark:bg-darkcard p-3 rounded-lg border-r-4 ${l.mortality > 0 ? 'border-red-500' : 'border-emerald-500'}">
                                <div class="flex justify-between">
                                    <span class="font-bold text-sm dark:text-white">${l.date}</span>
                                    <span class="text-xs text-slate-400">عمر ${l.age} يوم</span>
                                </div>
                                <div class="grid grid-cols-4 gap-2 mt-2 text-center text-xs">
                                    <div><p class="text-red-500 font-bold">${l.mortality}</p><p class="text-slate-400">نفوق</p></div>
                                    <div><p class="text-orange-500 font-bold">${l.feedKg}</p><p class="text-slate-400">علف</p></div>
                                    <div><p class="text-blue-500 font-bold">${l.waterL}</p><p class="text-slate-400">ماء</p></div>
                                    <div><p class="text-emerald-500 font-bold">${l.weight}</p><p class="text-slate-400">وزن</p></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
    },

    // FINANCIALS VIEW (Detailed)
    renderFinancials: async function(c, h) {
        h.innerText = 'المالية الدقيقة';
        const fin = await App.calculateFlockFinancials(App.state.currentFlockId);
        
        c.innerHTML = `
            <div class="screen active space-y-4">
                <!-- Summary Cards -->
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-blue-500">
                        <p class="text-xs text-slate-400">إجمالي التكلفة</p>
                        <h3 class="text-xl font-bold text-blue-600 dark:text-white">${fin.totalCost.toLocaleString()}</h3>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-green-500">
                        <p class="text-xs text-slate-400">إجمالي الدخل</p>
                        <h3 class="text-xl font-bold text-green-600 dark:text-white">${fin.totalRevenue.toLocaleString()}</h3>
                    </div>
                </div>

                <!-- Breakdown Table -->
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm overflow-hidden">
                    <h4 class="font-bold mb-4 dark:text-white">تفاصيل التكلفة</h4>
                    <table class="w-full text-sm text-right">
                        <tr class="border-b dark:border-slate-700"><td class="py-2 text-slate-400">البند</td><td class="py-2 font-bold dark:text-white">المبلغ</td></tr>
                        <tr class="border-b dark:border-slate-700"><td class="py-2 dark:text-white">تكلفة الكتاكيت</td><td class="py-2 font-bold text-red-500">${fin.chickCost.toLocaleString()}</td></tr>
                        <tr class="border-b dark:border-slate-700"><td class="py-2 dark:text-white">الأعلاف المستهلك</td><td class="py-2 font-bold text-orange-500">${fin.feedCost.toLocaleString()}</td></tr>
                        <tr class="border-b dark:border-slate-700"><td class="py-2 dark:text-white">الأدوية والعلاج</td><td class="py-2 font-bold text-purple-500">${fin.medsCost.toLocaleString()}</td></tr>
                        <tr class="border-b dark:border-slate-700"><td class="py-2 dark:text-white">الأيدي العاملة (عمالة، كهرباء)</td><td class="py-2 font-bold text-slate-600">${(fin.laborCost + fin.miscCost).toLocaleString()}</td></tr>
                        <tr><td class="py-2 font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20">الإجمالي</td><td class="py-2 font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20">${fin.totalCost.toLocaleString()}</td></tr>
                    </table>
                </div>

                <!-- Add Transaction -->
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                    <h4 class="font-bold mb-4 dark:text-white">عملية مالية</h4>
                    <div class="space-y-2">
                        <div class="flex gap-2">
                            <button onclick="Actions.toggleTransType('income')" id="btnInc" class="flex-1 p-2 bg-green-100 text-green-700 rounded-lg text-sm font-bold border-2 border-green-500">دخل</button>
                            <button onclick="Actions.toggleTransType('expense')" id="btnExp" class="flex-1 p-2 text-slate-500 bg-white border-2 border-transparent rounded-lg text-sm font-bold">مصروف</button>
                        </div>
                        <input type="number" id="finAmount" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="المبلغ">
                        <input type="text" id="finDesc" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="الوصف">
                        <button onclick="Actions.addTransaction()" class="w-full bg-blue-500 text-white py-2 rounded-xl font-bold">حفظ</button>
                    </div>
                </div>
            </div>`;
    },

    renderKPIs: async function(c, h) {
        h.innerText = 'تحليل الأداء الذكي';
        const kpi = await App.calculateKPIs(App.state.currentFlockId);
        if(!kpi) return;

        c.innerHTML = `
            <div class="screen active space-y-4">
                <!-- Main KPI Cards -->
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-purple-500">
                        <p class="text-xs text-slate-400">FCR (التغذية)</p>
                        <h3 class="text-2xl font-black dark:text-white">${kpi.fcr}</h3>
                        <p class="text-xs ${kpi.fcr < 1.8 ? 'text-green-500' : 'text-red-500'}">${kpi.fcr < 1.8 ? 'ممتاز' : 'يحتاج تحسين'}</p>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-orange-500">
                        <p class="text-xs text-slate-400">معدل النفوق</p>
                        <h3 class="text-2xl font-black dark:text-white">${kpi.mortalityRate}%</h3>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-blue-500">
                        <p class="text-xs text-slate-400">تكلفة الكيلو</p>
                        <h3 class="text-2xl font-black dark:text-white">${kpi.costPerKg} $</h3>
                    </div>
                </div>

                <!-- Weight Curve Chart -->
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                    <h4 class="font-bold mb-4 dark:text-white">منحنى النمو والوزن</h4>
                    <canvas id="weightCurve" height="250"></canvas>
                </div>
            </div>`;
        
        // Chart Logic
        setTimeout(() => {
            const ctx = document.getElementById('weightCurve');
            if(ctx) {
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: kpi.curve.map((_, i) => `يوم ${i+1}`),
                        datasets: [{
                            label: 'المتوقع (السلالة)',
                            data: kpi.curve.map(g => g/1000),
                            borderColor: '#cbd5e1',
                            borderDash: [5, 5],
                            tension: 0.4
                        }, {
                            label: 'الفعلي (من السجلات)',
                            data: kpi.curve.map((_, i) => (kpi.currentWeight * 0.95).toFixed(2)), // Dummy logic for actual, should map from logs
                            borderColor: '#0f766e',
                            tension: 0.4
                        }]
                    },
                    options: { responsive: true, scales: { y: { beginAtZero: false } } }
                });
            }
        }, 100);
    },

    renderInventory: async function(c, h) {
        h.innerText = 'المخزون العام';
        const items = await DB.getAll('inventory');
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm flex justify-between items-center">
                    <h3 class="font-bold dark:text-white">المخزون</h3>
                    <button onclick="Actions.addInventory()" class="bg-primary text-white w-8 h-8 rounded-lg"><i class="fa-solid fa-plus"></i></button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${items.map(i => {
                        const isLow = i.qty <= i.minStock;
                        return `<div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-r-4 ${isLow ? 'border-red-500' : 'border-primary'} relative">
                            ${isLow ? '<div class="absolute top-0 left-0 bg-red-500 text-white text-[10px] px-2 py-1 rounded-bl">ناقص</div>' : ''}
                            <div class="flex justify-between items-start mb-2">
                                <div><h4 class="font-bold text-sm dark:text-white">${i.name}</h4><p class="text-xs text-slate-500">الوحدة: ${i.unit}</p></div>
                                <div class="flex items-center gap-2">
                                    <button onclick="Actions.adjustInv(${i.id}, 1)" class="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><i class="fa-solid fa-plus text-xs"></i></button>
                                    <button onclick="Actions.adjustInv(${i.id}, -1)" class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center"><i class="fa-solid fa-minus text-xs"></i></button>
                                </div>
                            </div>
                            <div class="text-center"><span class="text-2xl font-black ${isLow ? 'text-red-500' : 'text-slate-800 dark:text-white'}">${i.qty}</span></div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
    },

    renderHealth: async function(c, h) {
        h.innerText = 'السجل الصحي';
        const logs = await DB.getAllByIndex('health_logs', 'flockId', App.state.currentFlockId);
        
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                    <h4 class="font-bold mb-4 dark:text-white">تسجيل صحى جديد</h4>
                    <div class="space-y-2">
                        <div class="flex gap-2">
                            <button onclick="Actions.setHealthType('vaccine')" id="hBtnVac" class="flex-1 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-bold border-2 border-red-500">لقاح</button>
                            <button onclick="Actions.setHealthType('medicine')" id="hBtnMed" class="flex-1 py-2 text-slate-500 bg-white border-2 border-transparent rounded-lg text-sm font-bold">دواء</button>
                        </div>
                        <input type="text" id="hName" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="اسم اللقاح/الدواء">
                        <input type="text" id="hDesc" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="الوصف والاستعمال">
                        <button onclick="Actions.addHealth()" class="w-full bg-red-500 text-white py-2 rounded-xl font-bold">حفظ</button>
                    </div>
                </div>
                
                <div class="space-y-2">
                    ${logs.slice().reverse().map(l => `
                        <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-r-4 ${l.type === 'vaccine' ? 'border-red-500' : 'border-blue-500'}">
                            <div class="flex justify-between">
                                <div>
                                    <p class="font-bold text-sm dark:text-white flex items-center gap-2"><i class="fa-solid ${l.type === 'vaccine' ? 'fa-syringe' : 'fa-pills'} text-${l.type === 'vaccine' ? 'red-500' : 'blue-500'}"></i> ${l.name}</p>
                                    <p class="text-xs text-slate-400">${l.date}</p>
                                </div>
                                <span class="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded dark:bg-slate-700 dark:text-slate-300">${l.type === 'vaccine' ? 'لقاح' : 'علاج'}</span>
                            </div>
                            ${l.desc ? `<p class="mt-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded">${l.desc}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }
};

// --- 5. ACTIONS ---
const Actions = {
    saveDailyLog: async function() {
        const flockId = App.state.currentFlockId;
        const flock = await DB.get('flocks', flockId);
        const age = Math.floor((new Date() - new Date(flock.startDate)) / (1000 * 60 * 60 * 24));
        
        const mortality = parseInt(document.getElementById('logMortality').value) || 0;
        const weight = parseInt(document.getElementById('logWeight').value) || 0;
        const feed = parseFloat(document.getElementById('logFeed').value) || 0;
        const water = parseFloat(document.getElementById('logWater').value) || 0;
        const temp = document.getElementById('logTemp').value || 0;
        const hum = document.getElementById('logHum').value || 0;
        const deduct = document.getElementById('deductFeed').checked;
        const feedSrc = document.getElementById('feedSrc').value;

        // Save Log
        await DB.add('daily_logs', {
            flockId, age,
            mortality, weight, feedKg: feed, waterL: water,
            temp, humidity: hum,
            date: new Date().toLocaleDateString()
        });

        // Logic: Update Flock Count (Mortality)
        if(mortality > 0) {
            flock.count -= mortality;
            await DB.update('flocks', flock);
        }
        // Logic: Update Weight if provided
        if(weight > 0) {
            flock.weight = weight;
            await DB.update('flocks', flock);
        }

        // Logic: Inventory Deduction
        if(deduct && feed) {
            const invName = feedSrc === 'starter' ? 'علف مبدئي' : 'علف نهائي';
            const items = await DB.getAll('inventory');
            const item = items.find(i => i.name.includes(invName));
            if(item) {
                if(item.qty < feed) return alert('الكمية في المخزون لا تكفي!');
                item.qty -= feed;
                await DB.update('inventory', item);
            }
        }

        App.router('dailyLog');
    },

    addTransaction: async function() {
        const amount = parseFloat(document.getElementById('finAmount').value);
        const desc = document.getElementById('finDesc').value;
        const type = document.getElementById('btnInc').classList.contains('border-green-500') ? 'income' : 'expense';
        
        if(amount) {
            await DB.add('financial', { flockId: App.state.currentFlockId, amount, desc, type, date: new Date().toLocaleDateString() });
            App.router('financials');
        }
    },

    addInventory: async function() {
        const name = prompt("اسم الصنف:");
        if(name) { await DB.add('inventory', { name, qty: 0, unit: 'عدد', minStock: 10 }); App.router('inventory'); }
    },

    adjustInv: async function(id, delta) {
        const item = await DB.get('inventory', id);
        item.qty += delta;
        await DB.update('inventory', item);
        App.router('inventory');
    },

    addHealth: async function() {
        const name = document.getElementById('hName').value;
        const desc = document.getElementById('hDesc').value;
        const type = document.getElementById('hBtnVac').classList.contains('border-red-500') ? 'vaccine' : 'medicine';
        
        if(name) {
            await DB.add('health_logs', { flockId: App.state.currentFlockId, name, desc, type, date: new Date().toLocaleDateString() });
            App.router('health');
        }
    },

    setHealthType: function(type) {
        const v = document.getElementById('hBtnVac');
        const m = document.getElementById('hBtnMed');
        if(type === 'vaccine') {
            v.classList.add('border-red-500'); v.classList.remove('text-slate-500');
            m.classList.remove('border-red-500'); m.classList.add('text-slate-500');
        } else {
            m.classList.add('border-blue-500'); m.classList.remove('text-slate-500');
            v.classList.remove('border-red-500'); v.classList.add('text-slate-500');
        }
    },

    toggleTransType: function(type) {
        const i = document.getElementById('btnInc');
        const e = document.getElementById('btnExp');
        if(type === 'income') {
            i.classList.add('border-green-500'); i.classList.remove('text-slate-500');
            e.classList.remove('border-red-500'); e.classList.add('text-slate-500');
        } else {
            e.classList.add('border-red-500'); e.classList.remove('text-slate-500');
            i.classList.remove('border-green-500'); i.classList.add('text-slate-500');
        }
    }
};

// --- 6. BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => { App.init(); });
