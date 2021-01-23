import { createCookieHandler } from "./cookieHandler"
import {getMocks} from "./index.test"

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
