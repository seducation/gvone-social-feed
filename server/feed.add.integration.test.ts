import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: vi.fn().mockResolvedValue(null) };
});

function createContext(): TrpcContext {
  return {
    user: { id: 42, openId: "reader-42", name: "Reader", email: "reader@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("feed.add integration error handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("settles a non-YouTube website import instead of remaining pending", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("<!doctype html><html><body>Example news site</body></html>", { status: 200, headers: { "content-type": "text/html" } }))
      .mockResolvedValue(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const caller = appRouter.createCaller(createContext());
    const result = caller.feed.add({ url: "https://example.com/news" });
    await expect(Promise.race([result, new Promise((_, reject) => setTimeout(() => reject(new Error("feed.add did not settle")), 1500))])).rejects.toThrow("Paste the direct RSS/Atom XML URL");
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("settles the provided Reddit Technology URL through feed.add", async () => {
    const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>technology</title><entry><id>t3_technology</id><title>Technology story</title><link href="https://www.reddit.com/r/technology/comments/example"/><updated>2026-08-19T08:00:00Z</updated></entry></feed>`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(atom, { status: 200, headers: { "content-type": "application/atom+xml" } }))
      .mockResolvedValueOnce(new Response(`<html><head></head></html>`, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const caller = appRouter.createCaller(createContext());
    const result = caller.feed.add({ url: "https://www.reddit.com/r/technology/" });
    await expect(Promise.race([result, new Promise((_, reject) => setTimeout(() => reject(new Error("Reddit import did not settle")), 1500))])).rejects.toThrow("Database unavailable");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://www.reddit.com/r/technology/.rss");
  });

  it("normalizes a real plain-text 503 response into a readable tRPC error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Service Unavailable", { status: 503, headers: { "content-type": "text/plain" } })));
    const caller = appRouter.createCaller(createContext());
    await expect(caller.feed.add({ url: "https://example.com/outage.xml" })).rejects.toThrow("The feed service is temporarily unavailable. Please try again in a moment.");
  });
});
