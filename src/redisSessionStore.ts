import { SessionStore } from "./memorySessionStore"

export function createRedisSessionStore(maxSessionAgeMS = 30 * 60 * 1000, host?: string, port?: number, db?: number): SessionStore {
    const { v4: uuid } = require("uuid");
    const { promisify } = require("util");

    const maxSessionAgeSeconds = Math.floor(maxSessionAgeMS / 1000);

    const redis = require("redis").createClient({
        host,
        port,
        db
    });
    const getAsync = promisify(redis.get).bind(redis);
    const setExAsync = promisify(redis.setex).bind(redis);

    return {
        get: async (sessionId: string) => {
            const value = await getAsync(`sess_${sessionId}`);
            if (value) {
                redis.sendCommand(`TOUCH sess_${sessionId}`);
                return JSON.parse(value);
            }
            return null;
        },
        set: async (sessionId: string, data: any) => {
            await setExAsync(`sess_${sessionId}`, maxSessionAgeSeconds, JSON.stringify(data));
        },
        merge: async (sessionId: string, data: any) => {
            const value = await getAsync(`sess_${sessionId}`);
            await setExAsync(`sess_${sessionId}`, maxSessionAgeSeconds, JSON.stringify(
                Object.assign({}, value || {}, data)
            ));
        },
        destroy: async (sessionId: string) => {
            redis.del(`sess_${sessionId}`);
        },
        id: async () => uuid()
    };
}
