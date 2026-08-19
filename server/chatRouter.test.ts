import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    addChatMessage: vi.fn(),
    createChatBranch: vi.fn(),
    createChatConversation: vi.fn(),
    getChatBranchHistory: vi.fn(),
    getChatConversation: vi.fn(),
    listChatConversations: vi.fn(),
  };
});

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

import { invokeLLM } from "./_core/llm";
import { addChatMessage, createChatBranch, getChatBranchHistory, getChatConversation } from "./db";
import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: { id: 42, openId: "reader-42", name: "Reader", email: "reader@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("private chat branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a branch only from an owned conversation and message", async () => {
    vi.mocked(getChatConversation).mockResolvedValue({ id: 8, userId: 42, title: "Morning signal", parentConversationId: null, forkMessageId: null } as never);
    vi.mocked(createChatBranch).mockResolvedValue({ id: 9, userId: 42, title: "Morning signal · branch", parentConversationId: 8, forkMessageId: 14 } as never);

    await expect(appRouter.createCaller(createContext()).chat.branch({ conversationId: 8, messageId: 14 })).resolves.toMatchObject({ id: 9, parentConversationId: 8, forkMessageId: 14 });
    expect(createChatBranch).toHaveBeenCalledWith(42, 8, 14, "Morning signal · branch");

    vi.mocked(getChatConversation).mockResolvedValue(undefined);
    await expect(appRouter.createCaller(createContext()).chat.branch({ conversationId: 99, messageId: 14 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("sends inherited branch context to the model and stores both messages privately", async () => {
    vi.mocked(getChatConversation).mockResolvedValue({ id: 9, userId: 42, title: "Morning signal · branch", parentConversationId: 8, forkMessageId: 14 } as never);
    vi.mocked(getChatBranchHistory).mockResolvedValue([
      { id: 10, conversationId: 8, role: "user", content: "Summarize NASA", createdAt: new Date(), inherited: true },
      { id: 14, conversationId: 8, role: "assistant", content: "NASA update", createdAt: new Date(), inherited: true },
    ]);
    vi.mocked(addChatMessage)
      .mockResolvedValueOnce({ id: 20, conversationId: 9, role: "user", content: "Focus on launches" } as never)
      .mockResolvedValueOnce({ id: 21, conversationId: 9, role: "assistant", content: "Launch-focused reply" } as never);
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { role: "assistant", content: "Launch-focused reply" } }] } as never);

    const result = await appRouter.createCaller(createContext()).chat.send({ conversationId: 9, content: "Focus on launches" });

    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ messages: expect.arrayContaining([
      expect.objectContaining({ role: "user", content: "Summarize NASA" }),
      expect.objectContaining({ role: "assistant", content: "NASA update" }),
      expect.objectContaining({ role: "user", content: "Focus on launches" }),
    ]) }));
    expect(addChatMessage).toHaveBeenNthCalledWith(1, 42, 9, "user", "Focus on launches");
    expect(addChatMessage).toHaveBeenNthCalledWith(2, 42, 9, "assistant", "Launch-focused reply");
    expect(result.assistantMessage.content).toBe("Launch-focused reply");
  });
});

