import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    addStoryReply: vi.fn(),
    addStoryRepost: vi.fn(),
    ensureUserProfile: vi.fn(),
    getStoryDiscussion: vi.fn(),
    getUserProfileByUsername: vi.fn(),
    listProfileProviderCommunityPosts: vi.fn(),
    listProfilePulse: vi.fn(),
    listStoryReposts: vi.fn(),
    openStoryDiscussion: vi.fn(),
    updateUserProfile: vi.fn(),
  };
});

import { addStoryReply, addStoryRepost, ensureUserProfile, getStoryDiscussion, getUserProfileByUsername, listProfileProviderCommunityPosts, listProfilePulse, listStoryReposts, openStoryDiscussion, updateUserProfile } from "./db";
import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: { id: 42, openId: "reader-42", name: "Reader", email: "reader@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Story Pulse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens one shared story context for signed-in members while removing tracking parameters from its identity", async () => {
    vi.mocked(openStoryDiscussion).mockResolvedValue({ id: 12, storyUrl: "https://example.com/launch" } as never);

    await expect(appRouter.createCaller(createContext()).storyPulse.open({ storyUrl: "https://example.com/launch?utm_source=rss" })).resolves.toMatchObject({ id: 12, storyUrl: "https://example.com/launch" });

    expect(openStoryDiscussion).toHaveBeenCalledWith({ storyUrl: "https://example.com/launch" });
  });

  it("lets a signed-in member publish a repost beneath an existing story context", async () => {
    vi.mocked(getStoryDiscussion).mockResolvedValue({ id: 12, storyUrl: "https://example.com/launch" } as never);
    vi.mocked(ensureUserProfile).mockResolvedValue({ userId: 42, displayName: "Reader", bio: null } as never);
    vi.mocked(addStoryRepost).mockResolvedValue({ id: 30, discussionId: 12, userId: 42, content: "Worth watching", createdAt: new Date() } as never);

    await expect(appRouter.createCaller(createContext()).storyPulse.repost({ discussionId: 12, content: "Worth watching" })).resolves.toMatchObject({ id: 30, content: "Worth watching" });

    expect(addStoryRepost).toHaveBeenCalledWith(42, 12, "Worth watching");
  });

  it("publishes a quote answer directly beneath a question Thread", async () => {
    vi.mocked(getStoryDiscussion).mockResolvedValue({ id: 12, storyUrl: "https://example.com/launch" } as never);
    vi.mocked(ensureUserProfile).mockResolvedValue({ userId: 42, displayName: "Reader", bio: null } as never);
    vi.mocked(addStoryReply).mockResolvedValue({ id: 31, discussionId: 12, userId: 42, parentPostId: 30, quotedPostId: 30, content: "The evidence is in the launch data", createdAt: new Date() } as never);

    await expect(appRouter.createCaller(createContext()).storyPulse.reply({ discussionId: 12, parentPostId: 30, quotedPostId: 30, content: "The evidence is in the launch data" })).resolves.toMatchObject({ id: 31, parentPostId: 30, quotedPostId: 30 });

    expect(addStoryReply).toHaveBeenCalledWith(42, 12, 30, "The evidence is in the launch data", 30);
  });

  it("normalizes a member username before persisting a profile update", async () => {
    vi.mocked(getUserProfileByUsername).mockResolvedValue(undefined);
    vi.mocked(updateUserProfile).mockResolvedValue({ userId: 42, displayName: "Reader", username: "reader_orbit", bio: "Signals and launches" } as never);

    await expect(appRouter.createCaller(createContext()).storyPulse.profile.update({ displayName: "Reader", username: "Reader_Orbit", bio: "Signals and launches" })).resolves.toMatchObject({ username: "reader_orbit" });

    expect(getUserProfileByUsername).toHaveBeenCalledWith("reader_orbit");
    expect(updateUserProfile).toHaveBeenCalledWith(42, "Reader", "reader_orbit", "Signals and launches");
  });

  it("rejects a username already owned by another member", async () => {
    vi.mocked(getUserProfileByUsername).mockResolvedValue({ userId: 7, displayName: "Orbit", username: "orbit", bio: null } as never);

    await expect(appRouter.createCaller(createContext()).storyPulse.profile.update({ displayName: "Reader", username: "orbit" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  it("returns a member profile together with that member's repost activity", async () => {
    vi.mocked(ensureUserProfile).mockResolvedValue({ userId: 42, displayName: "Reader", bio: "Signals and launches" } as never);
    vi.mocked(listProfilePulse).mockResolvedValue([{ id: 30, discussionId: 12, content: "Worth watching", sourceLabel: "NASA", storyTitle: "Launch update", storyLink: "https://example.com/launch", createdAt: new Date() }] as never);
    vi.mocked(listProfileProviderCommunityPosts).mockResolvedValue([{ id: 44, communityId: 3, providerHostname: "youtube.com", title: "Launch discussion", body: null, createdAt: new Date() }] as never);
    vi.mocked(listStoryReposts).mockResolvedValue([]);

    await expect(appRouter.createCaller(createContext()).storyPulse.profile.activity()).resolves.toMatchObject({ profile: { displayName: "Reader" }, reposts: [{ storyTitle: "Launch update" }], communityPosts: [{ providerHostname: "youtube.com" }] });
  });
});
