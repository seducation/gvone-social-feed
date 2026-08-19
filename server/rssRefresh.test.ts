import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn(), saveParsedFeed: vi.fn() }));
vi.mock("./feedParser", () => ({ parseFeed: vi.fn() }));

import { getDb, saveParsedFeed } from "./db";
import { parseFeed } from "./feedParser";
import { refreshAllFeeds, refreshFeedBatch } from "./rssRefresh";

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

  it("retries one transient HTTP 429 without blocking the rest of the refresh batch", async () => {
    vi.mocked(parseFeed).mockReset();
    vi.mocked(saveParsedFeed).mockReset();
    vi.mocked(parseFeed)
      .mockRejectedValueOnce(new Error("Feed returned HTTP 429"))
      .mockResolvedValueOnce({ title: "Recovered", description: null, faviconUrl: "", articles: [] } as never)
      .mockResolvedValueOnce({ title: "Other", description: null, faviconUrl: "", articles: [] } as never);
    vi.mocked(saveParsedFeed).mockResolvedValue(undefined as never);

    const result = await refreshFeedBatch([
      { id: 1, userId: 42, url: "https://old.reddit.com/r/videos/.rss" },
      { id: 2, userId: 42, url: "https://example.com/other.xml" },
    ], 2, 0);

    expect(result).toEqual({ attempted: 2, refreshed: 2, failed: 0, failures: [] });
    expect(parseFeed).toHaveBeenCalledTimes(3);
  });

  it("retries one transient HTTP 503 before recording a source as failed", async () => {
    vi.mocked(parseFeed).mockReset();
    vi.mocked(saveParsedFeed).mockReset();
    vi.mocked(parseFeed)
      .mockRejectedValueOnce(new Error("Feed returned HTTP 503"))
      .mockResolvedValueOnce({ title: "Recovered service", description: null, faviconUrl: "", articles: [] } as never);
    vi.mocked(saveParsedFeed).mockResolvedValue(undefined as never);

    await expect(refreshFeedBatch([{ id: 3, userId: 42, url: "https://example.com/recovering.xml" }], 1, 0)).resolves.toEqual({ attempted: 1, refreshed: 1, failed: 0, failures: [] });
    expect(parseFeed).toHaveBeenCalledTimes(2);
  });

  it("selects only enabled sources for the scheduled background refresh", async () => {
    vi.mocked(parseFeed).mockReset();
    vi.mocked(saveParsedFeed).mockReset();
    const where = vi.fn().mockResolvedValue([{ id: 9, userId: 42, url: "https://example.com/enabled.xml", isEnabled: true }]);
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    vi.mocked(getDb).mockResolvedValue({ select } as never);
    vi.mocked(parseFeed).mockResolvedValue({ title: "Enabled", description: null, faviconUrl: null, articles: [] } as never);
    vi.mocked(saveParsedFeed).mockResolvedValue(undefined as never);

    await expect(refreshAllFeeds()).resolves.toMatchObject({ attempted: 1, refreshed: 1, failed: 0 });
    expect(where).toHaveBeenCalledTimes(1);
    expect(parseFeed).toHaveBeenCalledWith("https://example.com/enabled.xml");
  });
});
