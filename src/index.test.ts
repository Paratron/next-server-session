import {
    configure,
    destroySession, getCSRFToken,
    getSessionData,
    getSessionId, pluckSessionProperty, replaceSessionData,
    setSessionData, validateCSRFToken
} from "./index"
import { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next"
import { CookieHandler, createCookieHandler } from "./cookieHandler"
import { createMemorySessionStore, SessionStore } from "./memorySessionStore"

function getMocks() {
    const req = {
        headers: {
            cookie: ""
        }
    } as unknown as NextApiRequest;

    const res = {
        json: jest.fn()
    } as unknown as NextApiResponse;

    const context = {
        req,
        res
    } as unknown as GetServerSidePropsContext;

    const cookieHandler: CookieHandler = {
        read: jest.fn(() => Promise.resolve(undefined)),
        write: jest.fn(() => Promise.resolve()),
        destroy: jest.fn(() => Promise.resolve())
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
        context,
        sessionStore,
        cookieHandler
    }
}

test("Memory Session Store", async () => {
    jest.useFakeTimers("modern");

    const store = createMemorySessionStore();

    expect(await store.get("unknown")).toBe(null);

    await store.set("id1", { test: true });
    expect(await store.get("id1")).toMatchObject({ test: true });

    await store.set("id1", { foo: "bar" });
    expect(await store.get("id1")).toMatchObject({ foo: "bar" });

    await store.merge("id1", { some: "more" });
    expect(await store.get("id1")).toMatchObject({ foo: "bar", some: "more" });

    await store.merge("previouslyUnknown", { something: "new" });
    expect(await store.get("previouslyUnknown")).toMatchObject({ something: "new" });

    await store.destroy("id1");
    expect(await store.get("id1")).toBe(null);

    const now = Date.now();
    jest.setSystemTime(now);
    await store.set("timeoutTest", { exists: true });
    jest.setSystemTime(now + 31 * 60 * 1000);
    jest.advanceTimersByTime(10000);
    expect(await store.get("timeoutTest")).toBe(null);
});

describe("Cookie Handler", () => {
    test("Reader", async () => {
        const { req, res } = getMocks();
        const handler = createCookieHandler();

        expect(await handler.read(req)).toBeUndefined();
        req.headers.cookie = "something=else; nextSession=abc123; some=more";
        expect(await handler.read(req)).toBe("abc123");
    });

    test("Writer", async () => {
        const { res } = getMocks();
        const handler = createCookieHandler();

        res.setHeader = jest.fn();
        await handler.write(res, "testId")
        expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", "nextSession=testId; Path=/; HttpOnly; SameSite=Strict");
    });

    test("Deleter", async () => {
        const { res } = getMocks();
        const handler = createCookieHandler();

        res.setHeader = jest.fn();
        await handler.destroy(res)
        expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", "nextSession=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict");
    });
});

describe("externals", () => {

    describe("getSessionId", () => {
        it("Returns fresh id, creates cookie, if requested", async () => {
            const { req, res, context, sessionStore, cookieHandler } = getMocks();
            configure({ sessionStore, cookieHandler });
            expect(await getSessionId(req, res)).toBe("sessionIdCode");
            expect(sessionStore.set).not.toHaveBeenCalled();
            expect(cookieHandler.read).toHaveBeenCalled();
            expect(cookieHandler.write).not.toHaveBeenCalled();

            expect(await getSessionId(context, true)).toBe("sessionIdCode");
            expect(sessionStore.set).toHaveBeenCalledWith("sessionIdCode", {});
            expect(cookieHandler.write).toHaveBeenCalledWith(res, "sessionIdCode");
        });

        it("Uses the id from the cookie, if exists", async () => {
            const { req, res, sessionStore, cookieHandler } = getMocks();
            sessionStore.get = jest.fn((sessionId) => Promise.resolve(sessionId === "fromCookie" ? {} : null));
            cookieHandler.read = jest.fn(() => Promise.resolve("fromCookie"));
            configure({ sessionStore, cookieHandler });
            expect(await getSessionId(req, res)).toBe("fromCookie");
            expect(cookieHandler.write).not.toHaveBeenCalled();
        });

        it("Returns fresh id, removes cookie when no data in store for cookie id", async () => {
            const { req, res, sessionStore, cookieHandler } = getMocks();
            sessionStore.get = jest.fn((sessionId) => Promise.resolve(sessionId === "sessionIdCode" ? {} : null));
            cookieHandler.read = jest.fn(() => Promise.resolve("fromCookie"));
            configure({ sessionStore, cookieHandler });
            expect(await getSessionId(req, res)).toBe("sessionIdCode");
            expect(cookieHandler.destroy).toHaveBeenCalled();
        });

    });

    describe("pluckSessionProperty", () => {
        it("Returns null if property does not exist", async () => {
            const { req, res, sessionStore, cookieHandler } = getMocks();
            configure({ sessionStore, cookieHandler });
            expect(await pluckSessionProperty(req, res, "test")).toBe(null);
        });

        it("Returns property and removes it from session object", async () => {
            const { req, res, cookieHandler } = getMocks();
            const sessionStore = createMemorySessionStore();
            sessionStore.id = async () => "id";
            configure({sessionStore, cookieHandler});
            await setSessionData(req, res, {test: "hello"});
            expect(await getSessionData(req, res)).toMatchObject({test: "hello"});
            expect(await pluckSessionProperty<string>(req, res, "test")).toBe("hello");
            expect(await pluckSessionProperty(req, res, "test")).toBe(null);
            expect(await getSessionData(req, res)).toMatchObject({});
        });
    });

    describe("getSessionData", () => {
        it("Returns an object on new sessions", async () => {
            const { req, res, sessionStore, cookieHandler } = getMocks();
            configure({ sessionStore, cookieHandler });
            expect(await getSessionData(req, res)).toMatchObject({});
        });

        it("Returns data from new or existing sessions", async () => {
            const { req, res, sessionStore, cookieHandler } = getMocks();
            sessionStore.get = jest.fn((sessionId) => Promise.resolve(sessionId === "1" ? { session: true } : null));
            cookieHandler.read = jest.fn(() => Promise.resolve("fromCookie"));
            sessionStore.id = jest.fn(() => Promise.resolve("1"));
            configure({ sessionStore, cookieHandler });
            expect(await getSessionData(req, res)).toMatchObject({});
            expect(cookieHandler.write).not.toHaveBeenCalled();

            cookieHandler.read = jest.fn(() => Promise.resolve("1"));
            expect(await getSessionData(req, res)).toMatchObject({ session: true });
        });

    });

    describe("replaceSessionData", () => {
        it("Replaces the data stored in the session", async () => {
            const { req, res, cookieHandler } = getMocks();
            const sessionStore = createMemorySessionStore();
            sessionStore.id = jest.fn(() => Promise.resolve(("uuid")));
            cookieHandler.read = jest.fn(() => Promise.resolve("uuid"));
            configure({ sessionStore, cookieHandler });
            await replaceSessionData(req, res, { foo: "bar" });
            expect(await sessionStore.get("uuid")).toMatchObject({ foo: "bar" });
            await replaceSessionData(req, res, { a: "b" });
            expect(await sessionStore.get("uuid")).toMatchObject({ a: "b" });
        });
    });

    describe("setSessionData", () => {
        it("Merges new data with existing data in the session", async () => {
            const { req, res, cookieHandler } = getMocks();
            const sessionStore = createMemorySessionStore();
            sessionStore.id = jest.fn(() => Promise.resolve(("uuid")));
            cookieHandler.read = jest.fn(() => Promise.resolve("uuid"));
            configure({ sessionStore, cookieHandler });
            await setSessionData(req, res, { foo: "bar" });
            expect(await sessionStore.get("uuid")).toMatchObject({ foo: "bar" });
            await setSessionData(req, res, { a: "b" });
            expect(await sessionStore.get("uuid")).toMatchObject({ a: "b", foo: "bar" });
        });
    });
    describe("destroySession", () => {
        it("Removes the session data completely", async () => {
            const { req, res, cookieHandler } = getMocks();
            const sessionStore = createMemorySessionStore();
            sessionStore.id = jest.fn(() => Promise.resolve(("uuid")));
            cookieHandler.read = jest.fn(() => Promise.resolve("uuid"));
            configure({ sessionStore, cookieHandler });
            await setSessionData(req, res, { foo: "bar" });
            await destroySession(req, res);
            expect(cookieHandler.destroy).toHaveBeenCalled();
            expect(await sessionStore.get("uuid")).toBe(null);
        });
    });

    describe("getCSRFToken", () => {
        it("Creates a fresh token and stores it in the session", async () => {
            const { req, res, cookieHandler } = getMocks();
            const sessionStore = createMemorySessionStore();
            sessionStore.id = jest.fn(() => Promise.resolve(("uuid")));
            cookieHandler.read = jest.fn(() => Promise.resolve("uuid"));
            configure({ sessionStore, cookieHandler });
            const token = await getCSRFToken(req, res);
            expect(typeof token).toBe("string");
            expect(await sessionStore.get("uuid")).toMatchObject({ csrfToken: token })

            const token2 = await getCSRFToken(req, res);
            expect(token === token2).toBe(false);
            expect(await sessionStore.get("uuid")).toMatchObject({ csrfToken: token2 })
        });
    });
    describe("validateCSRFToken", () => {
        it("Validates the token and removes it from the session", async () => {
            const { req, res, cookieHandler } = getMocks();
            const sessionStore = createMemorySessionStore();
            sessionStore.id = jest.fn(() => Promise.resolve(("uuid")));
            cookieHandler.read = jest.fn(() => Promise.resolve("uuid"));
            configure({ sessionStore, cookieHandler });
            const token = await getCSRFToken(req, res);
            expect(await sessionStore.get("uuid")).toMatchObject({ csrfToken: token })
            expect(await validateCSRFToken(req, res, token)).toBe(true);
            expect(await validateCSRFToken(req, res, token)).toBe(false);
            expect(await sessionStore.get("uuid")).toMatchObject({});
        });
    });
});
