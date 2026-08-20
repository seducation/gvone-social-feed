import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { addStoryReply, addStoryRepost, ensureUserProfile, getStoryDiscussion, getUserProfileByUsername, listProfileProviderCommunityPosts, listProfilePulse, listStoryReposts, openStoryDiscussion, updateUserProfile } from "./db";

const displayName = z.string().trim().min(1).max(80);
const username = z.string().trim().min(3).max(30).regex(/^[a-z][a-z0-9_]*$/i, "Use 3–30 letters, numbers, or underscores, starting with a letter");
const bio = z.string().trim().max(280).optional();
const repostContent = z.string().trim().min(1).max(600);
const storyInput = z.object({ storyUrl: z.string().url().max(2048) });

function normalizeStoryUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  for (const key of Array.from(url.searchParams.keys())) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  return url.toString();
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export const storyPulseRouter = router({
  profile: router({
    me: protectedProcedure.query(({ ctx }) => ensureUserProfile(ctx.user.id, ctx.user.name)),
    update: protectedProcedure.input(z.object({ displayName, username, bio })).mutation(async ({ ctx, input }) => {
      const normalizedUsername = normalizeUsername(input.username);
      const usernameOwner = await getUserProfileByUsername(normalizedUsername);
      if (usernameOwner && usernameOwner.userId !== ctx.user.id) throw new TRPCError({ code: "CONFLICT", message: "That username is already taken" });
      const profile = await updateUserProfile(ctx.user.id, input.displayName, normalizedUsername, input.bio);
      if (!profile) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not update profile" });
      return profile;
    }),
    activity: protectedProcedure.query(async ({ ctx }) => {
      const profile = await ensureUserProfile(ctx.user.id, ctx.user.name);
      if (!profile) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not load profile" });
      return { profile, reposts: await listProfilePulse(ctx.user.id), communityPosts: await listProfileProviderCommunityPosts(ctx.user.id) };
    }),
  }),
  open: protectedProcedure.input(storyInput).mutation(async ({ input }) => {
    const discussion = await openStoryDiscussion({ storyUrl: normalizeStoryUrl(input.storyUrl) });
    if (!discussion) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not open Story Pulse" });
    return discussion;
  }),
  get: protectedProcedure.input(z.object({ discussionId: z.number().int().positive() })).query(async ({ input }) => {
    const discussion = await getStoryDiscussion(input.discussionId);
    if (!discussion) throw new TRPCError({ code: "NOT_FOUND", message: "Story Pulse not found" });
    return { discussion, reposts: await listStoryReposts(discussion.id) };
  }),
  repost: protectedProcedure.input(z.object({ discussionId: z.number().int().positive(), content: repostContent })).mutation(async ({ ctx, input }) => {
    const discussion = await getStoryDiscussion(input.discussionId);
    if (!discussion) throw new TRPCError({ code: "NOT_FOUND", message: "Story Pulse not found" });
    if (!(await ensureUserProfile(ctx.user.id, ctx.user.name))) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not load profile" });
    const repost = await addStoryRepost(ctx.user.id, discussion.id, input.content);
    if (!repost) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not publish repost" });
    return repost;
  }),
  reply: protectedProcedure.input(z.object({
    discussionId: z.number().int().positive(),
    parentPostId: z.number().int().positive(),
    quotedPostId: z.number().int().positive().optional(),
    content: repostContent,
  })).mutation(async ({ ctx, input }) => {
    const discussion = await getStoryDiscussion(input.discussionId);
    if (!discussion) throw new TRPCError({ code: "NOT_FOUND", message: "Story Pulse not found" });
    if (!(await ensureUserProfile(ctx.user.id, ctx.user.name))) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not load profile" });
    const reply = await addStoryReply(ctx.user.id, discussion.id, input.parentPostId, input.content, input.quotedPostId);
    if (!reply) throw new TRPCError({ code: "BAD_REQUEST", message: "Replies can only respond to a Thread in this Story Pulse" });
    return reply;
  }),
});
