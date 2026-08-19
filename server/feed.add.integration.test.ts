import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: vi.fn().mockResolvedValue(null), saveParsedFeed: vi.fn() };
});

import { getDb, saveParsedFeed } from "./db";

function createContext(): TrpcContext {
  return {
    user: { id: 42, openId: "reader-42", name: "Reader", email: "reader@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("feed.add integration error handling", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.mocked(getDb).mockResolvedValue(null as never); vi.mocked(saveParsedFeed).mockReset(); });

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

  it("settles the provided CNN World URL through feed.add", async () => {
    const rss = `<?xml version="1.0"?><rss><channel><title>CNN World</title><item><guid>cnn-world-1</guid><title>World story</title><link>https://www.cnn.com/world/story</link></item></channel></rss>`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(rss, { status: 200, headers: { "content-type": "text/xml" } }))
      .mockResolvedValueOnce(new Response(`<html><head></head></html>`, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const caller = appRouter.createCaller(createContext());
    const result = caller.feed.add({ url: "https://www.cnn.com/world" });
    await expect(Promise.race([result, new Promise((_, reject) => setTimeout(() => reject(new Error("CNN import did not settle")), 1500))])).rejects.toThrow("Database unavailable");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://rss.cnn.com/rss/edition_world.rss");
  });

  it("normalizes a real plain-text 503 response into a readable tRPC error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Service Unavailable", { status: 503, headers: { "content-type": "text/plain" } })));
    const caller = appRouter.createCaller(createContext());
    await expect(caller.feed.add({ url: "https://example.com/outage.xml" })).rejects.toThrow("The feed service is temporarily unavailable. Please try again in a moment.");
  });

  it("passes parsed playable video metadata into persistence when a feed is added", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 91 }]);
    vi.mocked(getDb).mockResolvedValue({ insert: vi.fn().mockReturnValue({ values }) } as never);
    vi.mocked(saveParsedFeed).mockResolvedValue(undefined as never);
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(`<?xml version="1.0"?><rss xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Video source</title><item><guid>clip-1</guid><title>Clip</title><link>https://example.com/clip</link><media:content url="https://cdn.example.com/clip.mp4" medium="video" /></item></channel></rss>`, { status: 200 }))
      .mockResolvedValueOnce(new Response("<html></html>", { status: 200 })));

    await expect(appRouter.createCaller(createContext()).feed.add({ url: "https://example.com/video.xml" })).resolves.toMatchObject({ id: 91, title: "Video source" });
    expect(saveParsedFeed).toHaveBeenCalledWith(42, 91, expect.objectContaining({ articles: [expect.objectContaining({ videoUrl: "https://cdn.example.com/clip.mp4", videoMimeType: "video/mp4" })] }));
  });
});
