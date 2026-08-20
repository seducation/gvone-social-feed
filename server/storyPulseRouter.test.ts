import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    addStoryRepost: vi.fn(),
    ensureUserProfile: vi.fn(),
    getStoryDiscussion: vi.fn(),
    listProfilePulse: vi.fn(),
    listStoryReposts: vi.fn(),
    openStoryDiscussion: vi.fn(),
    updateUserProfile: vi.fn(),
  };
});

import { addStoryRepost, ensureUserProfile, getStoryDiscussion, listProfilePulse, listStoryReposts, openStoryDiscussion } from "./db";
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

  it("returns a member profile together with that member's repost activity", async () => {
    vi.mocked(ensureUserProfile).mockResolvedValue({ userId: 42, displayName: "Reader", bio: "Signals and launches" } as never);
    vi.mocked(listProfilePulse).mockResolvedValue([{ id: 30, discussionId: 12, content: "Worth watching", sourceLabel: "NASA", storyTitle: "Launch update", storyLink: "https://example.com/launch", createdAt: new Date() }] as never);
    vi.mocked(listStoryReposts).mockResolvedValue([]);

    await expect(appRouter.createCaller(createContext()).storyPulse.profile.activity()).resolves.toMatchObject({ profile: { displayName: "Reader" }, reposts: [{ storyTitle: "Launch update" }] });
  });
});
