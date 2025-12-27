// --- 1. CONFIG & STATE ---
const App = {
    state: {
        currentCycleId: null,
        config: { pin: '1234', currency: 'SAR' },
        standardCurves: {
            'Ross 308': [40, 80, 130, 190, 250, 320, 400, 480, 560, 640, 720, 810, 900, 990, 1080, 1170, 1260, 1350, 1440, 1530, 1620, 1710, 1800, 1890, 1980, 2070, 2160, 2250, 2340, 2430, 2520, 2610, 2700, 2790, 2880, 2970, 3060, 3150, 3240, 3330, 3420],
            'Cobb 500': [42, 85, 135, 200, 260, 330, 410, 490, 570, 650, 730, 820, 910, 1000, 1090, 1180, 1270, 1360, 1450, 1540, 1630, 1720, 1810, 1900, 1990, 2080, 2170, 2260, 2350, 2440, 2530, 2620, 2710, 2800, 2890, 2980, 3070, 3160, 3250, 3340, 3430]
        }
    },

    // --- 2. INITIALIZATION (DEBUG VERSION) ---
    init: async function() {
        console.log("[DEBUG] App.init() started");
        
        try {
            console.log("[DEBUG] Trying to open DB...");
            await DB.init();
            console.log("[DEBUG] DB Opened Successfully");

            // Force Login Screen after 3 seconds for debugging (Even if DB crashes)
            setTimeout(() => {
                const splash = document.getElementById('splashScreen');
                if(splash) {
                    splash.style.opacity = '0';
                    setTimeout(() => {
                        splash.style.display = 'none';
                        const logged = localStorage.getItem('erp_full_cycle_login');
                        if(logged) {
                            this.startApp();
                        } else {
                            const login = document.getElementById('loginScreen');
                            if(login) login.classList.remove('hidden');
                            else console.error("[DEBUG] Login Screen element missing!");
                        }
                    }, 500);
                }
            }, 3000);

            // Normal Logic (Only proceed if DB worked)
            const logged = localStorage.getItem('erp_full_cycle_login');
            if(logged) {
                // Check if we have a cycle to start with
                const cycles = await DB.getAll('current_cycle');
                if(cycles.length > 0) {
                    // Hide splash immediately if everything is perfect
                    document.getElementById('splashScreen').style.display = 'none';
                    this.startApp();
                } else {
                    // Splash stays, waits for timeout above to show Login/New Cycle
                    console.log("[DEBUG] No active cycles found, waiting for timeout...");
                }
            } else {
                console.log("[DEBUG] User not logged in, waiting for timeout...");
            }

        } catch(e) {
            console.error("[CRITICAL ERROR] During App.init():", e);
            alert("حدث خطأ في تحميل التطبيق: " + e.message);
            
            // Fallback: Force show login screen even on error
            setTimeout(() => {
                document.getElementById('splashScreen').style.display = 'none';
                document.getElementById('loginScreen').classList.remove('hidden');
            }, 1000);
        }
    },

    login: function() {
        const pin = document.getElementById('pinInput').value;
        if(pin === this.state.config.pin) {
            localStorage.setItem('erp_full_cycle_login', 'true');
            document.getElementById('loginScreen').classList.add('hidden');
            this.startApp();
        } else {
            alert('رمز خاطئ'); // Using standard alert to ensure visibility
        }
    },

    startApp: function() {
        document.getElementById('appContainer').classList.remove('hidden');
        document.getElementById('appContainer').style.display = 'flex'; // Ensure display is flex
        this.router('dashboard');
    },

    // --- 3. ROUTER SYSTEM ---
    router: async function(screenId, params = {}) {
        console.log(`[DEBUG] Router: ${screenId}`);
        const container = document.getElementById('mainContent');
        const header = document.getElementById('headerTitle');
        const back = document.getElementById('backBtn');
        const mainNav = document.getElementById('mainNav');

        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        const topLevel = ['dashboard', 'inventory', 'finance', 'health', 'flocks', 'reports', 'settings', 'quality'];
        const isRoot = topLevel.includes(screenId);
        
        if (isRoot) {
            mainNav.classList.remove('hidden'); back.classList.add('hidden');
            this.updateNav(screenId);
        } else {
            mainNav.classList.add('hidden'); back.classList.remove('hidden');
        }

        if (params.cycleId) this.state.currentCycleId = params.cycleId;

        // Views Switch
        switch(screenId) {
            case 'dashboard': await Views.renderDashboard(container, header); break;
            case 'flocks': await Views.renderFlocks(container, header); break;
            case 'addFlock': await Views.renderAddFlock(container, header); break;
            case 'flockDetails': await Views.renderFlockDetails(container, header, this.state.currentCycleId); break;
            case 'inventory': await Views.renderInventory(container, header); break;
            case 'finance': await Views.renderFinance(container, header); break;
            case 'health': await Views.renderHealth(container, header); break;
            default: container.innerHTML = `<div class="p-4 text-red-500">Screen ${screenId} not found</div>`;
        }
    },

    updateNav: function(target) {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('text-emerald-500'); btn.classList.add('text-slate-400');
            if(btn.dataset.target === target) { btn.classList.add('text-emerald-500'); btn.classList.remove('text-slate-400'); }
        });
    },

    goBack: function() { this.router('flocks'); },

    // --- 4. LOGIC ---
    calculateDashboardKPIs: async function() {
        try {
            // Use 'current_cycle' instead of 'flocks' to match database.js v4
            const cycles = await DB.getAll('current_cycle');
            const active = cycles.filter(f => f.status === 'active');
            const birds = active.reduce((a,b) => a + parseInt(b.count), 0);
            const fin = await DB.getAll('financial');
            const profit = fin.reduce((a,b) => a + (b.type === 'income' ? b.amount : -b.amount), 0);
            
            const feed = await DB.getAll('daily_logs');
            const totalFeed = feed.reduce((a,b) => a + parseFloat(b.feedKg || 0), 0);
            const fcr = birds ? (totalFeed / (birds * 1.5)).toFixed(2) : 0;

            return { flocks: cycles.length, birds, profit, fcr };
        } catch(e) {
            console.error("[Error] calculateDashboardKPIs:", e);
            return { flocks: 0, birds: 0, profit: 0, fcr: 0 }; // Fallback
        }
    }
};

