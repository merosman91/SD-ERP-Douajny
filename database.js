/**
 * ERP Database Wrapper for IndexedDB
 */
class PoultryDB {
    constructor() {
        this.dbName = 'Dawajni_ERP_Pro';
        this.version = 2;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('flocks')) db.createObjectStore('flocks', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('inventory')) db.createObjectStore('inventory', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('feed_logs')) db.createObjectStore('feed_logs', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('financial')) db.createObjectStore('financial', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('health_logs')) db.createObjectStore('health_logs', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('quality')) db.createObjectStore('quality', { keyPath: 'id', autoIncrement: true });
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
            request.onerror = (event) => reject(event.target.error);
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

    async getAll(storeName) { return this.transaction(storeName, 'readonly', store => store.getAll()); }
    async add(storeName, data) { return this.transaction(storeName, 'readwrite', store => store.add(data)); }
    async update(storeName, data) { return this.transaction(storeName, 'readwrite', store => store.put(data)); }
    async delete(storeName, key) { return this.transaction(storeName, 'readwrite', store => store.delete(key)); }

    // --- BACKUP & RESTORE ---
    async exportData() {
        const stores = ['flocks', 'inventory', 'feed_logs', 'financial', 'health_logs', 'quality'];
        const data = {};
        for (const store of stores) {
            data[store] = await this.getAll(store);
        }
        const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Dawajni_Backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
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
