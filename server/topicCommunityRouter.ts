import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTopicCommunity,
  createTopicCommunityPost,
  createTopicCommunityReply,
  createTopicCommunityThread,
  ensureUserProfile,
  getTopicCommunityBySlug,
  getTopicCommunityForUser,
  joinTopicCommunity,
  leaveTopicCommunity,
  listTopicCommunitiesForUser,
} from "./db";
import { protectedProcedure, router } from "./_core/trpc";

const topicSlug = z.string().trim().toLowerCase().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens");
const topicName = z.string().trim().min(2).max(80);
const topicDescription = z.string().trim().max(500).optional();
const threadTitle = z.string().trim().min(1).max(300);
const threadBody = z.string().trim().max(6000).optional();
const sourceStoryUrl = z.string().url().max(2048).optional();
const replyBody = z.string().trim().min(1).max(6000);
const postTitle = z.string().trim().min(1).max(300).optional();
const postBody = z.string().trim().min(1).max(6000);

export const topicCommunityRouter = router({
  list: protectedProcedure.query(({ ctx }) => listTopicCommunitiesForUser(ctx.user.id)),
  get: protectedProcedure.input(z.object({ slug: topicSlug })).query(async ({ ctx, input }) => {
    const topic = await getTopicCommunityForUser(ctx.user.id, input.slug);
    if (!topic) throw new TRPCError({ code: "NOT_FOUND", message: "Topic community not found" });
    return topic;
  }),
  create: protectedProcedure.input(z.object({ slug: topicSlug, name: topicName, description: topicDescription })).mutation(async ({ ctx, input }) => {
    if (!(await ensureUserProfile(ctx.user.id, ctx.user.name))) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not load your profile" });
    if (await getTopicCommunityBySlug(input.slug)) throw new TRPCError({ code: "CONFLICT", message: "That topic address is already in use" });
    const community = await createTopicCommunity(ctx.user.id, input);
    if (!community) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create the topic community" });
    return community;
  }),
  join: protectedProcedure.input(z.object({ slug: topicSlug })).mutation(async ({ ctx, input }) => {
    const community = await joinTopicCommunity(ctx.user.id, input.slug);
    if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Topic community not found" });
    return community;
  }),
  leave: protectedProcedure.input(z.object({ slug: topicSlug })).mutation(async ({ ctx, input }) => {
    if (!(await leaveTopicCommunity(ctx.user.id, input.slug))) throw new TRPCError({ code: "NOT_FOUND", message: "Topic community not found" });
    return { success: true };
  }),
  createPost: protectedProcedure.input(z.object({ slug: topicSlug, title: postTitle, body: postBody })).mutation(async ({ ctx, input }) => {
    if (!(await ensureUserProfile(ctx.user.id, ctx.user.name))) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not load your profile" });
    const post = await createTopicCommunityPost(ctx.user.id, input.slug, input.body, input.title);
    if (!post) throw new TRPCError({ code: "FORBIDDEN", message: "Join this topic before publishing a post" });
    return post;
  }),
  createThread: protectedProcedure.input(z.object({ slug: topicSlug, title: threadTitle, body: threadBody, sourceStoryUrl })).mutation(async ({ ctx, input }) => {
    if (!(await ensureUserProfile(ctx.user.id, ctx.user.name))) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not load your profile" });
    const thread = await createTopicCommunityThread(ctx.user.id, input.slug, input);
    if (!thread) throw new TRPCError({ code: "FORBIDDEN", message: "Join this topic before starting a Thread. RSS stories must come from your saved reader." });
    return thread;
  }),
  reply: protectedProcedure.input(z.object({ threadId: z.number().int().positive(), body: replyBody })).mutation(async ({ ctx, input }) => {
    if (!(await ensureUserProfile(ctx.user.id, ctx.user.name))) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not load your profile" });
    const reply = await createTopicCommunityReply(ctx.user.id, input.threadId, input.body);
    if (!reply) throw new TRPCError({ code: "FORBIDDEN", message: "Join the topic before replying to this Thread" });
    return reply;
  }),
});
