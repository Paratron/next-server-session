import { CookieHandler, createMemorySessionStore, getSessionData, getSessionId, SessionStore } from "./index"
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
        read: jest.fn(() => Promise.resolve("sessionIdFromCookie")),
        write: jest.fn(() => Promise.resolve())
    }

    const sessionStore: SessionStore = {
        id: jest.fn(() => Promise.resolve("sessionId")),
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

});

describe("externals", () => {
    describe("getSessionId", () => {
        it("Returns fresh id, creates cookie when no exists");
        it("Uses the id from the cookie, if exists");
        it("Returns fresh id, overwrites cookie when no data in store for cookie id");
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
