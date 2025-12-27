// --- 1. CONFIG & STATE ---
const App = {
    state: {
        currentCycleId: null,
        config: { pin: '1234', currency: 'SAR', feedPriceEstimate: 2, laborCostPerBird: 0.5, elecPerDay: 50 },
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
                // إذا كان مسجلاً، نحاول جلب الدورة النشطة
                const cycles = await DB.getAll('current_cycle');
                const activeCycle = cycles.find(c => c.status === 'active');
                
                // إذا وجدنا دورة نشطة، نبدأ التطبيق فوراً
                if(activeCycle) {
                    document.getElementById('splashScreen').style.opacity = '0';
                    setTimeout(() => {
                        document.getElementById('splashScreen').style.display = 'none';
                        this.startApp(activeCycle);
                    }, 500);
                } else {
                    // لا توجد دورات، نذهب للشاشة الرئيسية لإنشاء واحدة
                    this.showLoginAfterSplash();
                }
            } else {
                this.showLoginAfterSplash();
            }
        } catch(e) {
            console.error("[CRITICAL ERROR] App Init Failed:", e);
            alert("حدث خطأ في النظام: " + e.message);
            this.showLoginAfterSplash(); // Fallback to login to prevent blank screen
        }
    },

    showLoginAfterSplash: function() {
        setTimeout(() => {
            const splash = document.getElementById('splashScreen');
            if(splash) {
                splash.style.opacity = '0';
                setTimeout(() => {
                    splash.style.display = 'none';
                    const login = document.getElementById('loginScreen');
                    if(login) login.classList.remove('hidden');
                    else {
                        // If login div missing (shouldn't happen), force dashboard
                        document.getElementById('appContainer').classList.remove('hidden');
                        document.getElementById('appContainer').style.display = 'flex';
                        this.router('dashboard');
                    }
                }, 500);
            }
        }, 3000);
    },

    login: async function() {
        const pin = document.getElementById('pinInput').value;
        if(pin === this.state.config.pin) {
            localStorage.setItem('erp_full_cycle_login', 'true');
            document.getElementById('loginScreen').classList.add('hidden');
            
            // FIX: Try to get cycle automatically after login
            try {
                const cycles = await DB.getAll('current_cycle');
                const activeCycle = cycles.find(c => c.status === 'active');
                this.startApp(activeCycle);
            } catch(e) {
                console.error(e);
                // Fallback to dashboard if DB read fails
                this.router('dashboard');
            }
        } else {
            alert('رمز خاطئ');
        }
    },

    // --- 3. START APP (Safe & Robust) ---
    startApp: async function(cycle) {
        // 1. Handle Case where no cycle provided (e.g., empty DB)
        if(!cycle) {
            try {
                const cycles = await DB.getAll('current_cycle');
                cycle = cycles.find(c => c.status === 'active');
            } catch(e) {}
        }

        // 2. If still no cycle, show dashboard (to prompt user to create one)
        if(!cycle) {
            this.state.currentCycleId = null;
            document.getElementById('appContainer').classList.remove('hidden');
            document.getElementById('appContainer').style.display = 'flex';
            this.router('dashboard');
            return;
        }

        // 3. Set Context
        this.state.currentCycleId = cycle.id;
        document.getElementById('appContainer').classList.remove('hidden');
        document.getElementById('appContainer').style.display = 'flex';
        document.getElementById('headerCycle').innerText = cycle.name;
        
        // 4. Route
        this.router('dashboard');
    },

    // --- 4. ROUTER SYSTEM ---
    router: async function(screenId, params = {}) {
        const container = document.getElementById('mainContent');
        const header = document.getElementById('headerTitle');
        const backBtn = document.getElementById('backBtn');
        const mainNav = document.getElementById('mainNav');

        // Hide all screens
        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        
        const topLevel = ['dashboard', 'production', 'inventory', 'finance', 'health', 'flocks', 'reports', 'settings', 'newCycle'];
        const isRoot = topLevel.includes(screenId);
        
        if(isRoot) {
            mainNav.classList.remove('hidden'); backBtn.classList.add('hidden');
            this.updateNav(screenId);
        } else {
            mainNav.classList.add('hidden'); backBtn.classList.remove('hidden');
        }

        if (params.cycleId) this.state.currentCycleId = params.cycleId;

        // Switch
        switch(screenId) {
            case 'dashboard': await Views.renderDashboard(container, header); break;
            case 'production': await Views.renderProduction(container, header); break;
            case 'inventory': await Views.renderInventory(container, header); break;
            case 'finance': await Views.renderFinance(container, header); break;
            case 'health': await Views.renderHealth(container, header); break;
            case 'reports': await Views.renderReports(container, header); break;
            case 'settings': await Views.renderSettings(container, header); break;
            case 'newCycle': await Views.renderNewCycle(container, header); break;
            case 'flockDetails': await Views.renderFlockDetails(container, header, this.state.currentCycleId); break;
            default: container.innerHTML = '<div class="p-4 text-center">جاري العمل...</div>';
        }
    },

    updateNav: function(target) {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('text-primary'); btn.classList.add('text-slate-400');
            if(btn.dataset.target === target) { btn.classList.add('text-primary'); btn.classList.remove('text-slate-400'); }
        });
    },

    goBack: function() { if(this.state.currentCycleId) this.router('flockDetails', {cycleId: this.state.currentCycleId}); else this.router('dashboard'); },

    // --- 5. LOGIC CALCULATIONS (The Brain) ---
    calculateDashboardKPIs: async function() {
        // SAFE RETURN if no cycle is selected
        if(!this.state.currentCycleId) {
            return { flocks: 0, birds: 0, profit: 0, fcr: 0, totalCost: 0 };
        }

        try {
            const cycle = await DB.get('current_cycle', this.state.currentCycleId);
            if(!cycle) return { flocks: 0, birds: 0, profit: 0, fcr: 0 };

            const totalFeedKg = (await DB.getAllByIndex('daily_logs', 'cycleId', cycle.id)).reduce((a,b)=>a+(parseFloat(b.feedKg)||0),0);
            const totalWeightKg = (cycle.count * (cycle.weight/1000));
            const fcr = totalWeightKg ? (totalFeedKg/totalWeightKg).toFixed(2) : 0;
            
            const fin = await this.calculateFlockFinancials(cycle.id);
            const profit = fin ? fin.profit : 0;

            return {
                flocks: 1, // Single farm implies 1 active
                birds: cycle.count,
                profit: profit,
                fcr: fcr,
                totalCost: fin ? fin.totalCost : 0
            };
        } catch(e) {
            console.error("KPI Calculation Error", e);
            return { flocks: 0, birds: 0, profit: 0, fcr: 0, totalCost: 0 };
        }
    },

    calculateFlockFinancials: async function(cycleId) {
        try {
            const cycle = await DB.get('current_cycle', cycleId);
            if(!cycle) return null;
            const chickCost = cycle.count * cycle.chickPrice;
            const totalFeed = (await DB.getAllByIndex('daily_logs', 'cycleId', cycle.id)).reduce((a,b)=>a+(parseFloat(b.feedKg)||0),0);
            const feedCost = totalFeed * this.state.config.feedPriceEstimate;
            const medsCost = (await DB.getAllByIndex('health_records', 'cycleId', cycle.id)).reduce((a,b)=>a+(b.type==='medicine'?b.cost:0),0);
            const daysActive = Math.floor((new Date() - new Date(cycle.startDate)) / (1000*60*60*24));
            const labor = (cycle.laborRate || this.state.config.laborCostPerBird) * cycle.count * daysActive;
            const misc = daysActive * this.state.config.elecPerDay;
            
            const totalCost = chickCost + feedCost + medsCost + labor + misc;
            
            const sales = (await DB.getAll('financial')).filter(s => s.cycleId == cycle.id && s.type === 'income');
            const revenue = sales.reduce((a,b)=>a+b.amount,0);
            
            return { chickCost, feedCost, medsCost, labor: labor+misc, totalCost, revenue, profit: revenue - totalCost };
        } catch(e) { return null; }
};

