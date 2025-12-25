/**
 * ERP Database Wrapper v2.0
 * Supports Flocks, Inventory, Finance (Income/Expense), Health Logs
 */
class PoultryDB {
    constructor() {
        this.dbName = 'Dawajni_ERP_Full';
        this.version = 2; // Updated Version
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 1. Flocks Store (Updated Schema)
                if (!db.objectStoreNames.contains('flocks')) {
                    const flockStore = db.createObjectStore('flocks', { keyPath: 'id', autoIncrement: true });
                    flockStore.createIndex('status', 'status', { unique: false });
                }

                // 2. Inventory Store (Smart Stock)
                if (!db.objectStoreNames.contains('inventory')) {
                    const invStore = db.createObjectStore('inventory', { keyPath: 'id', autoIncrement: true });
                    invStore.createIndex('name', 'name', { unique: true });
                }

                // 3. Financial Store (Income & Expense)
                if (!db.objectStoreNames.contains('financial')) {
                    const finStore = db.createObjectStore('financial', { keyPath: 'id', autoIncrement: true });
                    finStore.createIndex('flockId', 'flockId', { unique: false });
                    finStore.createIndex('type', 'type', { unique: false }); // 'income' or 'expense'
                }

                // 4. Health Logs Store (Detailed)
                if (!db.objectStoreNames.contains('health_logs')) {
                    const healthStore = db.createObjectStore('health_logs', { keyPath: 'id', autoIncrement: true });
                    healthStore.createIndex('flockId', 'flockId', { unique: false });
                    healthStore.createIndex('type', 'type', { unique: false }); // 'vaccine' or 'medicine'
                }

                // 5. Feed Logs (Consumption)
                if (!db.objectStoreNames.contains('feed_logs')) {
                    db.createObjectStore('feed_logs', { keyPath: 'id', autoIncrement: true });
                }
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
}

const DB = new PoultryDB();
