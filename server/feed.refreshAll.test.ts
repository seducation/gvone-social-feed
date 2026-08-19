import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getFeed: vi.fn(), listFeeds: vi.fn(), saveParsedFeed: vi.fn() };
});
vi.mock("./feedParser", () => ({ parseFeed: vi.fn() }));

import { getFeed, listFeeds, saveParsedFeed } from "./db";
import { parseFeed } from "./feedParser";
import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: { id: 42, openId: "reader-42", name: "Reader", email: "reader@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("feed.refreshAll", () => {
  it("refreshes each private source and returns a settled count when one source fails", async () => {
    const feeds = [{ id: 1, userId: 42, url: "https://example.com/one.xml" }, { id: 2, userId: 42, url: "https://example.com/two.xml" }];
    vi.mocked(listFeeds).mockResolvedValue(feeds as never);
    vi.mocked(getFeed).mockImplementation(async (_userId, id) => feeds.find((feed) => feed.id === id) as never);
    vi.mocked(parseFeed).mockImplementation(async (url) => {
      if (url.includes("two")) throw new Error("Source unavailable");
      return { title: "One", description: null, faviconUrl: null, articles: [] } as never;
    });
    vi.mocked(saveParsedFeed).mockResolvedValue(undefined as never);

    await expect(appRouter.createCaller(createContext()).feed.refreshAll()).resolves.toEqual({ attempted: 2, refreshed: 1, failed: 1, failures: [{ feedId: 2, message: "Source unavailable" }] });
    expect(parseFeed).toHaveBeenCalledTimes(2);
    expect(saveParsedFeed).toHaveBeenCalledWith(42, 1, expect.anything());
  });
});
