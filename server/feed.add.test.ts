import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./feedParser", () => ({
  parseFeed: vi.fn().mockRejectedValue(new Error("Maximum nested tags exceeded")),
}));

describe("feed.add", () => {
  it("returns a readable parser error when a feed cannot be parsed", async () => {
    const ctx: TrpcContext = {
      user: { id: 42, openId: "reader-42", name: "Reader", email: "reader@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.feed.add({ url: "https://example.com/feed.xml" })).rejects.toThrow("Maximum nested tags exceeded");
  });
});
