import { rssFeeds } from "../drizzle/schema";
import { getDb, saveParsedFeed } from "./db";
import { parseFeed } from "./feedParser";

type RefreshableFeed = { id: number; userId: number; url: string };

export type RefreshSummary = {
  attempted: number;
  refreshed: number;
  failed: number;
  failures: Array<{ feedId: number; message: string }>;
};

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function parseWithTransientRetry(url: string, retryDelayMs: number) {
  try {
    return await parseFeed(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/HTTP (?:429|502|503|504)/i.test(message)) throw error;
    if (retryDelayMs > 0) await wait(retryDelayMs);
    return parseFeed(url);
  }
}

export async function refreshFeedBatch(feeds: RefreshableFeed[], concurrency = 3, transientRetryDelayMs = 3_000): Promise<RefreshSummary> {
  const failures: RefreshSummary["failures"] = [];
  let refreshed = 0;
  let cursor = 0;
  const workerCount = Math.min(Math.max(concurrency, 1), feeds.length);

  async function refreshNext() {
    while (cursor < feeds.length) {
      const feed = feeds[cursor++];
      try {
        const parsed = await parseWithTransientRetry(feed.url, transientRetryDelayMs);
        await saveParsedFeed(feed.userId, feed.id, parsed);
        refreshed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ feedId: feed.id, message: message || "Could not refresh source" });
        console.warn(`[RSS refresh] ${feed.url}`, error);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => refreshNext()));
  return { attempted: feeds.length, refreshed, failed: failures.length, failures };
}

export async function refreshAllFeeds(): Promise<RefreshSummary> {
  const db = await getDb();
  if (!db) return { attempted: 0, refreshed: 0, failed: 0, failures: [] };
  const feeds = await db.select().from(rssFeeds);
  return refreshFeedBatch(feeds);
}
