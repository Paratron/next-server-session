import { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next"
import { IncomingMessage, ServerResponse } from "http";

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

async function getSessionId(context: GetServerSidePropsContext): Promise<string>;
async function getSessionId(req: NextApiRequest, res: NextApiResponse):Promise<string>;
async function getSessionId(a: any, b?: any) {
    let req, res;
    if(b){
        req = a as NextApiRequest;
        res = b as NextApiResponse;
    } else {
        req = a.req as IncomingMessage;
        res = a.res as ServerResponse;
    }

    const cookie = require("cookie");
    const cookies = cookie.parse(req.headers.cookie || "");
    let sessionId = cookies.nextSession;
    if (!sessionId || !(await sessionRead(sessionId))) {
        const { v4: uuid } = require("uuid");
        sessionId = uuid();
        res.setHeader("Set-Cookie", cookie.serialize("nextSession", sessionId, {
            httpOnly: true,
            sameSite: true,
            path: "/",
            // @ts-ignore tls sockets have the encrypted prop
            secure: !!req?.socket?.encrypted
        }));
        await sessionWrite(sessionId, {});
    }
    return sessionId;
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
