import { rssFeeds } from "../drizzle/schema";
import { getDb, saveParsedFeed } from "./db";
import { parseFeed } from "./feedParser";

export async function refreshAllFeeds() {
  const db = await getDb();
  if (!db) return { refreshed: 0, failed: 0 };
  const feeds = await db.select().from(rssFeeds);
  let refreshed = 0;
  let failed = 0;
  for (const feed of feeds) {
    try {
      const parsed = await parseFeed(feed.url);
      await saveParsedFeed(feed.userId, feed.id, parsed);
      refreshed += 1;
    } catch (error) {
      failed += 1;
      console.warn(`[RSS refresh] ${feed.url}`, error);
    }
  }
  return { refreshed, failed };
}
