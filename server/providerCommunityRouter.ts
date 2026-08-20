import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createProviderCommunityPost, ensureUserProfile, listProviderCommunitiesForUser, listProviderCommunityPostsForUser } from "./db";
import { protectedProcedure, router } from "./_core/trpc";

const providerHostname = z.string().trim().toLowerCase().min(1).max(255).regex(/^[a-z0-9.-]+$/, "Use a provider hostname such as youtube.com");
const postTitle = z.string().trim().min(1).max(300);
const postBody = z.string().trim().max(6000).optional();

export const providerCommunityRouter = router({
  list: protectedProcedure.query(({ ctx }) => listProviderCommunitiesForUser(ctx.user.id)),
  get: protectedProcedure.input(z.object({ providerHostname })).query(async ({ ctx, input }) => {
    const community = await listProviderCommunityPostsForUser(ctx.user.id, input.providerHostname);
    if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Add an RSS source from this provider before opening its community" });
    return community;
  }),
  createPost: protectedProcedure.input(z.object({ providerHostname, title: postTitle, body: postBody })).mutation(async ({ ctx, input }) => {
    if (!(await ensureUserProfile(ctx.user.id, ctx.user.name))) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not load your profile" });
    const post = await createProviderCommunityPost(ctx.user.id, input.providerHostname, input.title, input.body);
    if (!post) throw new TRPCError({ code: "FORBIDDEN", message: "Add an RSS source from this provider before posting to its community" });
    return post;
  }),
});
