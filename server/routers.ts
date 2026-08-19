import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { feedGroups, rssArticles, rssFeeds, rssGroups } from "../drizzle/schema";
import { ARTICLE_HISTORY_LIMIT, assignFeed, getDb, getFeed, getGroup, groupFeedIds, listArticlesForFeeds, listFeeds, listGroups, saveParsedFeed, unassignFeed } from "./db";
import { parseFeed } from "./feedParser";
import { refreshFeedBatch } from "./rssRefresh";

function normalizeFeedImportError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/service unavailable|bad gateway|gateway timeout|HTTP 50[234]/i.test(message)) return "The feed service is temporarily unavailable. Please try again in a moment.";
  return message || "Could not import that feed";
}

async function refreshOwnedFeed(userId: number, feedId: number) {
  const feed = await getFeed(userId, feedId);
  if (!feed) throw new TRPCError({ code: "NOT_FOUND", message: "Feed not found" });
  if (!feed.isEnabled) throw new TRPCError({ code: "CONFLICT", message: "Enable this source before refreshing it" });
  const parsed = await parseFeed(feed.url);
  await saveParsedFeed(userId, feed.id, parsed);
  return { ...feed, ...parsed, lastFetchedAt: new Date() };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 }); return { success: true } as const; }),
  }),
  dashboard: protectedProcedure.query(async ({ ctx }) => ({ feeds: await listFeeds(ctx.user.id, true), groups: await listGroups(ctx.user.id) })),
  feed: router({
    list: protectedProcedure.query(({ ctx }) => listFeeds(ctx.user.id)),
    articles: protectedProcedure.query(async ({ ctx }) => {
      const feeds = await listFeeds(ctx.user.id, true);
      return listArticlesForFeeds(feeds.map((feed) => feed.id), feeds.length * ARTICLE_HISTORY_LIMIT);
    }),
    sourceArticles: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      if (!(await getFeed(ctx.user.id, input.id))) throw new TRPCError({ code: "NOT_FOUND" });
      return listArticlesForFeeds([input.id], ARTICLE_HISTORY_LIMIT);
    }),
    add: protectedProcedure.input(z.object({ url: z.string().url(), customTitle: z.string().trim().max(255).optional() })).mutation(async ({ ctx, input }) => {
      let parsed;
      try { parsed = await parseFeed(input.url); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: normalizeFeedImportError(error) }); }
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const inserted = await db.insert(rssFeeds).values({ userId: ctx.user.id, url: input.url, customTitle: input.customTitle || null, title: parsed.title, description: parsed.description, faviconUrl: parsed.faviconUrl, lastFetchedAt: new Date() });
      const feedId = Number(inserted[0].insertId);
      await saveParsedFeed(ctx.user.id, feedId, parsed);
      return { id: feedId, ...parsed, customTitle: input.customTitle || null, url: input.url };
    }),
    refresh: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => refreshOwnedFeed(ctx.user.id, input.id)),
    refreshAll: protectedProcedure.mutation(async ({ ctx }) => {
      const feeds = await listFeeds(ctx.user.id, true);
      return refreshFeedBatch(feeds);
    }),
    setEnabled: protectedProcedure.input(z.object({ id: z.number().int().positive(), isEnabled: z.boolean() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); if (!(await getFeed(ctx.user.id, input.id))) throw new TRPCError({ code: "NOT_FOUND" }); await db.update(rssFeeds).set({ isEnabled: input.isEnabled }).where(and(eq(rssFeeds.id, input.id), eq(rssFeeds.userId, ctx.user.id))); return { success: true, isEnabled: input.isEnabled }; }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); const feed = await getFeed(ctx.user.id, input.id); if (!feed) throw new TRPCError({ code: "NOT_FOUND" }); await db.delete(feedGroups).where(eq(feedGroups.feedId, input.id)); await db.delete(rssArticles).where(eq(rssArticles.feedId, input.id)); await db.delete(rssFeeds).where(and(eq(rssFeeds.id, input.id), eq(rssFeeds.userId, ctx.user.id))); return { success: true }; }),
  }),
  group: router({
    list: protectedProcedure.query(({ ctx }) => listGroups(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(160) })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); const result = await db.insert(rssGroups).values({ userId: ctx.user.id, name: input.name }); return { id: Number(result[0].insertId), name: input.name }; }),
    createWithFeeds: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(160), feedIds: z.array(z.number().int().positive()).min(1).max(100) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const feedIds = Array.from(new Set(input.feedIds));
      const ownedFeeds = await Promise.all(feedIds.map((feedId) => getFeed(ctx.user.id, feedId)));
      if (ownedFeeds.some((feed) => !feed)) throw new TRPCError({ code: "NOT_FOUND", message: "One or more sources were not found" });
      const result = await db.insert(rssGroups).values({ userId: ctx.user.id, name: input.name });
      const groupId = Number(result[0].insertId);
      await db.insert(feedGroups).values(feedIds.map((feedId) => ({ feedId, groupId })));
      return { id: groupId, name: input.name, feedIds };
    }),
    rename: protectedProcedure.input(z.object({ id: z.number().positive(), name: z.string().trim().min(1).max(160) })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db || !(await getGroup(ctx.user.id, input.id))) throw new TRPCError({ code: "NOT_FOUND" }); await db.update(rssGroups).set({ name: input.name }).where(and(eq(rssGroups.id, input.id), eq(rssGroups.userId, ctx.user.id))); return { success: true }; }),
    delete: protectedProcedure.input(z.object({ id: z.number().positive() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db || !(await getGroup(ctx.user.id, input.id))) throw new TRPCError({ code: "NOT_FOUND" }); await db.delete(feedGroups).where(eq(feedGroups.groupId, input.id)); await db.delete(rssGroups).where(and(eq(rssGroups.id, input.id), eq(rssGroups.userId, ctx.user.id))); return { success: true }; }),
    articles: protectedProcedure.input(z.object({ id: z.number().positive() })).query(async ({ ctx, input }) => { if (!(await getGroup(ctx.user.id, input.id))) throw new TRPCError({ code: "NOT_FOUND" }); const ids = await groupFeedIds(ctx.user.id, input.id); return listArticlesForFeeds(ids, ids.length * ARTICLE_HISTORY_LIMIT); }),
    refresh: protectedProcedure.input(z.object({ id: z.number().positive() })).mutation(async ({ ctx, input }) => { if (!(await getGroup(ctx.user.id, input.id))) throw new TRPCError({ code: "NOT_FOUND" }); const ids = new Set(await groupFeedIds(ctx.user.id, input.id)); return refreshFeedBatch((await listFeeds(ctx.user.id, true)).filter((feed) => ids.has(feed.id))); }),
  }),
  assignment: router({
    list: protectedProcedure.input(z.object({ groupId: z.number().positive() })).query(({ ctx, input }) => groupFeedIds(ctx.user.id, input.groupId)),
    set: protectedProcedure.input(z.object({ feedId: z.number().positive(), groupId: z.number().positive(), assigned: z.boolean() })).mutation(async ({ ctx, input }) => { if (input.assigned) await assignFeed(ctx.user.id, input.feedId, input.groupId); else await unassignFeed(ctx.user.id, input.feedId, input.groupId); return { success: true }; }),
  }),
});
export type AppRouter = typeof appRouter;
