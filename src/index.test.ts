import { getSessionId } from "./index"
import { NextApiRequest, NextApiResponse } from "next"

function getMocks() {
    const readSessionCookie = jest.fn();
    const writeSessionCookie = jest.fn();
    const readSession: any = jest.fn(() => Promise.resolve(null));
    const writeSession = jest.fn(() => Promise.resolve());
    const uuid = { v4: jest.fn(() => "uuid") };
    const req = {
        headers: {
            cookie: ""
        }
    } as unknown as NextApiRequest;

    const res = {
        setHeader: jest.fn()
    } as unknown as NextApiResponse;


    return {
        req,
        res,
        readSession,
        readSessionCookie,
        writeSessionCookie,
        writeSession,
        uuid
    }
}

describe("configuration", () => {
    test("configure");
});

describe("cookie mechanism", () => {
    test("readSessionCookie");
    test("writeSessionCookie");
});

describe("externals", () => {
    describe("getSessionId", () => {
        test("happy path", () => {
            const { req, res, readSessionCookie, writeSessionCookie, readSession, writeSession, uuid } = getMocks();
            expect(getSessionId(req, res, readSessionCookie, writeSessionCookie, readSession, writeSession, uuid))
                .resolves.toBe("uuid")
        });
        test("with cookie present", () => {
            let { req, res, readSessionCookie, writeSessionCookie, readSession, writeSession, uuid } = getMocks();

            readSessionCookie = jest.fn(() => "fromCookie");

            // Without session data, the cookie value should not be used.
            expect(getSessionId(req, res, readSessionCookie, writeSessionCookie, readSession, writeSession, uuid))
                .resolves.toBe("uuid")

            // Session data must be present to consider the session id valid
            readSession = jest.fn(() => Promise.resolve({}));

            expect(getSessionId(req, res, readSessionCookie, writeSessionCookie, readSession, writeSession, uuid))
                .resolves.toBe("fromCookie")


        })
    });

    test("getSessionData");
    test("setSessionData");
    test("mergeSessionData");

    test("destroySession");

    test("getCSRFToken");
    test("useCSRFToken");
});
