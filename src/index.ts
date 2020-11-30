import { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next"
import { IncomingMessage, ServerResponse } from "http";
import { CookieHandler, createCookieHandler } from "./cookieHandler"
import { createMemorySessionStore, SessionStore } from "./memorySessionStore"

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

const isContext = (v: any): boolean => v.req && v.res;

function getReqRes(a: any, b?: any): [NextApiRequest | IncomingMessage, NextApiResponse | ServerResponse] {
    let req, res;
    if (a.req && a.res) {
        req = a.req as IncomingMessage;
        res = a.res as ServerResponse;
    } else {
        if(b.json){
            req = a as NextApiRequest;
            res = b as NextApiResponse;
        } else {
            throw new Error("Either pass a GetServerSidePropsContext as first argument, OR NextApiRequest and NextApiResponse as first and second argument.");
        }
    }

    return [req, res];
}

export async function getSessionId(context: GetServerSidePropsContext, persistSession?: boolean): Promise<string>;
export async function getSessionId(req: NextApiRequest, res: NextApiResponse, persistSession?: boolean): Promise<string>;
export async function getSessionId(
    a: any,
    b?: any,
    c?: boolean
) {
    const [req, res] = getReqRes(a, b);
    const persistSession = isContext(a) ? b : c;
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

export async function getSessionData<T = any>(context: GetServerSidePropsContext): Promise<T>;
export async function getSessionData<T = any>(req: NextApiRequest, res: NextApiResponse): Promise<T>;
export async function getSessionData<T>(a: any, b?: any): Promise<T> {
    return await store.get(await getSessionId(a, b)) || {};
}

export async function pluckSessionProperty<T = any>(context: GetServerSidePropsContext, propertyName: string): Promise<T | null>;
export async function pluckSessionProperty<T = any>(req: NextApiRequest, res: NextApiResponse, propertyName: string): Promise<T | null>;
export async function pluckSessionProperty<T>(a: any, b?: any, c?: string): Promise<T | null> {
    const [req, res] = getReqRes(a, b);
    const propertyName = isContext(a) ? b || c : c;

    if (!propertyName) {
        throw new Error("No propertyName given");
    }

    let data = await getSessionData(req as NextApiRequest, res as NextApiResponse);

    if(data[propertyName] === undefined){
        return null;
    }
    const result = data[propertyName];
    delete data[propertyName];
    await replaceSessionData(req as NextApiRequest, res as NextApiResponse, data);
    return result;
}

export async function replaceSessionData<T>(context: GetServerSidePropsContext, data: T): Promise<void>;
export async function replaceSessionData<T>(req: NextApiRequest, res: NextApiResponse, data: T): Promise<void>;
export async function replaceSessionData<T>(a: any, b: any, c?: T) {
    const [, res] = getReqRes(a, b);
    const data = b === res ? c : b;
    if (data === undefined) {
        throw new Error("No session data given");
    }
    return store.set(await getSessionId(a, b, true), c ? c : b);
}

export async function setSessionData<T>(context: GetServerSidePropsContext, data: T): Promise<void>;
export async function setSessionData<T>(req: NextApiRequest, res: NextApiResponse, data: T): Promise<void>;
export async function setSessionData<T>(a: any, b: any, c?: T) {
    const data = isContext(a) ? b : c;
    if (data === undefined) {
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
    const [req, res] = getReqRes(a, b);
    await setSessionData(req as NextApiRequest, res as NextApiResponse, { csrfToken });
    return csrfToken;
}

export async function validateCSRFToken(context: GetServerSidePropsContext, token: string): Promise<boolean>;
export async function validateCSRFToken(req: NextApiRequest, res: NextApiResponse, token: string): Promise<boolean>;
export async function validateCSRFToken(a: any, b: any, c?: string): Promise<boolean> {
    const [req, res] = getReqRes(a, b);
    let sessionData = await getSessionData(req as NextApiRequest, res as NextApiResponse);
    const wasValid = sessionData.csrfToken === (isContext(a) ? b : c);
    delete sessionData.csrfToken;
    await setSessionData(req as NextApiRequest, res as NextApiResponse, sessionData);
    return wasValid;
}
