const App = {
    state: { currentFlockId: null, config: { pin: '1234', currency: 'SAR' } },

    init: async function() {
        try {
            await DB.init();
            const logged = localStorage.getItem('erp_pro_login');
            if(logged) {
                this.startApp();
            } else {
                setTimeout(() => {
                    document.getElementById('splashScreen').classList.add('hidden');
                    document.getElementById('loginScreen').classList.remove('hidden');
                }, 2000);
            }
        } catch(e) { console.error("DB Init Error", e); alert("خطأ في تحميل قاعدة البيانات"); }
    },

    login: function() {
        const pin = document.getElementById('pinInput').value;
        if(pin === this.state.config.pin) {
            localStorage.setItem('erp_pro_login', 'true');
            document.getElementById('loginScreen').classList.add('hidden');
            this.startApp();
        } else alert('رمز خاطئ');
    },

    startApp: function() {
        document.getElementById('appContainer').classList.remove('hidden');
        this.router('dashboard');
    },

    router: async function(screenId, params = {}) {
        const c = document.getElementById('mainContent');
        const h = document.getElementById('headerTitle');
        const back = document.getElementById('backBtn');
        const nav = document.getElementById('mainNav');
        
        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        const isRoot = ['dashboard', 'flocks', 'inventory', 'reports', 'settings', 'quality'].includes(screenId);
        
        if (isRoot) { nav.classList.remove('hidden'); back.classList.add('hidden'); this.updateNav(screenId); }
        else { nav.classList.add('hidden'); back.classList.remove('hidden'); }

        if(params.flockId) this.state.currentFlockId = params.flockId;

        // Routes
        switch(screenId) {
            case 'dashboard': await Views.renderDashboard(c, h); break;
            case 'flocks': await Views.renderFlocks(c, h); break;
            case 'inventory': await Views.renderInventory(c, h); break;
            case 'quality': await Views.renderQuality(c, h); break;
            case 'reports': await Views.renderReports(c, h); break;
            case 'settings': await Views.renderSettings(c, h); break;
            case 'addFlock': await Views.renderAddFlock(c, h); break;
            case 'flockDetails': await Views.renderFlockDetails(c, h, this.state.currentFlockId); break;
            default: c.innerHTML = 'جاري التطوير...';
        }
    },

    updateNav: function(target) {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('text-emerald-500'); btn.classList.add('text-slate-400');
            if(btn.dataset.target === target) { btn.classList.add('text-emerald-500'); btn.classList.remove('text-slate-400'); }
        });
    },
    
    goBack: function() { this.router('flocks'); },

    // LOGIC: KPIs
    calculateDashboardKPIs: async function() {
        const flocks = await DB.getAll('flocks');
        const active = flocks.filter(f => f.status === 'active');
        const birds = active.reduce((a,b) => a + parseInt(b.count), 0);
        const fin = await DB.getAll('financial');
        const profit = fin.reduce((a,b) => a + (b.type === 'income' ? b.amount : -b.amount), 0);
        
        // Dummy FCR Calc
        const feed = await DB.getAll('feed_logs');
        const totalFeed = feed.reduce((a,b) => a + parseFloat(b.amount), 0);
        const fcr = birds ? (totalFeed / (birds * 1.5)).toFixed(2) : 0; // Dummy avg weight logic

        return { flocks: flocks.length, birds, profit, fcr };
    }
};

