import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    createProviderCommunityPost: vi.fn(),
    ensureUserProfile: vi.fn(),
    listAllProviderCommunityPosts: vi.fn(),
    listProviderCommunitiesForUser: vi.fn(),
    listPostableProviderCommunitiesForUser: vi.fn(),
    listProviderCommunityPostsForUser: vi.fn(),
  };
});

import { createProviderCommunityPost, ensureUserProfile, listAllProviderCommunityPosts, listPostableProviderCommunitiesForUser, listProviderCommunitiesForUser, listProviderCommunityPostsForUser } from "./db";
import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: { id: 42, openId: "reader-42", name: "Reader", email: "reader@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Provider communities", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists every existing provider community for any signed-in member to visit", async () => {
    vi.mocked(listProviderCommunitiesForUser).mockResolvedValue([{ id: 1, providerHostname: "youtube.com", createdAt: new Date(), updatedAt: new Date() }, { id: 2, providerHostname: "cnn.com", createdAt: new Date(), updatedAt: new Date() }] as never);

    await expect(appRouter.createCaller(createContext()).providerCommunity.list()).resolves.toMatchObject([{ providerHostname: "youtube.com" }, { providerHostname: "cnn.com" }]);
    expect(listProviderCommunitiesForUser).toHaveBeenCalledWith(42);
  });

  it("lists only a member's saved providers as choices for creating a community post", async () => {
    vi.mocked(listPostableProviderCommunitiesForUser).mockResolvedValue([{ id: 1, providerHostname: "youtube.com", createdAt: new Date(), updatedAt: new Date() }] as never);

    await expect(appRouter.createCaller(createContext()).providerCommunity.mine()).resolves.toMatchObject([{ providerHostname: "youtube.com" }]);
    expect(listPostableProviderCommunitiesForUser).toHaveBeenCalledWith(42);
  });

  it("returns a mixed newest-first post feed from every provider community", async () => {
    vi.mocked(listAllProviderCommunityPosts).mockResolvedValue([{ id: 12, communityId: 1, providerHostname: "youtube.com", userId: 7, title: "Launch discussion", body: null, createdAt: new Date(), displayName: "Orbit", username: "orbit" }, { id: 11, communityId: 2, providerHostname: "cnn.com", userId: 8, title: "World update", body: null, createdAt: new Date(), displayName: "North", username: "north" }] as never);

    await expect(appRouter.createCaller(createContext()).providerCommunity.allPosts()).resolves.toMatchObject([{ providerHostname: "youtube.com", username: "orbit" }, { providerHostname: "cnn.com", username: "north" }]);
  });

  it("publishes a titled post into a provider community the member has joined through RSS", async () => {
    vi.mocked(ensureUserProfile).mockResolvedValue({ userId: 42, displayName: "Reader", username: "reader", bio: null } as never);
    vi.mocked(createProviderCommunityPost).mockResolvedValue({ id: 9, communityId: 1, userId: 42, title: "Launch discussion", body: "What stood out?", createdAt: new Date() } as never);

    await expect(appRouter.createCaller(createContext()).providerCommunity.createPost({ providerHostname: "youtube.com", title: "Launch discussion", body: "What stood out?" })).resolves.toMatchObject({ id: 9, title: "Launch discussion" });
    expect(createProviderCommunityPost).toHaveBeenCalledWith(42, "youtube.com", "Launch discussion", "What stood out?");
  });

  it("prevents publishing to a provider the member has not added as an RSS source", async () => {
    vi.mocked(ensureUserProfile).mockResolvedValue({ userId: 42, displayName: "Reader", username: "reader", bio: null } as never);
    vi.mocked(createProviderCommunityPost).mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createContext()).providerCommunity.createPost({ providerHostname: "cnn.com", title: "World update" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns community posts with their member attribution", async () => {
    vi.mocked(listProviderCommunityPostsForUser).mockResolvedValue({ community: { id: 1, providerHostname: "youtube.com", createdAt: new Date(), updatedAt: new Date() }, posts: [{ id: 9, communityId: 1, userId: 42, title: "Launch discussion", body: null, createdAt: new Date(), displayName: "Reader", username: "reader" }] } as never);

    await expect(appRouter.createCaller(createContext()).providerCommunity.get({ providerHostname: "youtube.com" })).resolves.toMatchObject({ community: { providerHostname: "youtube.com" }, posts: [{ username: "reader" }] });
  });
});
