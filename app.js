// --- 1. CONFIG & STATE ---
const App = {
    state: {
        currentCycleId: null,
        config: { 
            pin: '1234', 
            currency: 'SAR',
            feedPriceEstimate: 2, // سعر تقديري للعلف للحسابات
            laborCostPerDay: 50,
            elecCostPerDay: 20
        },
        standardCurves: {
            'Ross 308': [40, 80, 130, 190, 250, 320, 400, 480, 560, 640, 720, 810, 900, 990, 1080, 1170, 1260, 1350, 1440, 1530, 1620, 1710, 1800, 1890, 1980, 2070, 2160, 2250, 2340, 2430, 2520, 2610, 2700, 2790, 2880, 2970, 3060, 3150, 3240, 3330, 3420],
            'Cobb 500': [42, 85, 135, 200, 260, 330, 410, 490, 570, 650, 730, 820, 910, 1000, 1090, 1180, 1270, 1360, 1450, 1540, 1630, 1720, 1810, 1900, 1990, 2080, 2170, 2260, 2350, 2440, 2530, 2620, 2710, 2800, 2890, 2980, 3070, 3160, 3250, 3340, 3430]
        }
    },

    // --- 2. INITIALIZATION ---
    init: async function() {
        console.log("[App] init started");
        try {
            await DB.init();
            console.log("[App] DB Initialized");
            
            const logged = localStorage.getItem('erp_full_cycle_login');
            if(logged) {
                // Check if cycle exists
                const cycles = await DB.getAll('current_cycle');
                if(cycles.length > 0) {
                    document.getElementById('splashScreen').style.opacity = '0';
                    setTimeout(() => {
                        document.getElementById('splashScreen').style.display = 'none';
                        this.startApp(cycles[0]);
                    }, 500);
                } else {
                    this.showLoginAfterSplash();
                }
            } else {
                this.showLoginAfterSplash();
            }
        } catch(e) {
            console.error("[App Error]", e);
            alert("خطأ في تحميل قاعدة البيانات: " + e.message);
            this.showLoginAfterSplash();
        }
    },

    showLoginAfterSplash: function() {
        setTimeout(() => {
            document.getElementById('splashScreen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('splashScreen').style.display = 'none';
                document.getElementById('loginScreen').classList.remove('hidden');
            }, 500);
        }, 3000); // Show splash for 3 seconds
    },

    login: function() {
        const pin = document.getElementById('pinInput').value;
        if(pin === this.state.config.pin) {
            localStorage.setItem('erp_full_cycle_login', 'true');
            document.getElementById('loginScreen').classList.add('hidden');
            // Start App Logic after login
            this.router('dashboard');
        } else {
            alert('رمز خاطئ');
        }
    },

    startApp: async function(cycle) {
        this.state.currentCycleId = cycle.id;
        document.getElementById('appContainer').classList.remove('hidden');
        document.getElementById('appContainer').style.display = 'flex';
        document.getElementById('headerCycle').innerText = cycle.name;
        this.router('dashboard');
    },

    // --- 3. ROUTER SYSTEM ---
    router: async function(screenId, params = {}) {
        const container = document.getElementById('mainContent');
        const header = document.getElementById('headerTitle');
        const backBtn = document.getElementById('backBtn');
        const mainNav = document.getElementById('mainNav');

        // Hide all screens
        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        
        // Navigation Logic
        const topLevel = ['dashboard', 'production', 'inventory', 'finance', 'health', 'reports', 'settings'];
        const isRoot = topLevel.includes(screenId);
        
        if(isRoot) {
            mainNav.classList.remove('hidden');
            backBtn.classList.add('hidden');
            this.updateNav(screenId);
        } else {
            mainNav.classList.add('hidden');
            backBtn.classList.remove('hidden');
        }

        // Context Handling
        if (params.cycleId) this.state.currentCycleId = params.cycleId;

        // Render Views
        switch(screenId) {
            case 'dashboard': await Views.renderDashboard(container, header); break;
            case 'production': await Views.renderProduction(container, header); break;
            case 'inventory': await Views.renderInventory(container, header); break;
            case 'finance': await Views.renderFinance(container, header); break;
            case 'health': await Views.renderHealth(container, header); break;
            case 'reports': await Views.renderReports(container, header); break;
            case 'settings': await Views.renderSettings(container, header); break;
            case 'newCycle': await Views.renderNewCycle(container, header); break;
            case 'cycleDetails': await Views.renderCycleDetails(container, header, this.state.currentCycleId); break;
            default: container.innerHTML = 'جاري العمل...';
        }
    },

    updateNav: function(target) {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('text-primary');
            btn.classList.add('text-slate-400');
            if(btn.dataset.target === target) { 
                btn.classList.add('text-primary'); 
                btn.classList.remove('text-slate-400'); 
            }
        });
    },
    
    goBack: function() { this.router('dashboard'); },

    // --- 4. LOGIC CALCULATORS (THE BRAIN) ---
    calculateDashboardKPIs: async function() {
        try {
            const cycle = await DB.get('current_cycle', this.state.currentCycleId);
            if(!cycle) return { birds: 0, profit: 0, fcr: 0 };

            const logs = await DB.getAllByIndex('daily_logs', 'cycleId', this.state.currentCycleId);
            const finLogs = await DB.getAll('financial');

            // Birds
            const birds = cycle.count;

            // Financials
            const profit = finLogs.reduce((a,b) => a + (b.type==='income'?b.amount:-b.amount), 0);

            // FCR (Simple Estimation)
            const totalFeed = logs.reduce((a,b) => a + (parseFloat(b.feedKg)||0), 0);
            const fcr = birds ? (totalFeed / (birds * 1.5)).toFixed(2) : 0;

            return { birds, profit, fcr };
        } catch(e) { console.error(e); return {birds:0, profit:0, fcr:0}; }
    },

    calculateDetailedFinance: async function() {
        const cycle = await DB.get('current_cycle', this.state.currentCycleId);
        const logs = await DB.getAllByIndex('daily_logs', 'cycleId', this.state.currentCycleId);
        const healthLogs = await DB.getAllByIndex('health_records', 'cycleId', this.state.currentCycleId);
        const finLogs = await DB.getAll('financial');

        // 1. Fixed Costs
        const chickCost = cycle.count * cycle.chickPrice;
        
        // 2. Variable Costs (from logs)
        const totalFeedKg = logs.reduce((a,b) => a + (parseFloat(b.feedKg)||0), 0);
        const feedCost = totalFeedKg * (cycle.feedPrice || this.state.config.feedPriceEstimate);
        
        const medsCost = healthLogs.reduce((a,b) => a + (b.cost || 0), 0);

        const daysActive = Math.floor((new Date() - new Date(cycle.startDate)) / (1000 * 60 * 60 * 24));
        const laborCost = daysActive * this.state.config.laborCostPerDay;
        const miscCost = daysActive * this.state.config.elecCostPerDay;

        const totalCost = chickCost + feedCost + medsCost + laborCost + miscCost;

        // 3. Revenue
        const revenue = finLogs.filter(f => f.type === 'income').reduce((a,b) => a + b.amount, 0);

        return {
            chickCost, feedCost, medsCost, laborCost, miscCost, totalCost, revenue,
            profit: revenue - totalCost,
            totalFeedKg,
            totalMortality: logs.reduce((a,b) => a + (b.mortality||0), 0)
        };
    },

    calculateReports: async function() {
        const cycle = await DB.get('current_cycle', this.state.currentCycleId);
        if(!cycle) return null;

        const logs = await DB.getAllByIndex('daily_logs', 'cycleId', this.state.currentCycleId);
        const fin = await this.calculateDetailedFinance();
        
        // Weight & Age
        let currentWeightG = cycle.weight || 0;
        if(logs.length > 0) {
            const lastWithWeight = logs.filter(l => l.weight).sort((a,b) => b.id - a.id)[0];
            if(lastWithWeight) currentWeightG = lastWithWeight.weight;
        }

        const ageDays = Math.floor((new Date() - new Date(cycle.startDate)) / (1000 * 60 * 60 * 24));
        const breedCurve = this.state.standardCurves[cycle.breed] || [];
        const expectedWeight = breedCurve[ageDays - 1] || 0;

        const totalWeightProduced = (cycle.count * currentWeightG) / 1000;
        const fcr = totalWeightProduced ? (fin.totalFeedKg / totalWeightProduced).toFixed(2) : 0;
        const costPerKg = totalWeightProduced ? (fin.totalCost / totalWeightProduced).toFixed(2) : 0;

        return {
            fcr, costPerKg, fin, ageDays, currentWeightG, expectedWeight,
            mortalityRate: ((fin.totalMortality / cycle.count) * 100).toFixed(1)
        };
    }
};

