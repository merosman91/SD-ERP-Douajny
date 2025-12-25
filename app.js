// --- 1. CONFIG & STATE ---
const App = {
    state: {
        currentFlockId: null,
        config: { pin: '1234', currency: 'SAR' }
    },

    init: async function() {
        try {
            await DB.init();
            const logged = localStorage.getItem('erp_full_login');
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
        } catch(e) {
            console.error("DB Init Error", e);
            alert("خطأ في تحميل قاعدة البيانات");
        }
    },

    login: function() {
        const pin = document.getElementById('pinInput').value;
        if(pin === this.state.config.pin) {
            localStorage.setItem('erp_full_login', 'true');
            document.getElementById('loginScreen').classList.add('hidden');
            this.startApp();
        } else alert('رمز خاطئ');
    },

    startApp: function() {
        document.getElementById('appContainer').classList.remove('hidden');
        this.router('dashboard');
    },

    // --- 2. ROUTER ---
    router: async function(screenId, params = {}) {
        const c = document.getElementById('mainContent');
        const h = document.getElementById('headerTitle');
        const back = document.getElementById('backBtn');
        const nav = document.getElementById('mainNav');

        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        const topLevel = ['dashboard', 'inventory', 'finance', 'health', 'flocks', 'reports', 'settings'];
        
        if(topLevel.includes(screenId)) {
            nav.classList.remove('hidden'); back.classList.add('hidden');
            this.updateNav(screenId);
        } else {
            nav.classList.add('hidden'); back.classList.remove('hidden');
        }

        if(params.flockId) this.state.currentFlockId = params.flockId;

        switch(screenId) {
            case 'dashboard': await Views.renderDashboard(c, h); break;
            case 'flocks': await Views.renderFlocks(c, h); break;
            case 'addFlock': await Views.renderAddFlock(c, h); break;
            case 'flockDetails': await Views.renderFlockDetails(c, h, this.state.currentFlockId); break;
            case 'inventory': await Views.renderInventory(c, h); break;
            case 'finance': await Views.renderFinance(c, h); break;
            case 'health': await Views.renderHealth(c, h); break;
            default: c.innerHTML = 'جاري العمل...';
        }
    },

    updateNav: function(target) {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('text-emerald-500'); btn.classList.add('text-slate-400');
            if(btn.dataset.target === target) { btn.classList.add('text-emerald-500'); btn.classList.remove('text-slate-400'); }
        });
    },
    
    goBack: function() { this.router('flocks'); },

    // --- 3. VIEWS (UI RENDERERS) ---
    Views: {
        renderDashboard: async function(c, h) {
            h.innerText = 'لوحة المدير';
            const flocks = await DB.getAll('flocks');
            const items = await DB.getAll('inventory');
            
            // Dashboard Stats
            const active = flocks.filter(f => f.status === 'active').length;
            const lowStock = items.filter(i => i.qty <= i.minStock).length;

            c.innerHTML = `
                <div class="screen active space-y-4">
                    <!-- Status Grid -->
                    <div class="grid grid-cols-2 gap-3">
                        <div class="bg-emerald-500 text-white p-4 rounded-2xl shadow-lg"><h3 class="text-2xl font-bold">${active}</h3><p class="text-xs opacity-80">دورات نشطة</p></div>
                        <div class="bg-white dark:bg-darkcard p-4 rounded-2xl shadow-sm border-b-4 border-blue-500"><h3 class="text-2xl font-bold dark:text-white">${items.length}</h3><p class="text-xs text-slate-400">أصناف مخزون</p></div>
                        <div class="bg-white dark:bg-darkcard p-4 rounded-2xl shadow-sm border-b-4 border-orange-500"><h3 class="text-2xl font-bold text-orange-500">${lowStock}</h3><p class="text-xs text-slate-400">تحذيرات مخزون</p></div>
                        <div class="bg-white dark:bg-darkcard p-4 rounded-2xl shadow-sm border-b-4 border-red-500"><h3 class="text-2xl font-bold text-red-500">0</h3><p class="text-xs text-slate-400">تنبيهات صحة</p></div>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-2xl shadow-sm">
                        <h4 class="font-bold mb-3 dark:text-white">إجراءات سريعة</h4>
                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="App.router('addFlock')" class="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm font-bold">دورة جديدة</button>
                            <button onclick="App.router('inventory')" class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400 text-sm font-bold">جرد مخزون</button>
                            <button onclick="App.router('finance')" class="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-orange-600 dark:text-orange-400 text-sm font-bold">دفتر اليومية</button>
                            <button onclick="App.router('health')" class="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-bold">سجل طبي</button>
                        </div>
                    </div>
                </div>`;
        },

        renderFlocks: async function(c, h) {
            h.innerText = 'إدارة الدورات';
            const flocks = await DB.getAll('flocks');
            c.innerHTML = `
                <div class="screen active space-y-4">
                    <button onclick="App.router('addFlock')" class="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/30 mb-4">إضافة دورة جديدة</button>
                    ${flocks.map(f => `
                        <div onclick="App.router('flockDetails', {flockId: ${f.id}})" class="bg-white dark:bg-darkcard p-5 rounded-2xl shadow-sm border-r-4 ${f.status === 'active' ? 'border-emerald-500' : 'border-slate-400'} cursor-pointer">
                            <div class="flex justify-between items-start mb-2">
                                <div><h3 class="font-bold text-lg dark:text-white">${f.name}</h3><p class="text-xs text-slate-400">${f.breed} | ${f.startDate}</p></div>
                                <span class="px-2 py-1 rounded-full text-xs font-bold ${f.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-600'}">${f.status === 'active' ? 'نشطة' : 'مكتملة'}</span>
                            </div>
                            <div class="flex justify-between text-sm text-slate-500 dark:text-slate-300">
                                <span><i class="fa-solid fa-feather"></i> ${f.count} طائر</span>
                                <span><i class="fa-solid fa-user-doctor"></i> ${f.vet || 'غير محدد'}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>`;
        },

        renderAddFlock: function(c, h) {
            h.innerText = 'بيانات الدورة';
            c.innerHTML = `
                <div class="screen active space-y-4">
                    <div class="bg-white dark:bg-darkcard p-4 rounded-2xl shadow-sm space-y-3">
                        <input id="fName" type="text" class="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl dark:text-white" placeholder="اسم الدورة">
                        <select id="fBreed" class="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl dark:text-white"><option>Ross 308</option><option>Cobb 500</option><option>Hubbard</option></select>
                        <input id="fStart" type="date" class="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl dark:text-white">
                        <div class="grid grid-cols-2 gap-3">
                            <input id="fCount" type="number" class="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl dark:text-white" placeholder="عدد الطيور">
                            <input id="fPrice" type="number" class="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl dark:text-white" placeholder="سعر الطائر">
                        </div>
                        <!-- New Fields -->
                        <input id="fVet" type="text" class="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl dark:text-white" placeholder="اسم الطبيب البيطري">
                        <input id="fWorkers" type="number" class="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl dark:text-white" placeholder="عدد العمال">
                        <button onclick="Actions.addFlock()" class="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold">حفظ الدورة</button>
                    </div>
                </div>`;
        },

        renderFlockDetails: async function(c, h, id) {
            const flock = await DB.get('flocks', id);
            if(!flock) return App.router('flocks');
            h.innerText = flock.name;
            
            c.innerHTML = `
                <div class="screen active space-y-4">
                    <div class="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-6 rounded-2xl shadow-lg">
                        <h2 class="text-2xl font-bold mb-2">${flock.name}</h2>
                        <div class="flex justify-between text-teal-100 text-sm">
                            <span>${flock.breed}</span><span>${f.count} طائر</span>
                        </div>
                        <div class="mt-4 text-xs bg-white/20 p-2 rounded-lg">
                            <p><i class="fa-solid fa-user-doctor"></i> الطبيب: ${flock.vet || '-'}</p>
                            <p><i class="fa-solid fa-users"></i> العمال: ${flock.workers || 0}</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3">
                        <button onclick="App.router('finance')" class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm text-center">
                            <i class="fa-solid fa-coins text-orange-500 text-2xl mb-1"></i>
                            <p class="font-bold text-sm dark:text-white">الحسابات</p>
                        </button>
                        <button onclick="App.router('health')" class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm text-center">
                            <i class="fa-solid fa-stethoscope text-red-500 text-2xl mb-1"></i>
                            <p class="font-bold text-sm dark:text-white">السجل الصحي</p>
                        </button>
                    </div>
                </div>`;
        },

        // --- SMART FINANCE VIEW ---
        renderFinance: async function(c, h) {
            h.innerText = 'الإدارة المالية';
            const txs = await DB.getAll('financial');
            const income = txs.filter(t => t.type === 'income').reduce((a,b) => a + b.amount, 0);
            const expense = txs.filter(t => t.type === 'expense').reduce((a,b) => a + b.amount, 0);
            
            c.innerHTML = `
                <div class="screen active space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-green-500 text-white p-4 rounded-2xl shadow-sm">
                            <p class="text-green-100 text-xs">إجمالي الدخل</p>
                            <h3 class="text-2xl font-bold">${income.toLocaleString()}</h3>
                        </div>
                        <div class="bg-red-500 text-white p-4 rounded-2xl shadow-sm">
                            <p class="text-red-100 text-xs">إجمالي المصروف</p>
                            <h3 class="text-2xl font-bold">${expense.toLocaleString()}</h3>
                        </div>
                    </div>
                    
                    <!-- Transaction Form -->
                    <div class="bg-white dark:bg-darkcard p-4 rounded-2xl shadow-sm">
                        <h4 class="font-bold mb-3 dark:text-white">تسجيل عملية مالية</h4>
                        <div class="space-y-3">
                            <div class="flex gap-2">
                                <button onclick="setFinType('income')" id="btnIncome" class="flex-1 py-2 rounded-lg bg-green-100 text-green-600 font-bold text-sm border-2 border-green-500">دخل</button>
                                <button onclick="setFinType('expense')" id="btnExpense" class="flex-1 py-2 rounded-lg bg-red-100 text-red-600 font-bold text-sm border-2 border-transparent">مصروف</button>
                            </div>
                            <input type="number" id="finAmount" class="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl dark:text-white" placeholder="المبلغ">
                            <input type="text" id="finDesc" class="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl dark:text-white" placeholder="الوصف">
                            <button onclick="Actions.addFinance()" class="w-full bg-orange-500 text-white py-3 rounded-xl font-bold">حفظ العملية</button>
                        </div>
                    </div>

                    <!-- History List -->
                    <h4 class="font-bold dark:text-white">السجل المالي</h4>
                    <div class="space-y-2">
                        ${txs.slice().reverse().map(t => `
                            <div class="bg-white dark:bg-darkcard p-3 rounded-xl shadow-sm flex justify-between items-center border-r-4 ${t.type === 'income' ? 'border-green-500' : 'border-red-500'}">
                                <div>
                                    <p class="font-bold text-sm dark:text-white">${t.desc}</p>
                                    <p class="text-xs text-slate-400">${t.date} | ${t.type === 'income' ? 'دخل' : 'مصروف'}</p>
                                </div>
                                <span class="font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}">${t.amount.toLocaleString()}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        },

        // --- SMART INVENTORY VIEW ---
        renderInventory: async function(c, h) {
            h.innerText = 'إدارة المخزون';
            const items = await DB.getAll('inventory');
            c.innerHTML = `
                <div class="screen active space-y-4">
                    <div class="bg-white dark:bg-darkcard p-4 rounded-2xl shadow-sm">
                        <h4 class="font-bold mb-2 dark:text-white">إضافة صنف جديد</h4>
                        <div class="flex gap-2">
                            <input id="invName" class="flex-1 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="الاسم">
                            <input id="invUnit" class="w-20 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="الوحدة">
                            <input id="invMin" class="w-20 p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="حد الطلب">
                            <button onclick="Actions.addInventory()" class="bg-blue-500 text-white px-4 rounded-lg">+</button>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${items.map(i => {
                            const isLow = i.qty <= i.minStock;
                            return `
                            <div class="bg-white dark:bg-darkcard p-4 rounded-2xl shadow-sm border-r-4 ${isLow ? 'border-red-500' : 'border-emerald-500'} relative overflow-hidden">
                                ${isLow ? '<div class="absolute top-0 left-0 bg-red-500 text-white text-[10px] px-2 py-1 font-bold">! نقص</div>' : ''}
                                <div class="flex justify-between items-start">
                                    <div>
                                        <h4 class="font-bold text-lg dark:text-white">${i.name}</h4>
                                        <p class="text-xs text-slate-400">الوحدة: ${i.unit} | حد الطلب: ${i.minStock}</p>
                                    </div>
                                    <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                        <button onclick="Actions.adjustInventory(${i.id}, 1)" class="text-emerald-500"><i class="fa-solid fa-plus"></i></button>
                                    <button onclick="Actions.adjustInventory(${i.id}, -1)" class="text-red-500"><i class="fa-solid fa-minus"></i></button>
                                    </div>
                                </div>
                                <div class="mt-3 text-center">
                                    <span class="text-3xl font-black ${isLow ? 'text-red-500' : 'text-slate-800 dark:text-white'}">${i.qty}</span>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
        },

        // --- HEALTH MANAGEMENT VIEW ---
        renderHealth: async function(c, h) {
            h.innerText = 'السجل الصحي';
            const logs = await DB.getAll('health_logs');
            
            // Group by Vaccines vs Medicine visually (Optional logic, here just list)
            c.innerHTML = `
                <div class="screen active space-y-4">
                    <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl shadow-sm border border-red-100">
                        <h4 class="font-bold text-red-700 dark:text-red-300 mb-2">تسجيل جديد</h4>
                        <div class="space-y-2">
                            <div class="flex gap-2">
                                <button onclick="setHealthType('vaccine')" id="btnVac" class="flex-1 py-2 bg-white dark:bg-slate-800 rounded-lg text-sm font-bold border-2 border-red-500">لقاح</button>
                                <button onclick="setHealthType('medicine')" id="btnMed" class="flex-1 py-2 bg-white dark:bg-slate-800 rounded-lg text-sm font-bold border-2 border-transparent">علاج</button>
                            </div>
                            <input id="healthName" type="text" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="اسم اللقاح/الدواء">
                            <input id="healthDate" type="date" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white">
                            <textarea id="healthDesc" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white" placeholder="نبذة تعريفية (الشركة، الاستعمال، الجرعة)"></textarea>
                            <button onclick="Actions.addHealth()" class="w-full bg-red-500 text-white py-2 rounded-xl font-bold">حفظ السجل</button>
                        </div>
                    </div>

                    <div class="space-y-3">
                        ${logs.slice().reverse().map(l => `
                            <div class="bg-white dark:bg-darkcard p-4 rounded-2xl shadow-sm border-r-4 ${l.type === 'vaccine' ? 'border-emerald-500' : 'border-blue-500'}">
                                <div class="flex justify-between items-start">
                                    <div>
                                        <h4 class="font-bold dark:text-white flex items-center gap-2">
                                            <i class="fa-solid ${l.type === 'vaccine' ? 'fa-syringe text-emerald-500' : 'fa-pills text-blue-500'}"></i>
                                            ${l.name}
                                        </h4>
                                        <p class="text-xs text-slate-400">${l.date}</p>
                                    </div>
                                </div>
                                ${l.desc ? `<div class="mt-2 bg-slate-50 dark:bg-slate-700 p-2 rounded-lg text-xs text-slate-600 dark:text-slate-300"><p class="font-bold mb-1">نبذة:</p>${l.desc}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        }
    }
};

// --- 4. ACTIONS (LOGIC) ---
const Actions = {
    addFlock: async function() {
        const name = document.getElementById('fName').value;
        const breed = document.getElementById('fBreed').value;
        const count = document.getElementById('fCount').value;
        const price = document.getElementById('fPrice').value;
        const start = document.getElementById('fStart').value;
        const vet = document.getElementById('fVet').value;
        const workers = document.getElementById('fWorkers').value;

        if(name && count) {
            await DB.add('flocks', { 
                name, breed, count, price, start, vet, workers, status: 'active' 
            });
            App.router('flocks');
        } else alert('أكمل البيانات الأساسية');
    },

    addFinance: async function() {
        const amount = parseFloat(document.getElementById('finAmount').value);
        const desc = document.getElementById('finDesc').value;
        const type = document.getElementById('btnIncome').classList.contains('border-green-500') ? 'income' : 'expense';
        
        if(amount) {
            await DB.add('financial', {
                amount, desc, type, date: new Date().toLocaleDateString()
            });
            App.router('finance');
        }
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

    adjustInventory: async function(id, delta) {
        const item = await DB.get('inventory', id);
        if(item) {
            item.qty += delta;
            await DB.update('inventory', item);
            App.router('inventory');
        }
    },

    addHealth: async function() {
        const name = document.getElementById('healthName').value;
        const date = document.getElementById('healthDate').value;
        const desc = document.getElementById('healthDesc').value;
        const type = document.getElementById('btnVac').classList.contains('border-red-500') ? 'vaccine' : 'medicine';
        
        if(name && date) {
            await DB.add('health_logs', { name, date, desc, type });
            App.router('health');
        }
    }
};

// --- 5. HELPER FUNCTIONS ---
function setFinType(type) {
    const inc = document.getElementById('btnIncome');
    const exp = document.getElementById('btnExpense');
    if(type === 'income') { inc.classList.add('border-green-500'); exp.classList.remove('border-red-500'); }
    else { exp.classList.add('border-red-500'); inc.classList.remove('border-green-500'); }
}

function setHealthType(type) {
    const vac = document.getElementById('btnVac');
    const med = document.getElementById('btnMed');
    if(type === 'vaccine') { vac.classList.add('border-red-500'); med.classList.remove('border-transparent'); }
    else { med.classList.add('border-transparent'); vac.classList.remove('border-red-500'); }
}

document.addEventListener('DOMContentLoaded', () => { App.init(); });
