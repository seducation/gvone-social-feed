import { describe, expect, it } from "vitest";
import { isReplyableStoryThread, ownsResource, sortArticlesByPublished } from "./db";

describe("RSS privacy and unified-feed helpers", () => {
  it("only treats resources belonging to the current user as owned", () => {
    expect(ownsResource(7, { userId: 7 })).toBe(true);
    expect(ownsResource(7, { userId: 8 })).toBe(false);
    expect(ownsResource(7, undefined)).toBe(false);
  });

  it("orders articles from multiple feeds newest first", () => {
    const sorted = sortArticlesByPublished([
      { id: 1, publishedAt: new Date("2026-08-18T08:00:00Z") },
      { id: 2, publishedAt: new Date("2026-08-19T08:00:00Z") },
      { id: 3, publishedAt: null },
    ]);
    expect(sorted.map((article) => article.id)).toEqual([2, 1, 3]);
  });

  it("permits answers only beneath top-level question Threads", () => {
    expect(isReplyableStoryThread({ parentPostId: null })).toBe(true);
    expect(isReplyableStoryThread({ parentPostId: 14 })).toBe(false);
    expect(isReplyableStoryThread(undefined)).toBe(false);
  });
});