// --- 5. VIEW CONTROLLER (UI GENERATOR) ---
const Views = {
    renderDashboard: async function(c, h) {
        h.innerText = 'لوحة التحكم';
        try {
            const kpi = await App.calculateDashboardKPIs();
            
            c.innerHTML = `
                <div class="screen active space-y-6">
                    <!-- Quick Status -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-r-4 border-primary">
                            <p class="text-xs text-slate-400 font-bold">عدد الطيور</p>
                            <h3 class="text-2xl font-black dark:text-white">${kpi.birds}</h3>
                        </div>
                        <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-r-4 border-secondary">
                            <p class="text-xs text-slate-400 font-bold">صافي الربح</p>
                            <h3 class="text-2xl font-black ${kpi.profit >= 0 ? 'text-green-600' : 'text-red-600'}">${kpi.profit.toLocaleString()}</h3>
                        </div>
                        <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-r-4 border-orange-500">
                            <p class="text-xs text-slate-400 font-bold">FCR (تقريبي)</p>
                            <h3 class="text-2xl font-black dark:text-white">${kpi.fcr}</h3>
                        </div>
                    </div>

                    <!-- Quick Actions -->
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                        <h4 class="font-bold mb-3 dark:text-white">سريع</h4>
                        <div class="grid grid-cols-2 gap-3">
                            <button onclick="App.router('production')" class="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-orange-600 dark:text-orange-400 font-bold text-sm">تسجيل يومي</button>
                            <button onclick="App.router('finance')" class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400 font-bold text-sm">المالية</button>
                            <button onclick="App.router('inventory')" class="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400 font-bold text-sm">المخزون</button>
                            <button onclick="App.router('health')" class="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400 font-bold text-sm">الصحة</button>
                        </div>
                    </div>

                    <!-- Cycle Info -->
                    <div class="bg-gradient-to-l from-teal-500 to-teal-700 p-6 rounded-2xl shadow-lg text-white flex justify-between items-center cursor-pointer" onclick="App.router('cycleDetails')">
                        <div>
                            <h2 class="text-xl font-bold">الدورة الحالية</h2>
                            <p class="text-teal-100 text-sm">اضغط للتفاصيل الكاملة</p>
                        </div>
                        <i class="fa-solid fa-chevron-left text-2xl"></i>
                    </div>
                </div>`;
        } catch(e) {
            c.innerHTML = `<div class="p-4 text-red-500">خطأ في عرض اللوحة: ${e.message}</div>`;
        }
    },

    renderCycleDetails: async function(c, h, id) {
        const cycle = await DB.get('current_cycle', id);
        if(!cycle) return App.router('dashboard');
        h.innerText = cycle.name;
        
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="bg-white dark:bg-darkcard p-5 rounded-xl shadow-sm border-r-4 border-primary">
                    <div class="flex justify-between mb-4">
                        <h3 class="font-bold text-lg dark:text-white">معلومات الدورة</h3>
                        <span class="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">نشطة</span>
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><p class="text-slate-400">عدد الطيور</p><p class="font-bold dark:text-white">${cycle.count}</p></div>
                        <div><p class="text-slate-400">نوع السلالة</p><p class="font-bold dark:text-white">${cycle.breed}</p></div>
                        <div><p class="text-slate-400">تاريخ البداية</p><p class="font-bold dark:text-white">${cycle.startDate}</p></div>
                        <div><p class="text-slate-400">وزن البداية</p><p class="font-bold dark:text-white">${cycle.weight}g</p></div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <button onclick="App.router('production')" class="bg-white dark:bg-darkcard p-6 rounded-xl shadow-sm text-center border-b-4 border-orange-500 hover:bg-slate-50">
                        <div class="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-2"><i class="fa-solid fa-clipboard-list text-xl"></i></div>
                        <p class="font-bold dark:text-white">السجل اليومي</p>
                    </button>
                    <button onclick="App.router('finance')" class="bg-white dark:bg-darkcard p-6 rounded-xl shadow-sm text-center border-b-4 border-blue-500 hover:bg-slate-50">
                        <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2"><i class="fa-solid fa-coins text-xl"></i></div>
                        <p class="font-bold dark:text-white">المالية</p>
                    </button>
                    <button onclick="App.router('inventory')" class="bg-white dark:bg-darkcard p-6 rounded-xl shadow-sm text-center border-b-4 border-emerald-500 hover:bg-slate-50">
                        <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2"><i class="fa-solid fa-boxes-stacked text-xl"></i></div>
                        <p class="font-bold dark:text-white">المخزون</p>
                    </button>
                    <button onclick="App.router('health')" class="bg-white dark:bg-darkcard p-6 rounded-xl shadow-sm text-center border-b-4 border-red-500 hover:bg-slate-50">
                        <div class="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2"><i class="fa-solid fa-heart-pulse text-xl"></i></div>
                        <p class="font-bold dark:text-white">الصحة</p>
                    </button>
                </div>
            </div>`;
    },

    renderProduction: async function(c, h) {
        h.innerText = 'السجل اليومي';
        try {
            const logs = await DB.getAllByIndex('daily_logs', 'cycleId', App.state.currentCycleId);
            
            c.innerHTML = `
                <div class="screen active space-y-4">
                    <!-- Daily Entry Form -->
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                        <h3 class="font-bold mb-4 dark:text-white border-b dark:border-slate-700 pb-2">تسجيل يوم جديد</h3>
                        
                        <div class="space-y-4">
                            <!-- Mortality -->
                            <div class="flex items-center gap-3">
                                <label class="text-sm font-bold w-20 text-slate-400">النفوق:</label>
                                <input type="number" id="logMortality" class="flex-1 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="0">
                                <button onclick="document.getElementById('mortalityModal').classList.remove('hidden')" class="text-xs bg-slate-100 px-2 py-1 rounded">السبب</button>
                            </div>

                            <!-- Feed -->
                            <div class="flex items-center gap-3">
                                <label class="text-sm font-bold w-20 text-slate-400">العلف:</label>
                                <input type="number" id="logFeed" class="flex-1 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="0.0 كجم">
                            </div>

                            <!-- Water -->
                            <div class="flex items-center gap-3">
                                <label class="text-sm font-bold w-20 text-slate-400">المياه:</label>
                                <input type="number" id="logWater" class="flex-1 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="0.0 لتر">
                            </div>

                            <!-- Weight -->
                            <div class="flex items-center gap-3">
                                <label class="text-sm font-bold w-20 text-slate-400">الوزن:</label>
                                <input type="number" id="logWeight" class="flex-1 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="متوسط العينة (جم)">
                            </div>

                            <!-- Environment -->
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="text-xs text-slate-400 block mb-1">الحرارة</label>
                                    <input type="number" id="logTemp" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="مثلاً 25">
                                </div>
                                <div>
                                    <label class="text-xs text-slate-400 block mb-1">الرطوبة</label>
                                    <input type="number" id="logHum" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="مثلاً 60">
                                </div>
                            </div>

                            <!-- Inventory Deduction -->
                            <div class="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                <input type="checkbox" id="deductStock" class="w-5 h-5 text-primary">
                                <div class="flex-1">
                                    <select id="logFeedSource" class="w-full bg-transparent border-0 text-sm font-bold dark:text-white focus:outline-none">
                                        <option value="">اختر مصدر العلف للخصم (اختياري)</option>
                                        <!-- Options loaded via JS -->
                                    </select>
                                </div>
                            </div>

                            <button onclick="Actions.saveDailyLog()" class="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/30">حفظ السجل</button>
                        </div>
                    </div>

                    <!-- Recent Logs -->
                    <div class="space-y-2">
                        ${logs.slice().reverse().slice(0, 5).map(l => `
                            <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-r-4 ${l.mortality > 0 ? 'border-red-500' : 'border-emerald-500'}">
                                <div class="flex justify-between mb-2">
                                    <span class="font-bold dark:text-white">${l.date}</span>
                                    <span class="text-xs text-slate-400">عمر ${l.age} يوم</span>
                                </div>
                                <div class="flex justify-between text-sm text-slate-600 dark:text-slate-300 font-bold">
                                    <span><i class="fa-solid fa-skull text-red-500"></i> ${l.mortality}</span>
                                    <span><i class="fa-solid fa-wheat-awn text-orange-500"></i> ${l.feedKg || 0}kg</span>
                                    <span><i class="fa-solid fa-glass-water text-blue-500"></i> ${l.waterL || 0}L</span>
                                    <span><i class="fa-solid fa-scale-balanced text-emerald-500"></i> ${l.weight || '-'}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;

            // Populate Inventory Select
            const inv = await DB.getAll('inventory');
            const select = document.getElementById('logFeedSource');
            inv.forEach(i => {
                if(i.name.includes('علف')) {
                    const opt = document.createElement('option');
                    opt.value = i.id;
                    opt.text = `${i.name} (${i.qty})`;
                    select.appendChild(opt);
                }
            });

        } catch(e) {
            c.innerHTML = `<div class="p-4 text-red-500">خطأ: ${e.message}</div>`;
        }
    },

    renderFinance: async function(c, h) {
        h.innerText = 'المالية الدقيقة';
        const fin = await App.calculateDetailedFinance();
        
        c.innerHTML = `
            <div class="screen active space-y-4">
                <!-- Summary -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-blue-500">
                        <p class="text-xs text-slate-400">التكلفة الكلية</p>
                        <h3 class="text-xl font-black dark:text-white">${fin.totalCost.toLocaleString()}</h3>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-green-500">
                        <p class="text-xs text-slate-400">صافي الربح</p>
                        <h3 class="text-xl font-black ${fin.profit >= 0 ? 'text-green-600' : 'text-red-600'}">${fin.profit.toLocaleString()}</h3>
                    </div>
                </div>

                <!-- Breakdown -->
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                    <h4 class="font-bold mb-4 dark:text-white">تفاصيل التكاليف</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between text-sm dark:text-slate-300"><span>كتاكيت</span><span class="font-bold dark:text-white">${fin.chickCost.toLocaleString()}</span></div>
                        <div class="flex justify-between text-sm dark:text-slate-300"><span>علف</span><span class="font-bold dark:text-white">${fin.feedCost.toLocaleString()}</span></div>
                        <div class="flex justify-between text-sm dark:text-slate-300"><span>أدوية</span><span class="font-bold dark:text-white">${fin.medsCost.toLocaleString()}</span></div>
                        <div class="flex justify-between text-sm dark:text-slate-300"><span>عمالة وكهرباء</span><span class="font-bold dark:text-white">${(fin.laborCost+fin.miscCost).toLocaleString()}</span></div>
                        <div class="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>
                        <div class="flex justify-between text-sm dark:text-white font-bold"><span>الإجمالي</span><span>${fin.totalCost.toLocaleString()}</span></div>
                    </div>
                </div>

                <!-- Transaction Form -->
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                    <h4 class="font-bold mb-4 dark:text-white">عملية مالية</h4>
                    <div class="flex gap-2 mb-4">
                        <button onclick="Actions.toggleTransType('income')" id="btnInc" class="flex-1 py-2 rounded-lg bg-green-100 text-green-600 font-bold border-2 border-green-500">دخل</button>
                        <button onclick="Actions.toggleTransType('expense')" id="btnExp" class="flex-1 py-2 rounded-lg bg-red-100 text-red-600 font-bold border-2 border-transparent">مصروف</button>
                    </div>
                    <input type="number" id="finAmount" class="w-full p-2 mb-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="المبلغ">
                    <input type="text" id="finDesc" class="w-full p-2 mb-4 border rounded dark:bg-slate-800 dark:text-white" placeholder="الوصف">
                    <button onclick="Actions.addTransaction()" class="w-full bg-blue-500 text-white py-2 rounded-lg font-bold">حفظ</button>
                </div>

                <!-- Log -->
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                     <h4 class="font-bold mb-2 dark:text-white">السجل</h4>
                     <div class="space-y-2 max-h-48 overflow-y-auto">
                        ${(await DB.getAll('financial')).slice().reverse().map(t => `
                            <div class="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border-r-4 ${t.type==='income'?'border-green-500':'border-red-500'}">
                                <span class="text-sm font-bold dark:text-white">${t.desc}</span>
                                <span class="text-sm font-bold ${t.type==='income'?'text-green-600':'text-red-600'}">${t.amount}</span>
                            </div>
                        `).join('')}
                     </div>
                </div>
            </div>`;
    },

    renderInventory: async function(c, h) {
        h.innerText = 'إدارة المخزون';
        const items = await DB.getAll('inventory');
        
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                    <h4 class="font-bold mb-2 dark:text-white">إضافة صنف</h4>
                    <div class="flex gap-2">
                        <input id="invName" type="text" class="flex-1 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="الاسم">
                        <input id="invUnit" type="text" class="w-20 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="الوحدة">
                        <input id="invMin" type="number" class="w-20 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="حد">
                        <button onclick="Actions.addInventory()" class="bg-primary text-white px-4 rounded-lg">+</button>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 gap-4">
                    ${items.map(i => {
                        const isLow = i.qty <= i.minStock;
                        return `
                            <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-r-4 ${isLow ? 'border-red-500' : 'border-emerald-500'}">
                                <div class="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 class="font-bold text-lg dark:text-white">${i.name}</h4>
                                        <p class="text-xs text-slate-400">الوحدة: ${i.unit} | الحد: ${i.minStock}</p>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <button onclick="Actions.adjustInv(${i.id}, 1)" class="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><i class="fa-solid fa-plus text-xs"></i></button>
                                        <button onclick="Actions.adjustInv(${i.id}, -1)" class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center"><i class="fa-solid fa-minus text-xs"></i></button>
                                    </div>
                                </div>
                                <div class="text-center mt-2">
                                    <span class="text-2xl font-black ${isLow ? 'text-red-500' : 'text-slate-800 dark:text-white'}">${i.qty}</span>
                                    ${isLow ? '<p class="text-[10px] text-red-500 font-bold">! نقص</p>' : ''}
                                </div>
                            </div>`;
                    }).join('')}
                </div>
            </div>`;
    },

    renderHealth: async function(c, h) {
        h.innerText = 'السجل الصحي';
        const logs = await DB.getAllByIndex('health_records', 'cycleId', App.state.currentCycleId);
        
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                    <h4 class="font-bold mb-4 dark:text-white">تسجيل طبي/لقاح جديد</h4>
                    <div class="flex gap-2 mb-3">
                        <button onclick="Actions.setHealthType('vaccine')" id="hBtnVac" class="flex-1 py-2 rounded-lg bg-red-100 text-red-600 font-bold border-2 border-red-500">لقاح</button>
                        <button onclick="Actions.setHealthType('medicine')" id="hBtnMed" class="flex-1 py-2 rounded-lg bg-blue-100 text-blue-600 font-bold border-2 border-transparent">دواء</button>
                    </div>
                    <input id="healthName" type="text" class="w-full mb-2 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="الاسم">
                    <input id="healthDate" type="date" class="w-full mb-2 p-2 border rounded dark:bg-slate-800 dark:text-white">
                    <textarea id="healthDesc" class="w-full mb-4 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="الوصف (الشركة، الجرعة)"></textarea>
                    <input id="healthCost" type="number" class="w-full mb-2 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="التكلفة (اختياري)">
                    <button onclick="Actions.addHealth()" class="w-full bg-primary text-white py-2 rounded-lg font-bold">حفظ</button>
                </div>

                <div class="space-y-3">
                    ${logs.slice().reverse().map(l => `
                        <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-r-4 ${l.type === 'vaccine' ? 'border-red-500' : 'border-blue-500'}">
                            <div class="flex justify-between mb-1">
                                <span class="font-bold dark:text-white flex items-center gap-2"><i class="fa-solid ${l.type==='vaccine'?'fa-syringe text-red-500':'fa-pills text-blue-500'}"></i> ${l.name}</span>
                                <span class="text-xs text-slate-400">${l.date}</span>
                            </div>
                            ${l.desc ? `<p class="text-sm text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded mt-2">${l.desc}</p>` : ''}
                            ${l.cost ? `<p class="text-sm font-bold dark:text-white">تكلفة: ${l.cost}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>`;
    },

    renderReports: async function(c, h) {
        h.innerText = 'التقارير والتحليل';
        const data = await App.calculateReports();
        if(!data) return;

        c.innerHTML = `
            <div class="screen active space-y-6">
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm text-center">
                        <p class="text-xs text-slate-400">الوزن الحالي</p>
                        <h3 class="text-2xl font-bold dark:text-white">${(data.currentWeightG/1000).toFixed(2)}kg</h3>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm text-center">
                        <p class="text-xs text-slate-400">FCR النهائي</p>
                        <h3 class="text-2xl font-bold dark:text-primary">${data.fcr}</h3>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm text-center">
                        <p class="text-xs text-slate-400">معدل النفوق</p>
                        <h3 class="text-2xl font-bold dark:text-white">${data.mortalityRate}%</h3>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm text-center">
                        <p class="text-xs text-slate-400">تكلفة الكيلو</p>
                        <h3 class="text-2xl font-bold dark:text-white">${data.costPerKg}</h3>
                    </div>
                </div>

                <!-- Charts Container -->
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                    <h4 class="font-bold mb-4 dark:text-white">منحنى النمو</h4>
                    <canvas id="growthChart" height="200"></canvas>
                </div>
            </div>`;

        setTimeout(() => {
            const ctx = document.getElementById('growthChart');
            if(ctx) {
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.expectedWeight ? Array(data.ageDays).fill(0).map((_, i) => `يوم ${i+1}`) : [],
                        datasets: [{
                            label: 'المتوقع (السلالة)',
                            data: data.expectedWeight ? Array(data.ageDays).fill(0).map((_, i) => (data.standardCurves[data.cycle.breed][i] || 0)/1000) : [],
                            borderColor: '#94a3b8',
                            borderDash: [5, 5]
                        }, {
                            label: 'الفعلي',
                            data: data.currentWeightG ? Array(data.ageDays).fill(0).map(() => (data.currentWeightG * 0.98)/1000) : [],
                            borderColor: '#10b981',
                            tension: 0.4
                        }]
                    },
                    options: { responsive: true, scales: { y: { beginAtZero: false } } }
                });
            }
        }, 100);
    },

    renderNewCycle: function(c, h) {
        h.innerText = 'دورة جديدة';
        c.innerHTML = `
            <div class="screen active flex flex-col items-center justify-center h-full p-6">
                <div class="bg-white dark:bg-darkcard p-8 rounded-3xl shadow-xl w-full max-w-sm">
                    <div class="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl"><i class="fa-solid fa-egg"></i></div>
                    <h2 class="text-xl font-bold mb-4 text-center dark:text-white">بدء دورة جديدة</h2>
                    <div class="space-y-3">
                        <input id="cycleName" type="text" class="w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none dark:text-white" placeholder="اسم الدفعة">
                        <select id="cycleBreed" class="w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none dark:text-white"><option>Ross 308</option><option>Cobb 500</option></select>
                        <input id="cycleStart" type="date" class="w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none dark:text-white">
                        <input id="cycleCount" type="number" class="w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none dark:text-white" placeholder="عدد الطيور">
                        <input id="cyclePrice" type="number" class="w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none dark:text-white" placeholder="سعر الكتكيت">
                        <button onclick="Actions.startNewCycle()" class="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg">حفظ وبدء</button>
                    </div>
                </div>
            </div>`;
    },
    
    renderSettings: function(c, h) {
        h.innerText = 'الإعدادات';
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                    <h4 class="font-bold mb-4 dark:text-white">إعدادات النظام</h4>
                    <div class="space-y-2">
                        <button onclick="DB.exportData()" class="w-full bg-blue-500 text-white py-3 rounded-xl font-bold">نسخ احتياطي</button>
                        <div class="relative">
                            <input type="file" id="restoreFile" class="hidden" onchange="Actions.restoreData(this)">
                            <button onclick="document.getElementById('restoreFile').click()" class="w-full bg-orange-500 text-white py-3 rounded-xl font-bold">استرجاع بيانات</button>
                        </div>
                        <button onclick="localStorage.clear();location.reload();" class="w-full text-red-500 py-3 rounded-xl font-bold">حذف جميع البيانات</button>
                    </div>
                </div>
            </div>`;
    }
};

// --- 6. ACTION CONTROLLERS ---
const Actions = {
    startNewCycle: async function() {
        const name = document.getElementById('cycleName').value;
        const breed = document.getElementById('cycleBreed').value;
        const start = document.getElementById('cycleStart').value;
        const count = document.getElementById('cycleCount').value;
        const price = document.getElementById('cyclePrice').value;

        if(name && start && count && price) {
            const id = await DB.add('current_cycle', {
                name, breed, startDate: start, initialCount: parseInt(count), count: parseInt(count),
                chickPrice: parseFloat(price), status: 'active', weight: 0
            });
            
            // Set as active and reload
            App.state.currentCycleId = id;
            App.router('dashboard');
        } else {
            alert("أكمل جميع البيانات المطلوبة");
        }
    },

    saveDailyLog: async function() {
        const cycleId = App.state.currentCycleId;
        const cycle = await DB.get('current_cycle', cycleId);
        
        // Inputs
        const mortality = parseInt(document.getElementById('logMortality').value) || 0;
        const feed = parseFloat(document.getElementById('logFeed').value) || 0;
        const water = parseFloat(document.getElementById('logWater').value) || 0;
        const weight = parseInt(document.getElementById('logWeight').value) || 0;
        const temp = parseFloat(document.getElementById('logTemp').value) || 0;
        const hum = parseFloat(document.getElementById('logHum').value) || 0;

        // 1. Calculate Age
        const age = Math.floor((new Date() - new Date(cycle.startDate)) / (1000 * 60 * 60 * 24));

        // 2. Save Log
        await DB.add('daily_logs', {
            cycleId, age, mortality, feedKg: feed, waterL: water, weight, temp, humidity: hum,
            date: new Date().toLocaleDateString()
        });

        // 3. Update Cycle Stats
        if(mortality > 0) {
            cycle.count -= mortality;
            await DB.update('current_cycle', cycle);
        }
        if(weight > 0) {
            cycle.weight = weight;
            await DB.update('current_cycle', cycle);
        }

        // 4. Inventory Deduction
        const deduct = document.getElementById('deductStock').checked;
        const srcId = document.getElementById('logFeedSource').value;
        
        if(deduct && feed && srcId) {
            const item = await DB.get('inventory', parseInt(srcId));
            if(item) {
                if(item.qty < feed) alert('الكمية في المخزون لا تكفي!');
                else {
                    item.qty -= feed;
                    await DB.update('inventory', item);
                }
            }
        }

        App.router('production');
    },

    addInventory: async function() {
        const name = document.getElementById('invName').value;
        const unit = document.getElementById('invUnit').value;
        const min = parseInt(document.getElementById('invMin').value) || 10;
        
        if(name) {
            await DB.add('inventory', { name, unit, minStock: min, qty: 0 });
            App.router('inventory');
        }
    },

    adjustInv: async function(id, delta) {
        const item = await DB.get('inventory', id);
        item.qty += delta;
        await DB.update('inventory', item);
        App.router('inventory');
    },

    addTransaction: async function() {
        const amount = parseFloat(document.getElementById('finAmount').value);
        const desc = document.getElementById('finDesc').value;
        const type = document.getElementById('btnInc').classList.contains('border-green-500') ? 'income' : 'expense';
        
        if(amount) {
            await DB.add('financial', {
                cycleId: App.state.currentCycleId,
                amount, desc, type,
                date: new Date().toLocaleDateString()
            });
            App.router('finance');
        }
    },

    addHealth: async function() {
        const name = document.getElementById('healthName').value;
        const date = document.getElementById('healthDate').value;
        const desc = document.getElementById('healthDesc').value;
        const type = document.getElementById('hBtnVac').classList.contains('border-red-500') ? 'vaccine' : 'medicine';
        const cost = parseFloat(document.getElementById('healthCost').value) || 0;
        
        if(name && date) {
            await DB.add('health_records', {
                cycleId: App.state.currentCycleId,
                name, date, desc, type, cost
            });
            App.router('health');
        }
    },

    restoreData: async function(input) {
        const file = input.files[0];
        if(!file) return;
        await DB.importData(file);
        alert('تم استرجاع البيانات بنجاح');
        location.reload();
    },

    toggleTransType: function(type) {
        const inc = document.getElementById('btnInc');
        const exp = document.getElementById('btnExp');
        if(type === 'income') {
            inc.classList.add('border-green-500'); inc.classList.remove('text-slate-500');
            exp.classList.remove('border-red-500'); exp.classList.add('text-slate-500');
        } else {
            exp.classList.add('border-red-500'); exp.classList.remove('text-slate-500');
            inc.classList.remove('border-green-500'); inc.classList.add('text-slate-500');
        }
    },

    setHealthType: function(type) {
        const vac = document.getElementById('hBtnVac');
        const med = document.getElementById('hBtnMed');
        if(type === 'vaccine') {
            vac.classList.add('border-red-500'); vac.classList.remove('text-slate-500');
            med.classList.remove('border-blue-500'); med.classList.add('text-slate-500');
        } else {
            med.classList.add('border-blue-500'); med.classList.remove('text-slate-500');
            vac.classList.remove('border-red-500'); vac.classList.add('text-slate-500');
        }
    }
};

// --- 7. BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
