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
    read: (cookieName: string) => Promise<string>;
    write: (cookieName: string, sessionId: string) => Promise<void>
}

export interface SessionConfig {
    sessionMaxAgeMS?: number;
    sessionGetter?: sessionGetterFunction;
    sessionSetter?: sessionSetterFunction;
}

export type sessionGetterFunction = (sessionId: string) => Promise<any>;
export type sessionSetterFunction = (sessionId: string, data: any) => Promise<any>;
export type sessionDestroyerFunction = (sessionId: string) => Promise<any>;

let sessionRead: sessionGetterFunction;
let sessionWrite: sessionSetterFunction;
let sessionMerge: sessionSetterFunction;
let sessionDestroy: sessionDestroyerFunction;

export function configure({sessionMaxAgeMS = 30 * 60 * 1000, sessionGetter, sessionSetter}: SessionConfig = {}){
    if(!sessionGetter || !sessionSetter){
        const sessions = new Map();

        sessionRead = async (sessionId: string) => sessions.get(sessionId)?.data;
        sessionWrite = async (sessionId: string, data: any) => sessions.set(sessionId, {lastChange: Date.now(), data});
        sessionMerge = async (sessionId: string, data: any) => sessions.set(sessionId, {lastChange: Date.now(), data: Object.assign({}, sessions.get(sessionId)?.data, data)})
        sessionDestroy = async (sessionId: string) => sessions.delete(sessionId);

        setInterval(() => {
            Array.from(sessions.entries()).forEach(([key, value]) => {
                if (value.lastUpdate < Date.now() - sessionMaxAgeMS) {
                    sessions.delete(key);
                }
            });
        }, 10000);
    } else {
        sessionRead = sessionGetter;
        sessionWrite = sessionSetter;
    }
}

export function readSessionCookie(req: NextApiRequest | IncomingMessage, cookie = require("cookie")): string {
    const cookies = cookie.parse(req.headers.cookie || "");
    return cookies.nextSession;
}

export function writeSessionCookie(res: NextApiResponse | ServerResponse, sessionId: string, cookie = require("cookie")): void{
    res.setHeader("Set-Cookie", cookie.serialize("nextSession", sessionId, {
        httpOnly: true,
        sameSite: true,
        path: "/",
        // @ts-ignore tls sockets have the encrypted prop
        secure: !!req?.socket?.encrypted
    }));
}

export async function getSessionId(context: GetServerSidePropsContext): Promise<string>;
export async function getSessionId(req: NextApiRequest, res: NextApiResponse):Promise<string>;
export async function getSessionId(req: NextApiRequest, res: NextApiResponse, rdSessCookie?: Function, wtSessCookie?: Function, rdSession?: sessionGetterFunction, wtSession?: sessionSetterFunction, uuid?: {v4: Function}):Promise<string>;
export async function getSessionId(
    a: any,
    b?: any,
    rdSessCookie: Function = readSessionCookie,
    wtSessCookie: Function = writeSessionCookie,
    rdSession: sessionGetterFunction = sessionRead,
    wtSession: sessionSetterFunction = sessionWrite,
    { v4: uuid } = require("uuid")
) {
    let req, res;
    if(b){
        req = a as NextApiRequest;
        res = b as NextApiResponse;
    } else {
        req = a.req as IncomingMessage;
        res = a.res as ServerResponse;
    }

    let sessionId = rdSessCookie(req);
    if (!sessionId || !(await rdSession(sessionId))) {
        sessionId = uuid();
        wtSessCookie(res, sessionId);
        await wtSession(sessionId, {});
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
        get: async (sessionId: string) => store.get(sessionId) ? store.get(sessionId).data : null,
        set: async (sessionId: string, data: any) => store.set(sessionId, { lastUpdate: Date.now(), data }),
        merge: async (sessionId: string, data: any) => store.set(sessionId, {
            lastUpdate: Date.now(),
            data: Object.assign({}, store.get(sessionId) ? store.get(sessionId).data : {}, data)
        }),
        destroy: async (sessionId: string) => store.delete(sessionId),
        id: async () => uuid()
    };
}

export async function getSessionData<T=any>(context:GetServerSidePropsContext): Promise<T>;
export async function getSessionData<T=any>(req: NextApiRequest, res: NextApiResponse): Promise<T>;
export async function getSessionData<T>(a: any, b?: any): Promise<T> {
    return sessionRead(await getSessionId(a, b));
}

export async function setSessionData<T>(context: GetServerSidePropsContext, data: T): Promise<void>;
export async function setSessionData<T>(req: NextApiRequest, res: NextApiResponse, data: T): Promise<void>;
export async function setSessionData<T>(a: any, b: any, c?: T) {
    if((a && b && !c) || a && !b && !c){
        throw new Error("No session data given");
    }
    return sessionWrite(await getSessionId(a, b),c ? c : b);
}

export async function mergeSessionData<T>(context: GetServerSidePropsContext, data: T): Promise<void>;
export async function mergeSessionData<T>(req: NextApiRequest, res: NextApiResponse, data: T): Promise<void>;
export async function mergeSessionData<T>(a: any, b: any, c?: T){
    if((a && b && !c) || a && !b && !c){
        throw new Error("No session data given");
    }
    return sessionMerge(await getSessionId(a, b),c ? c : b);
}

export async function destroySession(sessionId: string){
    return sessionDestroy(sessionId);
}

export async function getCSRFToken(context: GetServerSidePropsContext): Promise<string>;
export async function getCSRFToken(req: NextApiRequest, res: NextApiResponse): Promise<string>;
export async function getCSRFToken(a: any, b?: any): Promise<string>{
    const csrfToken = require("uuid").v4();
    await mergeSessionData(a, b, {csrfToken});
    return csrfToken;
}

export async function useCSRFToken(context: GetServerSidePropsContext, token: string): Promise<boolean>;
export async function useCSRFToken(req: NextApiRequest, res: NextApiResponse, token: string): Promise<boolean>;
export async function useCSRFToken(a: any, b: any, c?: string): Promise<boolean>{
    let sessionData = await getSessionData(a, b);
    const wasValid = sessionData.csrfToken === c ? c : b;
    delete sessionData.csrfToken;
    await setSessionData(a, b, sessionData);
    return wasValid;
}
