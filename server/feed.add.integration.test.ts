import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: { id: 42, openId: "reader-42", name: "Reader", email: "reader@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("feed.add integration error handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes a real plain-text 503 response into a readable tRPC error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Service Unavailable", { status: 503, headers: { "content-type": "text/plain" } })));
    const caller = appRouter.createCaller(createContext());
    await expect(caller.feed.add({ url: "https://example.com/outage.xml" })).rejects.toThrow("The feed service is temporarily unavailable. Please try again in a moment.");
  });
});
