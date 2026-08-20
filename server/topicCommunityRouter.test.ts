import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    createTopicCommunity: vi.fn(),
    createTopicCommunityPost: vi.fn(),
    createTopicCommunityReply: vi.fn(),
    createTopicCommunityThread: vi.fn(),
    ensureUserProfile: vi.fn(),
    getTopicCommunityBySlug: vi.fn(),
    getTopicCommunityForUser: vi.fn(),
    joinTopicCommunity: vi.fn(),
    leaveTopicCommunity: vi.fn(),
    listTopicCommunitiesForUser: vi.fn(),
  };
});

import {
  createTopicCommunity,
  createTopicCommunityPost,
  ensureUserProfile,
  getTopicCommunityBySlug,
  getTopicCommunityForUser,
  listTopicCommunitiesForUser,
} from "./db";
import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: { id: 42, openId: "reader-42", name: "Reader", email: "reader@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const spaceTopic = { id: 9, slug: "space", name: "Space", description: "Launches and missions", creatorUserId: 7, createdAt: new Date(), updatedAt: new Date() };

describe("Topic communities", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists discoverable member-created topic communities for any signed-in member", async () => {
    vi.mocked(listTopicCommunitiesForUser).mockResolvedValue([{ ...spaceTopic, isMember: false, memberCount: 3, threadCount: 2 }] as never);

    await expect(appRouter.createCaller(createContext()).topicCommunity.list()).resolves.toMatchObject([{ slug: "space", memberCount: 3 }]);
    expect(listTopicCommunitiesForUser).toHaveBeenCalledWith(42);
  });

  it("creates a standalone user topic and assigns its creator through the protected storage helper", async () => {
    vi.mocked(ensureUserProfile).mockResolvedValue({ userId: 42, displayName: "Reader", username: "reader", bio: null } as never);
    vi.mocked(getTopicCommunityBySlug).mockResolvedValue(undefined);
    vi.mocked(createTopicCommunity).mockResolvedValue({ ...spaceTopic, creatorUserId: 42 } as never);

    await expect(appRouter.createCaller(createContext()).topicCommunity.create({ slug: "space", name: "Space", description: "Launches and missions" })).resolves.toMatchObject({ slug: "space", creatorUserId: 42 });
    expect(createTopicCommunity).toHaveBeenCalledWith(42, { slug: "space", name: "Space", description: "Launches and missions" });
  });

  it("lets a joined member publish an ordinary topic post without starting an RSS Thread", async () => {
    vi.mocked(ensureUserProfile).mockResolvedValue({ userId: 42, displayName: "Reader", username: "reader", bio: null } as never);
    vi.mocked(createTopicCommunityPost).mockResolvedValue({ id: 24, communityId: 9, userId: 42, title: null, body: "A plain member update.", createdAt: new Date() } as never);

    await expect(appRouter.createCaller(createContext()).topicCommunity.createPost({ slug: "space", body: "A plain member update." })).resolves.toMatchObject({ id: 24, body: "A plain member update." });
    expect(createTopicCommunityPost).toHaveBeenCalledWith(42, "space", "A plain member update.", undefined);
  });

  it("rejects an ordinary post when the member has not joined that topic", async () => {
    vi.mocked(ensureUserProfile).mockResolvedValue({ userId: 42, displayName: "Reader", username: "reader", bio: null } as never);
    vi.mocked(createTopicCommunityPost).mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createContext()).topicCommunity.createPost({ slug: "space", body: "A plain member update." })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns a topic page with ordinary posts alongside its Thread discussion", async () => {
    vi.mocked(getTopicCommunityForUser).mockResolvedValue({ community: spaceTopic, isMember: true, memberCount: 3, posts: [{ id: 24, communityId: 9, userId: 42, title: null, body: "A plain member update.", createdAt: new Date(), displayName: "Reader", username: "reader" }], threads: [] } as never);

    await expect(appRouter.createCaller(createContext()).topicCommunity.get({ slug: "space" })).resolves.toMatchObject({ community: { slug: "space" }, posts: [{ body: "A plain member update." }], threads: [] });
  });
});
