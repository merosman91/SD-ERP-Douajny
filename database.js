/**
 * ERP Database v3 - Production Cycle Ready
 */
class PoultryDB {
    constructor() {
        this.dbName = 'Dawajni_ERP_FullCycle';
        this.version = 3;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Stores
                if (!db.objectStoreNames.contains('flocks')) {
                    const store = db.createObjectStore('flocks', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('status', 'status', { unique: false });
                }
                if (!db.objectStoreNames.contains('inventory')) db.createObjectStore('inventory', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('financial')) db.createObjectStore('financial', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('health_logs')) db.createObjectStore('health_logs', { keyPath: 'id', autoIncrement: true });
                
                // NEW: Daily Logs Store
                if (!db.objectStoreNames.contains('daily_logs')) {
                    const logStore = db.createObjectStore('daily_logs', { keyPath: 'id', autoIncrement: true });
                    logStore.createIndex('flockId', 'flockId', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Wrapper for cleaner code
    transaction(storeName, mode, callback) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const request = callback(store);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // CRUD
    async add(storeName, data) { return this.transaction(storeName, 'readwrite', store => store.add(data)); }
    async update(storeName, data) { return this.transaction(storeName, 'readwrite', store => store.put(data)); }
    async getAll(storeName) { return this.transaction(storeName, 'readonly', store => store.getAll()); }
    async get(storeName, key) { return this.transaction(storeName, 'readonly', store => store.get(key)); }
    async delete(storeName, key) { return this.transaction(storeName, 'readwrite', store => store.delete(key)); }
    async getAllByIndex(storeName, indexName, key) { return new Promise((resolve, reject) => { const tx = this.db.transaction(storeName, 'readonly'); const store = tx.objectStore(storeName); const index = store.index(indexName); const request = index.getAll(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
    
    // Backup & Restore
    async exportData() {
        const stores = ['flocks', 'inventory', 'financial', 'health_logs', 'daily_logs'];
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
                    if(data.flocks) {
                        for (const storeName in data) {
                            const items = data[storeName];
                            for (const item of items) { await this.add(storeName, item); }
                        }
                        resolve(true);
                    } else reject('Invalid File');
                } catch(err) { reject(err); }
            };
            reader.readAsText(file);
        });
    }
}

const DB = new PoultryDB();
