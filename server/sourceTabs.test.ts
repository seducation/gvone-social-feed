import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getSourceTabOrder: vi.fn(), saveSourceTabOrder: vi.fn() };
});

import { getSourceTabOrder, saveSourceTabOrder } from "./db";
import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: { id: 42, openId: "reader-42", name: "Reader", email: "reader@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("private source-tab preferences", () => {
  beforeEach(() => {
    vi.mocked(getSourceTabOrder).mockReset();
    vi.mocked(saveSourceTabOrder).mockReset();
  });

  it("returns and saves only the caller’s editable tab order", async () => {
    vi.mocked(getSourceTabOrder).mockResolvedValue(["reddit", "youtube"]);
    vi.mocked(saveSourceTabOrder).mockResolvedValue(true);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.sourceTabs.order()).resolves.toEqual(["reddit", "youtube"]);
    await expect(caller.sourceTabs.setOrder({ keys: ["reddit", "youtube", "domain:cnn.com"] })).resolves.toEqual({ success: true, keys: ["reddit", "youtube", "domain:cnn.com"] });
    expect(getSourceTabOrder).toHaveBeenCalledWith(42);
    expect(saveSourceTabOrder).toHaveBeenCalledWith(42, ["reddit", "youtube", "domain:cnn.com"]);
  });

  it("rejects duplicate tab keys before saving a preference", async () => {
    await expect(appRouter.createCaller(createContext()).sourceTabs.setOrder({ keys: ["youtube", "youtube"] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(saveSourceTabOrder).not.toHaveBeenCalled();
  });
});
