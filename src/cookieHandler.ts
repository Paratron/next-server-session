import { NextApiRequest, NextApiResponse } from "next"
import { IncomingMessage, ServerResponse } from "http"

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