const Views = {
    renderDashboard: async function(c, h) {
        const kpi = await App.calculateDashboardKPIs();
        h.innerText = 'لوحة المدير';
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-4 rounded-2xl shadow-lg shadow-emerald-500/20">
                        <p class="text-emerald-100 text-xs font-bold uppercase">الدورات النشطة</p>
                        <h2 class="text-3xl font-black">${kpi.flocks}</h2>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-2xl shadow-sm border-b-4 border-blue-500">
                        <p class="text-slate-400 text-xs font-bold">عدد الطيور</p>
                        <h2 class="text-2xl font-black dark:text-white">${kpi.birds.toLocaleString()}</h2>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-2xl shadow-sm border-b-4 border-orange-500">
                        <p class="text-slate-400 text-xs font-bold">FCR (متوسط)</p>
                        <h2 class="text-2xl font-black dark:text-primary">${kpi.fcr}</h2>
                    </div>
                    <div class="bg-white dark:bg-darkcard p-4 rounded-2xl shadow-sm border-b-4 border-green-500">
                        <p class="text-slate-400 text-xs font-bold">صافي الربح</p>
                        <h2 class="text-xl font-black text-green-600 dark:text-green-400">${kpi.profit.toLocaleString()}</h2>
                    </div>
                </div>
                
                <!-- Quick Actions -->
                <div class="bg-white dark:bg-darkcard p-4 rounded-2xl shadow-sm">
                    <h3 class="font-bold dark:text-white mb-3">إجراءات سريعة</h3>
                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="App.router('addFlock')" class="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold dark:text-white hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition">دفعة جديدة</button>
                        <button onclick="App.router('quality')" class="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold dark:text-white hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">فحص جودة</button>
                        <button onclick="App.router('inventory')" class="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold dark:text-white hover:bg-orange-50 dark:hover:bg-orange-900/20 transition">جرد مخزون</button>
                        <button onclick="App.router('reports')" class="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold dark:text-white hover:bg-purple-50 dark:hover:bg-purple-900/20 transition">تقرير أداء</button>
                    </div>
                </div>
            </div>`;
    },

    renderQuality: async function(c, h) {
        h.innerText = 'إدارة الجودة';
        const qLogs = await DB.getAll('quality');
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="bg-blue-600 text-white p-4 rounded-2xl shadow-lg">
                    <h3 class="font-bold text-lg mb-1">نظام ضبط الجودة (QA)</h3>
                    <p class="text-blue-100 text-xs">تتبع منتظمية الطيور ووزن التسليم</p>
                </div>
                
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                    <h4 class="font-bold dark:text-white mb-3">تسجيل فحص جديد</h4>
                    <div class="space-y-3">
                        <input id="qaFlock" type="text" placeholder="اسم الدفعة" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white">
                        <input id="qaWeight" type="number" placeholder="متوسط الوزن (جرام)" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white">
                        <input id="qaNotes" type="text" placeholder="ملاحظات (لون الريش، أمراض)" class="w-full p-2 border rounded dark:bg-slate-800 dark:text-white">
                        <button onclick="Actions.addQuality()" class="w-full bg-blue-600 text-white py-2 rounded-xl font-bold">حفظ الفحص</button>
                    </div>
                </div>

                <div class="space-y-2">
                    ${qLogs.map(q => `
                        <div class="bg-white dark:bg-darkcard p-3 rounded-xl shadow-sm border-r-4 ${q.weight < 1500 ? 'border-red-500' : 'border-green-500'}">
                            <div class="flex justify-between">
                                <span class="font-bold text-sm dark:text-white">${q.flockName}</span>
                                <span class="text-xs text-slate-400">${q.date}</span>
                            </div>
                            <div class="flex justify-between mt-1">
                                <span class="text-xs font-bold dark:text-white">وزن: ${q.weight}g</span>
                                <span class="text-xs text-slate-500">${q.notes}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    },

    renderReports: async function(c, h) {
        h.innerText = 'التقارير الذكية';
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="bg-white dark:bg-darkcard p-6 rounded-2xl shadow-sm text-center">
                    <h2 class="text-4xl font-black text-primary mb-2">تحليل الأداء</h2>
                    <p class="text-slate-400 text-sm">يتم تحديث التقارير بناءً على البيانات المسجلة</p>
                </div>
                
                <div class="grid grid-cols-1 gap-4">
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center"><i class="fa-solid fa-chart-line"></i></div>
                            <div>
                                <h4 class="font-bold dark:text-white">تقرير النفوق والهلاك</h4>
                                <p class="text-xs text-slate-400">تحليل أسباب النفوق حسب الأسبوع</p>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-left text-slate-300 dark:text-slate-600"></i>
                    </div>
                    
                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center"><i class="fa-solid fa-scale-balanced"></i></div>
                            <div>
                                <h4 class="font-bold dark:text-white">تحليل معدل التحويل (FCR)</h4>
                                <p class="text-xs text-slate-400">مقارنة الاستهلاك بالوزن</p>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-left text-slate-300 dark:text-slate-600"></i>
                    </div>

                    <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><i class="fa-solid fa-coins"></i></div>
                            <div>
                                <h4 class="font-bold dark:text-white">الكفاءة المالية</h4>
                                <p class="text-xs text-slate-400">تكلفة الإنتاج لكل طائر</p>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-left text-slate-300 dark:text-slate-600"></i>
                    </div>
                </div>
            </div>`;
    },

    renderSettings: async function(c, h) {
        h.innerText = 'الإعدادات';
        c.innerHTML = `
            <div class="screen active space-y-4">
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm">
                    <h3 class="font-bold dark:text-white mb-4">إدارة البيانات (ERP)</h3>
                    <button onclick="DB.exportData()" class="w-full mb-3 bg-blue-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><i class="fa-solid fa-download"></i> نسخ احتياطي (Backup)</button>
                    <div class="relative">
                        <input type="file" id="restoreFile" class="hidden" onchange="Actions.restoreData(this)">
                        <button onclick="document.getElementById('restoreFile').click()" class="w-full bg-orange-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><i class="fa-solid fa-upload"></i> استرجاع البيانات</button>
                    </div>
                </div>
                <div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm border border-red-100">
                    <button class="w-full text-red-500 font-bold text-sm">تسجيل الخروج</button>
                </div>
            </div>`;
    },

    // Other Views (Placeholders for brevity, implement similar to previous versions)
    renderFlocks: async function(c, h) { const flocks = await DB.getAll('flocks'); h.innerText = 'الدورات'; c.innerHTML = `<div class="screen active space-y-4">${flocks.map(f => `<div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm cursor-pointer"><h3 class="font-bold dark:text-white">${f.name}</h3></div>`).join('')}</div>`; },
    renderInventory: async function(c, h) { const items = await DB.getAll('inventory'); h.innerText = 'المخزون'; c.innerHTML = `<div class="screen active grid grid-cols-2 gap-3">${items.map(i => `<div class="bg-white dark:bg-darkcard p-4 rounded-xl shadow-sm text-center"><h4 class="font-bold dark:text-white">${i.name}</h4><p class="text-2xl font-black text-primary">${i.qty}</p></div>`).join('')}</div>`; },
    renderAddFlock: function(c, h) { h.innerText = 'دورة جديدة'; c.innerHTML = `<div class="screen active"><div class="bg-white dark:bg-darkcard p-4 rounded-xl"><h3 class="font-bold dark:text-white mb-4">بيانات الدورة</h3><input id="fName" class="w-full mb-2 p-2 border rounded dark:bg-slate-800" placeholder="اسم الدفعة"><button onclick="Actions.addFlock()" class="w-full bg-primary text-white py-3 rounded-xl font-bold">حفظ</button></div></div>`; },
    renderFlockDetails: async function(c, h, id) { h.innerText = 'التفاصيل'; c.innerHTML = `<div class="screen active text-center p-10 text-slate-400">تفاصيل الدورة ID: ${id}</div>`; },
};

const Actions = {
    addFlock: async function() {
        const name = document.getElementById('fName').value;
        if(name) { await DB.add('flocks', { name, status: 'active', count: 5000, breed: 'Ross 308', startDate: new Date().toISOString() }); App.router('flocks'); }
    },
    addQuality: async function() {
        const flock = document.getElementById('qaFlock').value;
        const weight = document.getElementById('qaWeight').value;
        const notes = document.getElementById('qaNotes').value;
        if(weight) { await DB.add('quality', { flockName: flock, weight, notes, date: new Date().toLocaleDateString() }); App.router('quality'); }
    },
    restoreData: async function(input) {
        const file = input.files[0];
        if(!file) return;
        await DB.importData(file);
        alert('تم استرجاع البيانات بنجاح');
        location.reload();
    }
};

document.addEventListener('DOMContentLoaded', () => { App.init(); });
