import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { addStoryReply, addStoryRepost, createProfilePost, createTopicCommunityThread, ensureUserProfile, getStoryDiscussion, getTopicCommunityBySlug, getUserProfileByUsername, isTopicCommunityMember, listProfilePosts, listProfileProviderCommunityPosts, listProfilePulse, listProfileTopicActivity, listStoryReposts, openStoryDiscussion, updateUserProfile, userHasSavedStoryUrl } from "./db";

const displayName = z.string().trim().min(1).max(80);
const username = z.string().trim().min(3).max(30).regex(/^[a-z][a-z0-9_]*$/i, "Use 3–30 letters, numbers, or underscores, starting with a letter");
const publicUsername = z.string().trim().min(4).max(31).regex(/^@?[a-z][a-z0-9_]*$/i, "Use a valid username");
const bio = z.string().trim().max(280).optional();
const repostContent = z.string().trim().min(1).max(600);
const profilePostTitle = z.string().trim().max(160).optional();
const profilePostBody = z.string().trim().min(1).max(2_000);
const storyInput = z.object({ storyUrl: z.string().url().max(2048) });
const topicSlug = z.string().trim().toLowerCase().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

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
    createPost: protectedProcedure.input(z.object({ title: profilePostTitle, body: profilePostBody })).mutation(async ({ ctx, input }) => {
      if (!(await ensureUserProfile(ctx.user.id, ctx.user.name))) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not load profile" });
      const post = await createProfilePost(ctx.user.id, input);
      if (!post) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not publish Profile post" });
      return post;
    }),
    activity: protectedProcedure.query(async ({ ctx }) => {
      const profile = await ensureUserProfile(ctx.user.id, ctx.user.name);
      if (!profile) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not load profile" });
      return { profile, profilePosts: await listProfilePosts(ctx.user.id), reposts: await listProfilePulse(ctx.user.id), communityPosts: await listProfileProviderCommunityPosts(ctx.user.id), topicActivity: await listProfileTopicActivity(ctx.user.id) };
    }),
    public: protectedProcedure.input(z.object({ username: publicUsername })).query(async ({ input }) => {
      const normalizedUsername = normalizeUsername(input.username.replace(/^@/, ""));
      const profile = await getUserProfileByUsername(normalizedUsername);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "User page not found" });
      return { profile, profilePosts: await listProfilePosts(profile.userId), reposts: await listProfilePulse(profile.userId), communityPosts: await listProfileProviderCommunityPosts(profile.userId), topicActivity: await listProfileTopicActivity(profile.userId) };
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
  repost: protectedProcedure.input(z.object({ discussionId: z.number().int().positive(), content: repostContent, topicSlugs: z.array(topicSlug).max(10).optional().refine((values) => !values || new Set(values).size === values.length, "Topics must be unique") })).mutation(async ({ ctx, input }) => {
    const discussion = await getStoryDiscussion(input.discussionId);
    if (!discussion) throw new TRPCError({ code: "NOT_FOUND", message: "Story Pulse not found" });
    if (!(await ensureUserProfile(ctx.user.id, ctx.user.name))) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not load profile" });
    const topicSlugs = input.topicSlugs ?? [];
    if (topicSlugs.length && !(await userHasSavedStoryUrl(ctx.user.id, discussion.storyUrl))) throw new TRPCError({ code: "FORBIDDEN", message: "Only a story saved in your reader can be shared to Topics" });
    for (const slug of topicSlugs) {
      const topic = await getTopicCommunityBySlug(slug);
      if (!topic || !(await isTopicCommunityMember(ctx.user.id, topic.id))) throw new TRPCError({ code: "FORBIDDEN", message: "Join every selected topic before publishing there" });
    }
    const repost = await addStoryRepost(ctx.user.id, discussion.id, input.content);
    if (!repost) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not publish repost" });
    const publishedTopicSlugs: string[] = [];
    for (const slug of topicSlugs) {
      const topicThread = await createTopicCommunityThread(ctx.user.id, slug, { title: "Shared RSS Story Thread", body: input.content, sourceStoryUrl: discussion.storyUrl });
      if (!topicThread) throw new TRPCError({ code: "CONFLICT", message: "This RSS story already has a Thread in one of the selected topics" });
      publishedTopicSlugs.push(slug);
    }
    return { ...repost, publishedTopicSlugs };
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
