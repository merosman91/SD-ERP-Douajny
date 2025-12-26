/**
 * ERP Database Wrapper v4.0 - Force Update Fix
 */
class PoultryDB {
    constructor() {
        this.dbName = 'Dawajni_SingleFarm';
        this.version = 4; // تم تغيير الرقم من 3 إلى 4 لفرض التحديث
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // حذف المتاجر القديمة (Cleanup) لتجنب التعارض
                if (event.oldVersion < 3) {
                    const existingStores = Array.from(db.objectStoreNames);
                    existingStores.forEach(storeName => {
                        if(storeName !== 'flocks') { // حماية نسخ التجريبية
                             db.deleteObjectStore(storeName);
                        }
                    });
                }

                // إنشاء المتاجر الجديدة للنسخة الأخيرة
                if (!db.objectStoreNames.contains('current_cycle')) {
                    const store = db.createObjectStore('current_cycle', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('status', 'status', { unique: false });
                }
                if (!db.objectStoreNames.contains('daily_logs')) db.createObjectStore('daily_logs', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('inventory')) db.createObjectStore('inventory', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('financial')) db.createObjectStore('financial', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('health_records')) db.createObjectStore('health_records', { keyPath: 'id', autoIncrement: true });
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
            request.onerror = (event) => reject('Database error: ' + event.target.errorCode);
        });
    }

    // Generic Transaction Wrapper
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
    async delete(storeName, key) { return this.transaction(storeName, 'readwrite', store => store.delete(key)); }
    async getAll(storeName) { return this.transaction(storeName, 'readonly', store => store.getAll()); }
    async get(storeName, key) { return this.transaction(storeName, 'readonly', store => store.get(key)); }
    
    // Helper: Get All with Filter
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
    
    // --- BACKUP & RESTORE ---
    async exportData() {
        const stores = ['current_cycle', 'inventory', 'financial', 'health_logs', 'daily_logs'];
        const data = {};
        for (const store of stores) {
            data[store] = await this.getAll(store);
        }
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
                    // Clear current DB (Optional, for cleaner restore)
                    // await this.deleteAll(); 
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
