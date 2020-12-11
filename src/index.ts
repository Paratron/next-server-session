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

/**
 * In order to be able to use the session mechanism, it needs to be initialized once on server startup.
 *
 * {@link https://github.com/Paratron/next-server-session#configure|More Information}
 */
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
        if(b.json || b.socket){
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

/**
 * This method returns the current session object. If no session has been established so far, an empty object will be returned. Calling this method will _not_ establish a session and will _not_ set a cookie for your visitors.
 *
 * {@link https://github.com/Paratron/next-server-session#getSessionData|More Information}
 */
export async function getSessionData<T = any>(context: GetServerSidePropsContext): Promise<T>;
/**
 * This method returns the current session object. If no session has been established so far, an empty object will be returned. Calling this method will _not_ establish a session and will _not_ set a cookie for your visitors.
 *
 * {@link https://github.com/Paratron/next-server-session#getSessionData|More Information}
 */
export async function getSessionData<T = any>(req: NextApiRequest, res: NextApiResponse): Promise<T>;
/**
 * This method returns the current session object. If no session has been established so far, an empty object will be returned. Calling this method will _not_ establish a session and will _not_ set a cookie for your visitors.
 *
 * {@link https://github.com/Paratron/next-server-session#getSessionData|More Information}
 */
export async function getSessionData<T>(a: any, b?: any): Promise<T> {
    return await store.get(await getSessionId(a, b)) || {};
}

/**
 * Removes a property from the session object and returns it. Will return `null`, if the property does not exist.
 *
 * {@link https://github.com/Paratron/next-server-session#pluckSessionProperty|More Information}
 */
export async function pluckSessionProperty<T = any>(context: GetServerSidePropsContext, propertyName: string): Promise<T | null>;
/**
 * Removes a property from the session object and returns it. Will return `null`, if the property does not exist.
 *
 * {@link https://github.com/Paratron/next-server-session#pluckSessionProperty|More Information}
 */
export async function pluckSessionProperty<T = any>(req: NextApiRequest, res: NextApiResponse, propertyName: string): Promise<T | null>;
/**
 * Removes a property from the session object and returns it. Will return `null`, if the property does not exist.
 *
 * {@link https://github.com/Paratron/next-server-session#pluckSessionProperty|More Information}
 */
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

/**
 * This method will replace the whole session object with a new one. This will overwrite/remove all existing session data, so be careful when using it.
 *
 * {@link https://github.com/Paratron/next-server-session#replaceSessionData|More Information}
 */
export async function replaceSessionData<T>(context: GetServerSidePropsContext, data: T): Promise<void>;
/**
 * This method will replace the whole session object with a new one. This will overwrite/remove all existing session data, so be careful when using it.
 *
 * {@link https://github.com/Paratron/next-server-session#replaceSessionData|More Information}
 */
export async function replaceSessionData<T>(req: NextApiRequest, res: NextApiResponse, data: T): Promise<void>;
/**
 * This method will replace the whole session object with a new one. This will overwrite/remove all existing session data, so be careful when using it.
 *
 * {@link https://github.com/Paratron/next-server-session#replaceSessionData|More Information}
 */
export async function replaceSessionData<T>(a: any, b: any, c?: T) {
    const [, res] = getReqRes(a, b);
    const data = b === res ? c : b;
    if (data === undefined) {
        throw new Error("No session data given");
    }
    return store.set(await getSessionId(a, b, true), c ? c : b);
}

/**
 * This method takes an object and merges it into a existing session object. Only given keys will be overwritten, the rest of the session object will be preserved. Calling the method will establish a new session, if none exists and write a session cookie.
 *
 * {@link https://github.com/Paratron/next-server-session#setSessionData|More Information}
 */
export async function setSessionData<T>(context: GetServerSidePropsContext, data: T): Promise<void>;
/**
 * This method takes an object and merges it into a existing session object. Only given keys will be overwritten, the rest of the session object will be preserved. Calling the method will establish a new session, if none exists and write a session cookie.
 *
 * {@link https://github.com/Paratron/next-server-session#setSessionData|More Information}
 */
export async function setSessionData<T>(req: NextApiRequest, res: NextApiResponse, data: T): Promise<void>;
/**
 * This method takes an object and merges it into a existing session object. Only given keys will be overwritten, the rest of the session object will be preserved. Calling the method will establish a new session, if none exists and write a session cookie.
 *
 * {@link https://github.com/Paratron/next-server-session#setSessionData|More Information}
 */
export async function setSessionData<T>(a: any, b: any, c?: T) {
    const data = isContext(a) ? b : c;
    if (data === undefined) {
        throw new Error("No session data given");
    }
    return store.merge(await getSessionId(a, b, true), c ? c : b);
}

/**
 * This will drop the session data from the session store and mark the cookie to be expired and removed by the browser.
 *
 * {@link https://github.com/Paratron/next-server-session#destroySession|More Information}
 */
export async function destroySession(context: GetServerSidePropsContext): Promise<void>;
/**
 * This will drop the session data from the session store and mark the cookie to be expired and removed by the browser.
 *
 * {@link https://github.com/Paratron/next-server-session#destroySession|More Information}
 */
export async function destroySession(req: NextApiRequest, res: NextApiResponse): Promise<void>;
/**
 * This will drop the session data from the session store and mark the cookie to be expired and removed by the browser.
 *
 * {@link https://github.com/Paratron/next-server-session#destroySession|More Information}
 */
export async function destroySession(a: any, b?: any) {
    const [, res] = getReqRes(a, b);
    const sessionId = await getSessionId(a, b);
    await store.destroy(sessionId);
    await cookie.destroy(res);
}

/**
 * This method generates a random string, stores it in the session and returns it. Use the CSRF token to prevent [cross site request forgery](https://owasp.org/www-community/attacks/csrf).
 *
 * {@link https://github.com/Paratron/next-server-session#getCSRFToken|More Information}
 */
export async function getCSRFToken(context: GetServerSidePropsContext): Promise<string>;
/**
 * This method generates a random string, stores it in the session and returns it. Use the CSRF token to prevent [cross site request forgery](https://owasp.org/www-community/attacks/csrf).
 *
 * {@link https://github.com/Paratron/next-server-session#getCSRFToken|More Information}
 */
export async function getCSRFToken(req: NextApiRequest, res: NextApiResponse): Promise<string>;
/**
 * This method generates a random string, stores it in the session and returns it. Use the CSRF token to prevent [cross site request forgery](https://owasp.org/www-community/attacks/csrf).
 *
 * {@link https://github.com/Paratron/next-server-session#getCSRFToken|More Information}
 */
export async function getCSRFToken(a: any, b?: any): Promise<string> {
    const csrfToken = require("uuid").v4();
    const [req, res] = getReqRes(a, b);
    await setSessionData(req as NextApiRequest, res as NextApiResponse, { csrfToken });
    return csrfToken;
}

/**
 * This method validates a given csrf token against a previously generated random token already stored in the session. This is used to prevent [cross site request forgery](https://owasp.org/www-community/attacks/csrf) attacks. Use this to protect any requests that perform actions in behalf of a user.
 *
 * {@link https://github.com/Paratron/next-server-session#validateCSRFToken|More Information}
 */
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

export {
    createCookieHandler,
    createMemorySessionStore
}