// --- 6. VIEW CONTROLLER ---
const Views = {
    renderDashboard: async function(c, h) {
        h.innerText = 'لوحة التحكم';
        const kpi = await App.calculateDashboardKPIs();

        c.innerHTML = `
            <div class="screen active space-y-4">
                <!-- Main KPIs -->
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-emerald-500">
                        <p class="text-xs text-slate-400">الدورة النشطة</p>
                        <h3 class="text-2xl font-bold dark:text-white">${kpi.flocks > 0 ? 'جاري' : 'لا توجد'}</h3>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-blue-500">
                        <p class="text-xs text-slate-400">عدد الطيور</p>
                        <h3 class="text-2xl font-bold dark:text-white">${kpi.birds}</h3>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-orange-500">
                        <p class="text-xs text-slate-400">FCR</p>
                        <h3 class="text-2xl font-bold dark:text-white">${kpi.fcr}</h3>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-red-500">
                        <p class="text-xs text-slate-400">التكلفة</p>
                        <h3 class="text-2xl font-bold dark:text-white">${kpi.totalCost.toLocaleString()}</h3>
                    </div>
                </div>

                <!-- Message if no cycle -->
                ${kpi.flocks === 0 ? `
                    <div class="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl text-center border border-blue-200">
                        <i class="fa-solid fa-egg text-4xl text-blue-500 mb-2"></i>
                        <h3 class="text-xl font-bold text-blue-900 dark:text-white mb-2">لا توجد دورة نشطة حالياً</h3>
                        <p class="text-sm text-blue-800 dark:text-blue-300 mb-4">للبداية العمل، يرجى إنشاء دورة إنتاج جديدة.</p>
                        <button onclick="App.router('newCycle')" class="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">إنشاء دورة جديدة</button>
                    </div>
                ` : ''}

                ${kpi.flocks > 0 ? `
                    <!-- Quick Actions -->
                    <div class="grid grid-cols-2 gap-3">
                        <button onclick="App.router('production')" class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm text-center hover:bg-slate-50 dark:hover:bg-slate-800">
                            <i class="fa-solid fa-clipboard-list text-2xl mb-2 text-orange-500"></i>
                            <p class="font-bold text-sm dark:text-white">السجل اليومي</p>
                        </button>
                        <button onclick="App.router('finance')" class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm text-center hover:bg-slate-50 dark:hover:bg-slate-800">
                            <i class="fa-solid fa-coins text-2xl mb-2 text-blue-500"></i>
                            <p class="font-bold text-sm dark:text-white">المالية</p>
                        </button>
                    </div>

                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-r-4 border-emerald-500 cursor-pointer" onclick="App.router('flockDetails')">
                        <div class="flex justify-between">
                            <div><h3 class="font-bold text-lg dark:text-white">تفاصيل الدورة</h3><p class="text-xs text-slate-400">اضغط لإدارة الدورة الحالية</p></div>
                            <i class="fa-solid fa-chevron-left text-slate-400"></i>
                        </div>
                    </div>
                ` : ''}
            </div>`;
    },

    renderProduction: async function(c, h) {
        h.innerText = 'السجل اليومي';
        const logs = await DB.getAllByIndex('daily_logs', 'cycleId', App.state.currentCycleId);
        
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                    <h4 class="font-bold mb-4 dark:text-white">تسجيل يوم جديد</h4>
                    <p class="text-xs text-slate-500 mb-4">قم بتسجيل البيانات اليومية للحفظ على دقة المخزون وحسابات الـ FCR.</p>
                    
                    <div class="space-y-3">
                        <!-- Mortality -->
                        <div class="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100">
                            <div class="flex justify-between items-center mb-2">
                                <label class="text-sm font-bold text-red-700 dark:text-red-300">نفق (عدد)</label>
                                <input type="number" id="logMortality" class="w-20 p-2 border rounded dark:bg-slate-800 dark:text-white text-center" value="0">
                            </div>
                        </div>

                        <!-- Weight Sampling -->
                        <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100">
                            <div class="flex justify-between items-center mb-2">
                                <label class="text-sm font-bold text-blue-700 dark:text-blue-300">متوسط الوزن (غرام)</label>
                                <input type="number" id="logWeight" class="w-24 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="مثلاً: 900">
                            </div>
                        </div>

                        <!-- Feed -->
                        <div class="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-100">
                            <label class="text-sm font-bold text-orange-700 mb-2 dark:text-orange-300">علف (كجم)</label>
                            <div class="flex items-center gap-2">
                                <input type="number" id="logFeed" class="flex-1 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="0.0">
                            </div>
                        </div>

                        <!-- Water -->
                        <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100">
                            <label class="text-sm font-bold text-blue-700 mb-2 dark:text-blue-300">مياه (لتر)</label>
                            <input type="number" id="logWater" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="0">
                        </div>

                        <button onclick="Actions.saveDailyLog()" class="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg mt-2">حفظ السجل</button>
                    </div>

                    <!-- Recent Logs List -->
                    <h4 class="font-bold mb-2 dark:text-white">سجلات الأيام الماضية</h4>
                    <div class="space-y-2">
                        ${logs.slice().reverse().slice(0, 5).map(l => `
                            <div class="bg-white dark:bg-darkcard p-3 rounded-lg border-r-4 ${l.mortality > 0 ? 'border-red-500' : 'border-emerald-500'}">
                                <div class="flex justify-between">
                                    <span class="font-bold text-sm dark:text-white">${l.date}</span>
                                    <span class="text-xs text-slate-400">عمر ${l.age} يوم</span>
                                </div>
                                <div class="grid grid-cols-4 gap-2 mt-2 text-center text-xs">
                                    <div><p class="text-red-500 font-bold">${l.mortality}</p><p class="text-slate-400">نفوق</p></div>
                                    <div><p class="text-orange-500 font-bold">${l.feedKg || 0}</p><p class="text-slate-400">علف</p></div>
                                    <div><p class="text-blue-500 font-bold">${l.waterL || 0}</p><p class="text-slate-400">ماء</p></div>
                                    <div><p class="text-emerald-500 font-bold">${l.weight || '-'}</p><p class="text-slate-400">وزن</p></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
    },

    renderInventory: async function(c, h) {
        h.innerText = 'المخزون';
        const items = await DB.getAll('inventory');
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm flex justify-between items-center">
                    <h3 class="font-bold dark:text-white">المخزون العام</h3>
                    <button onclick="Actions.addInventory()" class="bg-emerald-500 text-white w-8 h-8 rounded-lg"><i class="fa-solid fa-plus"></i></button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${items.map(i => `<div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-r-4 border-emerald-500"><h4 class="font-bold text-sm dark:text-white">${i.name}</h4><p class="text-2xl font-black dark:text-white">${i.qty}</p></div>`).join('')}
                </div>
            </div>`;
    },

    renderFinance: async function(c, h) {
        h.innerText = 'المالية الدقيقة';
        const fin = await App.calculateFlockFinancials(App.state.currentCycleId);
        
        c.innerHTML = `
            <div class="screen active space-y-4">
                ${fin ? `
                    <div class="grid grid-cols-2 gap-3 mb-4">
                        <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-blue-500"><p class="text-xs text-slate-400">إجمالي التكلفة</p><h3 class="text-xl font-bold dark:text-white">${fin.totalCost.toLocaleString()}</h3></div>
                        <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-emerald-500"><p class="text-xs text-slate-400">صافي الربح</p><h3 class="text-xl font-bold text-green-600 dark:text-green-400">${fin.profit.toLocaleString()}</h3></div>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                        <h4 class="font-bold mb-4 dark:text-white">تفاصيل التكلفة</h4>
                        <table class="w-full text-sm text-right"><tr class="border-b dark:border-slate-700"><td class="py-2 text-slate-400 dark:text-white">البند</td><td class="py-2 font-bold dark:text-white">المبلغ</td></tr><tr class="border-b dark:border-s
