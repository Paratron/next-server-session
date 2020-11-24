import {
    configure,
    CookieHandler,
    createCookieHandler,
    createMemorySessionStore,
    getSessionData,
    getSessionId,
    SessionStore
} from "./index"
import { NextApiRequest, NextApiResponse } from "next"

function getMocks() {
    const req = {
        headers: {
            cookie: ""
        }
    } as unknown as NextApiRequest;

    const res = {
        setHeader: jest.fn()
    } as unknown as NextApiResponse;

    const cookieHandler: CookieHandler = {
        read: jest.fn(() => Promise.resolve(undefined)),
        write: jest.fn(() => Promise.resolve())
    }

    const sessionStore: SessionStore = {
        id: jest.fn(() => Promise.resolve("sessionIdCode")),
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve()),
        merge: jest.fn(() => Promise.resolve()),
        destroy: jest.fn(() => Promise.resolve())
    };

    return {
        req,
        res,
        sessionStore,
        cookieHandler
    }
}

test("Memory Session Store", async () => {
    jest.useFakeTimers("modern");

    const store = createMemorySessionStore();

    expect(await store.get("unknown")).toBe(null);

    await store.set("id1", {test: true});
    expect(await store.get("id1")).toMatchObject({test: true});

    await store.set("id1", {foo: "bar"});
    expect(await store.get("id1")).toMatchObject({foo: "bar"});

    await store.merge("id1", {some: "more"});
    expect(await store.get("id1")).toMatchObject({foo: "bar", some: "more"});

    await store.merge("previouslyUnknown", {something: "new"});
    expect(await store.get("previouslyUnknown")).toMatchObject({something: "new"});

    await store.destroy("id1");
    expect(await store.get("id1")).toBe(null);

    const now = Date.now();
    jest.setSystemTime(now);
    await store.set("timeoutTest", {exists: true});
    jest.setSystemTime(now + 31 * 60 * 1000);
    jest.advanceTimersByTime(10000);
    expect(await store.get("timeoutTest")).toBe(null);
});

describe("Cookie Handler", () => {
    test("Reader", async () => {
        const {req, res} = getMocks();
        const handler = createCookieHandler();

        expect(await handler.read(req)).toBeUndefined();
        req.headers.cookie = "something=else; nextSession=abc123; some=more";
        expect(await handler.read(req)).toBe("abc123");
    });

    test("Writer", async () => {
        const {req, res} = getMocks();
        const handler = createCookieHandler();

        res.setHeader = jest.fn();
        await handler.write(res, "testId")
        expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", "nextSession=testId; Path=/; HttpOnly; SameSite=Strict");
    });
});

describe("externals", () => {

    describe("getSessionId", () => {

        it("Returns fresh id, creates cookie when no exists", async () => {
            const {req, res, sessionStore, cookieHandler} = getMocks();
            configure({sessionStore, cookieHandler});
            expect(await getSessionId(req, res)).toBe("sessionIdCode");
            expect(sessionStore.set).toHaveBeenCalledWith("sessionIdCode", {});
            expect(cookieHandler.read).toHaveBeenCalled();
            expect(cookieHandler.write).toHaveBeenCalledWith(res, "sessionIdCode");
        });

        it("Uses the id from the cookie, if exists", async () => {
            const {req, res, sessionStore, cookieHandler} = getMocks();
            sessionStore.get = jest.fn((sessionId) => Promise.resolve(sessionId === "fromCookie" ? {} : null));
            cookieHandler.read = jest.fn(() => Promise.resolve("fromCookie"));
            configure({sessionStore, cookieHandler});
            expect(await getSessionId(req, res)).toBe("fromCookie");
            expect(cookieHandler.write).not.toHaveBeenCalled();
        });

        it("Returns fresh id, overwrites cookie when no data in store for cookie id", async () => {
            const {req, res, sessionStore, cookieHandler} = getMocks();
            sessionStore.get = jest.fn((sessionId) => Promise.resolve(sessionId === "sessionIdCode" ? {} : null));
            cookieHandler.read = jest.fn(() => Promise.resolve("fromCookie"));
            configure({sessionStore, cookieHandler});
            expect(await getSessionId(req, res)).toBe("sessionIdCode");
            expect(cookieHandler.write).toHaveBeenCalled();
        });

    });

    describe("getSessionData", () => {

        it("Returns empty object when session did not exist before or was invalid");

        it("Returns session data");

    });
    describe("setSessionData", () => {
        it("Replaces the data stored in the session");
    });
    describe("mergeSessionData", () => {
        it("Merges new data with existing data in the session");
    });
    describe("destroySession", () => {
        it("Removes the session data completely");
    });

    describe("getCSRFToken", () => {
        it("Creates a fresh token and stores it in the session");
    });
    describe("useCSRFToken", () => {
        it("Validates the token and removes it from the session");
    });
});
