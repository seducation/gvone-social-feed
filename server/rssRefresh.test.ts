import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn(), saveParsedFeed: vi.fn() }));
vi.mock("./feedParser", () => ({ parseFeed: vi.fn() }));

import { saveParsedFeed } from "./db";
import { parseFeed } from "./feedParser";
import { refreshFeedBatch } from "./rssRefresh";

describe("refreshFeedBatch", () => {
  it("settles every feed and returns failure details without aborting the remaining refreshes", async () => {
    const feeds = [
      { id: 1, userId: 8, url: "https://example.com/one.xml" },
      { id: 2, userId: 8, url: "https://example.com/two.xml" },
      { id: 3, userId: 8, url: "https://example.com/three.xml" },
    ];
    vi.mocked(parseFeed).mockImplementation(async (url) => {
      if (url.includes("two")) throw new Error("Timed out");
      return { title: "Updated", description: null, faviconUrl: null, articles: [] } as never;
    });
    vi.mocked(saveParsedFeed).mockResolvedValue(undefined as never);

    await expect(refreshFeedBatch(feeds, 2)).resolves.toEqual({
      attempted: 3,
      refreshed: 2,
      failed: 1,
      failures: [{ feedId: 2, message: "Timed out" }],
    });
    expect(parseFeed).toHaveBeenCalledTimes(3);
    expect(saveParsedFeed).toHaveBeenCalledTimes(2);
  });
});
