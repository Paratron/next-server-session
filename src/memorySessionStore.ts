export interface SessionStore {
    id: () => Promise<string>;
    get: (sessionId: string) => Promise<any>;
    set: (sessionId: string, data: any) => Promise<void>;
    merge: (sessionId: string, data: any) => Promise<void>;
    destroy: (sessionId: string) => Promise<any>
}

/**
 * Returns a new session store for in-memory storage of session objects. By default, it will keep session objects for 30 minutes after they have been interacted with the last time (by getting or setting).
 *
 * {@link https://github.com/Paratron/next-server-session#creatememorysessionstoremaxsessionagems-number-sessionstore|More Information}
 */
export function createMemorySessionStore(maxSessionAgeMS = 30 * 60 * 1000): SessionStore {
    const { v4: uuid } = require("uuid");

    const store = new Map();

    setInterval(() => {
        Array.from(store.entries()).forEach(([sessionId, value]) => {
            if (value.lastUpdate < Date.now() - maxSessionAgeMS) {
                store.delete(sessionId);
            }
        });
    }, 10000);

    return {
        get: async (sessionId: string) => {
            let value = store.get(sessionId);
            if (value) {
                value.lastUpdate = Date.now();
                store.set(sessionId, value);
                return value.data;
            }
            return null;
        },
        set: async (sessionId: string, data: any) => {store.set(sessionId, { lastUpdate: Date.now(), data })},
        merge: async (sessionId: string, data: any) => {store.set(sessionId, {
            lastUpdate: Date.now(),
            data: Object.assign({}, store.get(sessionId) ? store.get(sessionId).data : {}, data)
        })},
        destroy: async (sessionId: string) => store.delete(sessionId),
        id: async () => uuid()
    };
}
