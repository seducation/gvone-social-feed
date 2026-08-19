import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, RssArticle, rssArticles, rssFeeds, rssGroups, feedGroups, sourceTabPreferences, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import type { ParsedFeed } from "./feedParser";

let _db: ReturnType<typeof drizzle> | null = null;
export async function getDb() { if (!_db && process.env.DATABASE_URL) { try { _db = drizzle(process.env.DATABASE_URL); } catch { _db = null; } } return _db; }

export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb(); if (!db || !user.openId) return;
  const values: InsertUser = { openId: user.openId, name: user.name, email: user.email, loginMethod: user.loginMethod, lastSignedIn: user.lastSignedIn ?? new Date(), role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user") };
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: { name: values.name, email: values.email, loginMethod: values.loginMethod, lastSignedIn: values.lastSignedIn, role: values.role } });
}
export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0]; }

export function ownsResource(userId: number, resource: { userId: number } | undefined) { return Boolean(resource && resource.userId === userId); }
export function sortArticlesByPublished<T extends { publishedAt: Date | null }>(articles: T[]) { return [...articles].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)); }
export const ARTICLE_HISTORY_LIMIT = 500;

export async function listFeeds(userId: number, enabledOnly = false) { const db = await getDb(); if (!db) return []; return db.select().from(rssFeeds).where(enabledOnly ? and(eq(rssFeeds.userId, userId), eq(rssFeeds.isEnabled, true)) : eq(rssFeeds.userId, userId)).orderBy(desc(rssFeeds.createdAt)); }
export async function listGroups(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(rssGroups).where(eq(rssGroups.userId, userId)).orderBy(rssGroups.name); }
export async function getFeed(userId: number, id: number) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(rssFeeds).where(and(eq(rssFeeds.id, id), eq(rssFeeds.userId, userId))).limit(1))[0]; }
export async function getGroup(userId: number, id: number) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(rssGroups).where(and(eq(rssGroups.id, id), eq(rssGroups.userId, userId))).limit(1))[0]; }

export async function saveParsedFeed(userId: number, feedId: number, parsed: ParsedFeed) {
  const db = await getDb(); if (!db) return;
  await db.update(rssFeeds).set({ title: parsed.title, description: parsed.description, faviconUrl: parsed.faviconUrl, lastFetchedAt: new Date() }).where(and(eq(rssFeeds.id, feedId), eq(rssFeeds.userId, userId)));
  for (const article of parsed.articles) {
    await db.insert(rssArticles).values({ feedId, ...article }).onDuplicateKeyUpdate({ set: { title: article.title, link: article.link, description: article.description, publishedAt: article.publishedAt, thumbnailUrl: article.thumbnailUrl, videoUrl: article.videoUrl, videoMimeType: article.videoMimeType } });
  }
}
export async function listArticlesForFeeds(feedIds: number[], limit = ARTICLE_HISTORY_LIMIT): Promise<RssArticle[]> { const db = await getDb(); if (!db || !feedIds.length) return []; const rows = await db.select().from(rssArticles).where(inArray(rssArticles.feedId, feedIds)).orderBy(desc(rssArticles.publishedAt)).limit(limit); return sortArticlesByPublished(rows); }
export async function groupFeedIds(userId: number, groupId: number) { const db = await getDb(); if (!db) return []; const rows = await db.select({ feedId: feedGroups.feedId }).from(feedGroups).innerJoin(rssFeeds, eq(feedGroups.feedId, rssFeeds.id)).where(and(eq(feedGroups.groupId, groupId), eq(rssFeeds.userId, userId), eq(rssFeeds.isEnabled, true))); return rows.map((row) => row.feedId); }
export async function assignFeed(userId: number, feedId: number, groupId: number) { const db = await getDb(); if (!db || !ownsResource(userId, await getFeed(userId, feedId)) || !ownsResource(userId, await getGroup(userId, groupId))) return; await db.insert(feedGroups).values({ feedId, groupId }).onDuplicateKeyUpdate({ set: { feedId } }); }
export async function unassignFeed(userId: number, feedId: number, groupId: number) { const db = await getDb(); if (!db || !ownsResource(userId, await getFeed(userId, feedId)) || !ownsResource(userId, await getGroup(userId, groupId))) return; await db.delete(feedGroups).where(and(eq(feedGroups.feedId, feedId), eq(feedGroups.groupId, groupId))); }
export async function listAssignedFeedIds(userId: number, groupId: number) { return groupFeedIds(userId, groupId); }

export async function getSourceTabOrder(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const preference = (await db.select().from(sourceTabPreferences).where(eq(sourceTabPreferences.userId, userId)).limit(1))[0];
  if (!preference) return [];
  try {
    const order = JSON.parse(preference.tabOrder);
    return Array.isArray(order) && order.every((key) => typeof key === "string") ? order : [];
  } catch { return []; }
}

export async function saveSourceTabOrder(userId: number, tabOrder: string[]) {
  const db = await getDb();
  if (!db) return false;
  await db.insert(sourceTabPreferences).values({ userId, tabOrder: JSON.stringify(tabOrder) }).onDuplicateKeyUpdate({ set: { tabOrder: JSON.stringify(tabOrder), updatedAt: new Date() } });
  return true;
}
