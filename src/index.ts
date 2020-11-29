import { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next"
import { IncomingMessage, ServerResponse } from "http";

export interface SessionStore {
    id: () => Promise<string>;
    get: (sessionId: string) => Promise<any>;
    set: (sessionId: string, data: any) => Promise<any>;
    merge: (sessionId: string, data: any) => Promise<any>;
    destroy: (sessionId: string) => Promise<any>
}

export interface CookieHandler {
    read: (req: NextApiRequest | IncomingMessage) => Promise<string | undefined>;
    write: (res: NextApiResponse | ServerResponse, sessionId: string) => Promise<void>,
    destroy: (res: NextApiResponse | ServerResponse) => Promise<void>
}

const defaultCookieConfig = {
    httpOnly: true,
    sameSite: true,
    path: "/",
    secure: false
};

export function createCookieHandler(cookieName: string = "nextSession", cookieConfig: any = defaultCookieConfig): CookieHandler {
    return {
        read: async (req) => {
            const cookies = require("cookie").parse(req.headers.cookie || "");
            return cookies[cookieName];
        },
        write: async (res, sessionId) => {
            res.setHeader("Set-Cookie", require("cookie").serialize(cookieName, sessionId, cookieConfig));
        },
        destroy: async (res) => {
            res.setHeader("Set-Cookie", require("cookie").serialize(cookieName, "", Object.assign({}, cookieConfig, { expires: new Date(0) })));
        }
    }
}

let store: SessionStore;
let cookie: CookieHandler;

export interface SessionConfig {
    sessionStore?: SessionStore,
    cookieHandler?: CookieHandler
}

export function configure({ sessionStore = createMemorySessionStore(), cookieHandler = createCookieHandler() }: SessionConfig = {}) {
    store = sessionStore;
    cookie = cookieHandler;
}

function getReqRes(a: any, b?: any): [NextApiRequest | IncomingMessage, NextApiResponse | ServerResponse] {
    let req, res;
    if (b) {
        req = a as NextApiRequest;
        res = b as NextApiResponse;
    } else {
        req = a.req as IncomingMessage;
        res = a.res as ServerResponse;
    }

    return [req, res];
}

export async function getSessionId(context: GetServerSidePropsContext, persistSession?: boolean): Promise<string>;
export async function getSessionId(req: NextApiRequest, res: NextApiResponse, persistSession?: boolean): Promise<string>;
export async function getSessionId(
    a: any,
    b?: any,
    persistSession?: boolean
) {
    const [req, res] = getReqRes(a, b);
    let sessionIdFromCookie;
    let sessionId = sessionIdFromCookie = await cookie.read(req);
    if (!sessionId || !(await store.get(sessionId))) {
        sessionId = await store.id();
        if(persistSession){
            await store.set(sessionId, {});
            await cookie.write(res, sessionId);
        } else {
            if(sessionIdFromCookie){
                await cookie.destroy(res);
            }
        }
    }
    return sessionId;
}

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
        set: async (sessionId: string, data: any) => store.set(sessionId, { lastUpdate: Date.now(), data }),
        merge: async (sessionId: string, data: any) => store.set(sessionId, {
            lastUpdate: Date.now(),
            data: Object.assign({}, store.get(sessionId) ? store.get(sessionId).data : {}, data)
        }),
        destroy: async (sessionId: string) => store.delete(sessionId),
        id: async () => uuid()
    };
}

export async function getSessionData<T = any>(context: GetServerSidePropsContext): Promise<T>;
export async function getSessionData<T = any>(req: NextApiRequest, res: NextApiResponse): Promise<T>;
export async function getSessionData<T>(a: any, b?: any): Promise<T> {
    return await store.get(await getSessionId(a, b)) || {};
}

export async function replaceSessionData<T>(context: GetServerSidePropsContext, data: T): Promise<void>;
export async function replaceSessionData<T>(req: NextApiRequest, res: NextApiResponse, data: T): Promise<void>;
export async function replaceSessionData<T>(a: any, b: any, c?: T) {
    if ((a && b && !c) || a && !b && !c) {
        throw new Error("No session data given");
    }
    return store.set(await getSessionId(a, b, true), c ? c : b);
}

export async function setSessionData<T>(context: GetServerSidePropsContext, data: T): Promise<void>;
export async function setSessionData<T>(req: NextApiRequest, res: NextApiResponse, data: T): Promise<void>;
export async function setSessionData<T>(a: any, b: any, c?: T) {
    if ((a && b && !c) || a && !b && !c) {
        throw new Error("No session data given");
    }
    return store.merge(await getSessionId(a, b, true), c ? c : b);
}

export async function destroySession(context: GetServerSidePropsContext): Promise<void>;
export async function destroySession(req: NextApiRequest, res: NextApiResponse): Promise<void>;
export async function destroySession(a: any, b?: any) {
    const [, res] = getReqRes(a, b);
    const sessionId = await getSessionId(a, b);
    await store.destroy(sessionId);
    await cookie.destroy(res);
}

export async function getCSRFToken(context: GetServerSidePropsContext): Promise<string>;
export async function getCSRFToken(req: NextApiRequest, res: NextApiResponse): Promise<string>;
export async function getCSRFToken(a: any, b?: any): Promise<string> {
    const csrfToken = require("uuid").v4();
    await setSessionData(a, b, { csrfToken });
    return csrfToken;
}

export async function validateCSRFToken(context: GetServerSidePropsContext, token: string): Promise<boolean>;
export async function validateCSRFToken(req: NextApiRequest, res: NextApiResponse, token: string): Promise<boolean>;
export async function validateCSRFToken(a: any, b: any, c?: string): Promise<boolean> {
    let sessionData = await getSessionData(a, b);
    const wasValid = sessionData.csrfToken === (c ? c : b);
    delete sessionData.csrfToken;
    await setSessionData(a, b, sessionData);
    return wasValid;
}