// --- 5. VIEW CONTROLLER ---
const Views = {
    // Dashboard: Uses 'current_cycle'
    renderDashboard: async function(c, h) {
        console.log("[DEBUG] Rendering Dashboard");
        try {
            const kpi = await App.calculateDashboardKPIs();
            h.innerText = 'لوحة المدير';
            
            c.innerHTML = `
                <div class="screen active space-y-4">
                    <div class="grid grid-cols-2 gap-3">
                        <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-emerald-500">
                            <p class="text-xs text-slate-400">الدورات النشطة</p>
                            <h3 class="text-2xl font-bold dark:text-white">${kpi.flocks}</h3>
                        </div>
                        <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-blue-500">
                            <p class="text-xs text-slate-400">عدد الطيور</p>
                            <h3 class="text-2xl font-bold dark:text-white">${kpi.birds}</h3>
                        </div>
                        <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-orange-500">
                            <p class="text-xs text-slate-400">FCR (متوسط)</p>
                            <h3 class="text-2xl font-bold dark:text-primary">${kpi.fcr}</h3>
                        </div>
                        <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border-b-4 border-red-500">
                            <p class="text-xs text-slate-400">صافي الربح</p>
                            <h3 class="text-2xl font-bold text-green-600 dark:text-green-400">${kpi.profit.toLocaleString()}</h3>
                        </div>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                        <h4 class="font-bold mb-3 dark:text-white">الدورات النشطة</h4>
                        ${kpi.flocks === 0 ? '<div class="text-center py-8 text-slate-400">لا توجد دورات نشطة. ابدأ دورة جديدة.</div>' : ''}
                    </div>
                </div>`;
        } catch(e) {
            c.innerHTML = `<div class="p-4 text-red-500">خطأ في عرض الشاشة: ${e.message}</div>`;
        }
    },

    // Flocks: Uses 'current_cycle'
    renderFlocks: async function(c, h) {
        try {
            // FIXED: Using 'current_cycle' store
            const cycles = await DB.getAll('current_cycle');
            h.innerText = 'إدارة الدورات';
            c.innerHTML = `
                <div class="screen active space-y-4">
                    <button onclick="App.router('addFlock')" class="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/30 mb-4 flex items-center justify-center gap-2"><i class="fa-solid fa-plus"></i> دورة جديدة</button>
                    ${cycles.map(f => {
                        const age = Math.floor((new Date() - new Date(f.startDate)) / (1000 * 60 * 60 * 24));
                        return `<div onclick="App.router('flockDetails', {cycleId: ${f.id}})" class="bg-white dark:bg-darkcard p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer">
                            <div class="flex justify-between items-start mb-2">
                                <div><h3 class="font-bold text-lg dark:text-white">${f.name}</h3><p class="text-xs text-slate-500">${f.breed} • عمر ${age} يوم</p></div>
                                <span class="px-2 py-1 rounded text-xs font-bold ${f.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-600'}">${f.status === 'active' ? 'جارية' : 'مكتملة'}</span>
                            </div>
                            <div class="flex justify-between text-sm font-bold text-slate-600 dark:text-slate-300 mt-3">
                                <span><i class="fa-solid fa-feather"></i> ${f.count}</span>
                                <span><i class="fa-solid fa-scale-balanced"></i> ${(f.weight||0)/1000}kg</span>
                            </div>
                        </div>`;
                    }).join('')}
                </div>`;
        } catch(e) { c.innerHTML = `<div class="p-4 text-red-500">خطأ: ${e.message}</div>`; }
    },

    // Add Flock: Saves to 'current_cycle'
    renderAddFlock: function(c, h) {
        h.innerText = 'دورة جديدة';
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm space-y-3">
                    <input id="fName" type="text" class="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none dark:text-white" placeholder="اسم الدفعة">
                    <select id="fBreed" class="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none dark:text-white"><option>Ross 308</option><option>Cobb 500</option><option>Hubbard</option></select>
                    <input id="fStart" type="date" class="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none dark:text-white">
                    <input id="fCount" type="number" class="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none dark:text-white" placeholder="عدد الطيور">
                    <input id="fCost" type="number" class="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none dark:text-white" placeholder="سعر الطائر">
                    <button onclick="Actions.addFlock()" class="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/30">حفظ الدفعة</button>
                </div>
            </div>`;
    },

    // ... Other Placeholders for brevity, ensure they use the correct store names ...
    renderInventory: async function(c, h) {
        h.innerText = 'المخزون';
        try {
            const items = await DB.getAll('inventory');
            c.innerHTML = `<div class="screen active grid grid-cols-1 md:grid-cols-2 gap-4">${items.map(i => `<div class="bg-white dark:bg-darkcard p-3 rounded-lg shadow-sm"><h4 class="font-bold text-sm dark:text-white">${i.name}</h4><p class="text-xl font-black text-primary">${i.qty}</p></div>`).join('')}</div>`;
        } catch(e) { c.innerHTML = `Error: ${e.message}`; }
    },
    
    // Add dummy renders for other routes to prevent undefined errors
    renderFinance: async function(c, h) { c.innerHTML = '<div class="p-4">Finance Screen</div>'; h.innerText='Finance'; },
    renderHealth: async function(c, h) { c.innerHTML = '<div class="p-4">Health Screen</div>'; h.innerText='Health'; },
    renderFlockDetails: async function(c, h, id) { c.innerHTML = '<div class="p-4">Flock Details ID: '+id+'</div>'; h.innerText='Details'; },
    renderReports: async function(c, h) { c.innerHTML = '<div class="p-4">Reports</div>'; h.innerText='Reports'; },
    renderSettings: async function(c, h) { c.innerHTML = '<div class="p-4">Settings</div>'; h.innerText='Settings'; },
    renderQuality: async function(c, h) { c.innerHTML = '<div class="p-4">Quality</div>'; h.innerText='Quality'; }
};

// --- 6. ACTIONS ---
const Actions = {
    addFlock: async function() {
        const name = document.getElementById('fName').value;
        const count = document.getElementById('fCount').value;
        if(name && count) {
            // Save to 'current_cycle'
            await DB.add('current_cycle', { 
                name, count, breed: document.getElementById('fBreed').value, 
                startDate: document.getElementById('fStart').value, 
                cost: document.getElementById('fCost').value, 
                status: 'active', weight: 0 
            });
            App.router('flocks');
        } else {
            alert("أدخل الاسم وعدد الطيور");
        }
    }
};

// --- 7. BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] DOM Content Loaded. Starting App.init...");
    App.init();
});
