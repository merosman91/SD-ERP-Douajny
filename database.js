/**
 * DB Class - Wrapper for IndexedDB
 */
class PoultryDB {
    constructor() {
        this.dbName = 'Dawajni_SingleFarm';
        this.version = 3;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Stores needed for Single Farm
                if (!db.objectStoreNames.contains('current_cycle')) db.createObjectStore('current_cycle', { keyPath: 'id', autoIncrement: true });
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

    transaction(storeName, mode, callback) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const request = callback(store);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async add(storeName, data) { return this.transaction(storeName, 'readwrite', store => store.add(data)); }
    async getAll(storeName) { return this.transaction(storeName, 'readonly', store => store.getAll()); }
    async get(storeName, key) { return this.transaction(storeName, 'readonly', store => store.get(key)); }
    async update(storeName, data) { return this.transaction(storeName, 'readwrite', store => store.put(data)); }
    async delete(storeName, key) { return this.transaction(storeName, 'readwrite', store => store.delete(key)); }
    async getAllByIndex(storeName, indexName, key) { return new Promise((resolve, reject) => { const tx = this.db.transaction(storeName, 'readonly'); const store = tx.objectStore(storeName); const index = store.index(indexName); const request = index.getAll(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
}

const DB = new PoultryDB();
