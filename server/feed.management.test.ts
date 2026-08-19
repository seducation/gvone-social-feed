import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: vi.fn(), getFeed: vi.fn(), listArticlesForFeeds: vi.fn() };
});

import { getDb, getFeed, listArticlesForFeeds } from "./db";
import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: { id: 42, openId: "reader-42", name: "Reader", email: "reader@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("feed source management", () => {
  beforeEach(() => {
    vi.mocked(getDb).mockReset();
    vi.mocked(getFeed).mockReset();
    vi.mocked(listArticlesForFeeds).mockReset();
  });

  it("updates a private source enabled state and blocks an unowned source", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    vi.mocked(getDb).mockResolvedValue({ update } as never);
    vi.mocked(getFeed).mockResolvedValue({ id: 7, userId: 42, isEnabled: true } as never);

    await expect(appRouter.createCaller(createContext()).feed.setEnabled({ id: 7, isEnabled: false })).resolves.toEqual({ success: true, isEnabled: false });
    expect(update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ isEnabled: false });

    await expect(appRouter.createCaller(createContext()).feed.setEnabled({ id: 7, isEnabled: true })).resolves.toEqual({ success: true, isEnabled: true });
    expect(update).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenLastCalledWith({ isEnabled: true });

    vi.mocked(getFeed).mockResolvedValue(undefined);
    await expect(appRouter.createCaller(createContext()).feed.setEnabled({ id: 77, isEnabled: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("permanently removes a private source together with assignments and stored articles, but blocks unowned removal", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockReturnValue({ where });
    vi.mocked(getDb).mockResolvedValue({ delete: remove } as never);
    vi.mocked(getFeed).mockResolvedValue({ id: 7, userId: 42, isEnabled: true } as never);

    await expect(appRouter.createCaller(createContext()).feed.remove({ id: 7 })).resolves.toEqual({ success: true });
    expect(remove).toHaveBeenCalledTimes(3);
    expect(where).toHaveBeenCalledTimes(3);

    vi.mocked(getFeed).mockResolvedValue(undefined);
    await expect(appRouter.createCaller(createContext()).feed.remove({ id: 77 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(remove).toHaveBeenCalledTimes(3);
  });

  it("keeps saved articles privately readable from the manager when the source is disabled", async () => {
    const articles = [{ id: 55, feedId: 7, title: "Saved while enabled", link: "https://example.com/story", description: null, publishedAt: null }];
    vi.mocked(getFeed).mockResolvedValue({ id: 7, userId: 42, isEnabled: false } as never);
    vi.mocked(listArticlesForFeeds).mockResolvedValue(articles as never);

    await expect(appRouter.createCaller(createContext()).feed.sourceArticles({ id: 7 })).resolves.toEqual(articles);
    expect(listArticlesForFeeds).toHaveBeenCalledWith([7], 500);
  });

  it("creates a category group with selected private sources and rejects an unowned source", async () => {
    const groupValues = vi.fn().mockResolvedValue([{ insertId: 31 }]);
    const assignmentValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValueOnce({ values: groupValues }).mockReturnValueOnce({ values: assignmentValues });
    vi.mocked(getDb).mockResolvedValue({ insert } as never);
    vi.mocked(getFeed).mockImplementation(async (_userId, feedId) => ({ id: feedId, userId: 42, isEnabled: true }) as never);

    await expect(appRouter.createCaller(createContext()).group.createWithFeeds({ name: "Space desk", feedIds: [7, 9, 7] })).resolves.toEqual({ id: 31, name: "Space desk", feedIds: [7, 9] });
    expect(groupValues).toHaveBeenCalledWith({ userId: 42, name: "Space desk" });
    expect(assignmentValues).toHaveBeenCalledWith([{ feedId: 7, groupId: 31 }, { feedId: 9, groupId: 31 }]);

    vi.mocked(getFeed).mockResolvedValueOnce({ id: 7, userId: 42, isEnabled: true } as never).mockResolvedValueOnce(undefined);
    await expect(appRouter.createCaller(createContext()).group.createWithFeeds({ name: "Blocked", feedIds: [7, 99] })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
