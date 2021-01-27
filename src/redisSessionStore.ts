import { SessionStore } from "./memorySessionStore"

function prefix(inKey: string): string{
    return `sess_${inKey}`;
}

export function createRedisSessionStore(maxSessionAgeMS = 30 * 60 * 1000, host?: string, port?: number, db?: number): SessionStore {
    const { v4: uuid } = require("uuid");

    const maxSessionAgeSeconds = Math.floor(maxSessionAgeMS / 1000);

    const Redis = require("ioredis");
    const redis = new Redis({
        host,
        port,
        db
    });

    return {
        get: async (sessionId: string) => {
            const value = await redis.get(prefix(sessionId));
            if (value) {
                redis.expire(prefix(sessionId), maxSessionAgeSeconds);
                return JSON.parse(value);
            }
            return null;
        },
        set: async (sessionId: string, data: any) => {
            await redis.setex(prefix(sessionId), maxSessionAgeSeconds, JSON.stringify(data));
        },
        merge: async (sessionId: string, data: any) => {
            const value = await redis.get(prefix(sessionId));
            await redis.setex(prefix(sessionId), maxSessionAgeSeconds, JSON.stringify(
                Object.assign({}, value ? JSON.parse(value) : {}, data)
            ));
        },
        destroy: async (sessionId: string) => {
            redis.del(prefix(sessionId));
        },
        id: async () => uuid()
    };
}
