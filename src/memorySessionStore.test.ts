import { createMemorySessionStore } from "./memorySessionStore"

describe("Memory Session Store", () => {
    it("Should create unique string IDs", async () => {
        const store = createMemorySessionStore();
        expect(typeof (await store.id())).toBe("string");
        const id1 = await store.id();
        const id2 = await store.id();
        expect(id1 === id2).toBe(false);
    });

    it("Should return null on unknown sessionId", async () => {
        const store = createMemorySessionStore();
        expect(await store.get("unknown")).toBe(null);
    });

    it("Should resolve to void when setting or replacing values", async () => {
        const store = createMemorySessionStore();
        expect(await store.set("id1", { test: true })).toBeUndefined();
        expect(await store.merge("id2", { test: true })).toBeUndefined();
    });

    it("Should return the correct data that previously has been set", async () => {
        const store = createMemorySessionStore();
        await store.set("id1", { test: true });
        expect(await store.get("id1")).toMatchObject({ test: true });
    });

    it("Should replace objects when calling set on the same session id", async () => {
        const store = createMemorySessionStore();
        await store.set("id1", { test: true });
        expect(await store.get("id1")).toMatchObject({ test: true });
        await store.set("id1", { foo: "bar" });
        expect(await store.get("id1")).toMatchObject({ foo: "bar" });
    });

    it("Should correctly merge session objects", async () => {
        const store = createMemorySessionStore();
        await store.merge("id1", { foo: "bar" });
        expect(await store.get("id1")).toMatchObject({ foo: "bar" });
        await store.merge("id1", { some: "more" });
        expect(await store.get("id1")).toMatchObject({ foo: "bar", some: "more" });
    });

    it("Should correctly destroy session objects", async () => {
        const store = createMemorySessionStore();
        await store.set("id1", { test: true });
        expect(await store.get("id1")).not.toBe(null);
        await store.destroy("id1");
        expect(await store.get("id1")).toBe(null);
    });

    it("Should remove older session objects", async () => {
        const now = Date.now();
        jest.useFakeTimers("modern");
        const store = createMemorySessionStore();
        await store.set("timeoutTest", { exists: true });
        jest.setSystemTime(now + 31 * 60 * 1000);
        jest.advanceTimersByTime(10000);
        expect(await store.get("timeoutTest")).toBe(null);
    });
});
