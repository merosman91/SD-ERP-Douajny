/**
 * ERP Database v6.0 - Safety Rebuild Mode
 * Forces deletion of corrupt tables and recreates them with correct indexes.
 */
class PoultryDB {
    constructor() {
        this.dbName = 'Dawajni_SingleFarm';
        this.version = 6; // تم الرفع إلى 6 لفرض الحذف وإعادة البناء
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const tx = event.transaction; // Available for version change

                console.log(`[DB] Upgrading from ${event.oldVersion} to 6`);

                // 1. CLEAN UP (Destructive but safe for this case)
                // نحذف المتاجر التي قد تكون تالفة من الإصدارات السابقة
                if (db.objectStoreNames.contains('daily_logs')) db.deleteObjectStore('daily_logs');
                if (db.objectStoreNames.contains('health_records')) db.deleteObjectStore('health_records');
                if (db.objectStoreNames.contains('current_cycle')) db.deleteObjectStore('current_cycle');
                // (لا نحذف inventory و financial لأنها لا تحتاج لمؤشر cycleId في نسختنا الحالية)

                // 2. RECREATE CORRECTLY
                // Store: Daily Logs
                const logStore = db.createObjectStore('daily_logs', { keyPath: 'id', autoIncrement: true });
                // إنشاء المؤشر الصحيح: 'cycleId'
                logStore.createIndex('cycleId', 'cycleId', { unique: false });

                // Store: Health Records
                const healthStore = db.createObjectStore('health_records', { keyPath: 'id', autoIncrement: true });
                healthStore.createIndex('cycleId', 'cycleId', { unique: false });

                // Store: Current Cycle (Single Farm)
                const cycleStore = db.createObjectStore('current_cycle', { keyPath: 'id', autoIncrement: true });
                
                // Stores: Inventory & Financial (No index needed in this version)
                if (!db.objectStoreNames.contains('inventory')) db.createObjectStore('inventory', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('financial')) db.createObjectStore('financial', { keyPath: 'id', autoIncrement: true });
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("[DB] Database Opened Successfully (v6)");
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error("[DB] Failed to open DB", event.target.errorCode);
                reject('Database error: ' + event.target.errorCode);
            };
        });
    }

    // Generic Transaction Wrapper (Safe)
    transaction(storeName, mode, callback) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const request = callback(store);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // CRUD Operations
    async add(storeName, data) { return this.transaction(storeName, 'readwrite', store => store.add(data)); }
    async update(storeName, data) { return this.transaction(storeName, 'readwrite', store => store.put(data)); }
    async getAll(storeName) { return this.transaction(storeName, 'readonly', store => store.getAll()); }
    async get(storeName, key) { return this.transaction(storeName, 'readonly', store => store.get(key)); }
    async delete(storeName, key) { return this.transaction(storeName, 'readwrite', store => store.delete(key)); }
    
    // Helper: Get All with Index
    async getAllByIndex(storeName, indexName, key) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Backup & Restore
    async exportData() {
        const stores = ['current_cycle', 'inventory', 'financial', 'health_records', 'daily_logs'];
        const data = {};
        for (const store of stores) { data[store] = await this.getAll(store); }
        const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Dawajni_Backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    for (const storeName in data) {
                        const items = data[storeName];
                        for (const item of items) {
                            await this.add(storeName, item);
                        }
                    }
                    resolve(true);
                } catch (err) { reject(err); }
            };
            reader.readAsText(file);
        });
    }
}

const DB = new PoultryDB();
