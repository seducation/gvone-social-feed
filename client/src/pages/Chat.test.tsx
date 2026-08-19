// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  conversations: [] as Array<{ id: number; title: string; parentConversationId: number | null; forkMessageId: number | null }>,
  activeChat: undefined as undefined | { conversation: { id: number; title: string; parentConversationId: number | null; forkMessageId: number | null }; inheritedMessageCount: number; messages: Array<{ id: number; conversationId: number; role: "user" | "assistant"; content: string; inherited: boolean }> },
  createMutate: vi.fn(),
  branchMutate: vi.fn(),
  sendMutate: vi.fn(),
  invalidateList: vi.fn().mockResolvedValue(undefined),
  invalidateGet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, loading: false }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/AIChatBox", () => ({
  AIChatBox: ({ messages, messageActions }: { messages: Array<{ id?: number; content: string; inherited?: boolean }>; messageActions?: (message: { id?: number; content: string; inherited?: boolean }, index: number) => React.ReactNode }) => <div>{messages.map((message, index) => <div key={message.id ?? index}><span>{message.content}</span>{message.inherited && <span>Inherited memory</span>}{messageActions?.(message, index)}</div>)}</div>,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ chat: { list: { invalidate: mocks.invalidateList }, get: { invalidate: mocks.invalidateGet } } }),
    chat: {
      list: { useQuery: () => ({ data: mocks.conversations, isLoading: false }) },
      get: { useQuery: () => ({ data: mocks.activeChat, isLoading: false }) },
      create: { useMutation: () => ({ mutate: mocks.createMutate, isPending: false }) },
      branch: { useMutation: () => ({ mutate: mocks.branchMutate, isPending: false }) },
      send: { useMutation: () => ({ mutate: mocks.sendMutate, isPending: false }) },
    },
  },
}));

import Chat from "./Chat";

describe("gvone chat workspace", () => {
  afterEach(() => {
    cleanup();
    mocks.conversations.splice(0);
    mocks.activeChat = undefined;
    mocks.createMutate.mockClear();
    mocks.branchMutate.mockClear();
    mocks.sendMutate.mockClear();
  });

  it("creates a private conversation from the empty chat workspace", () => {
    render(<Chat />);

    fireEvent.click(screen.getByRole("button", { name: "Create conversation" }));
    expect(mocks.createMutate).toHaveBeenCalledWith({});
  });

  it("shows inherited branch memory and creates a branch from a direct message", async () => {
    mocks.conversations.push({ id: 9, title: "Launch plan · branch", parentConversationId: 8, forkMessageId: 14 });
    mocks.activeChat = {
      conversation: { id: 9, title: "Launch plan · branch", parentConversationId: 8, forkMessageId: 14 },
      inheritedMessageCount: 2,
      messages: [
        { id: 10, conversationId: 8, role: "user", content: "Research NASA", inherited: true },
        { id: 14, conversationId: 8, role: "assistant", content: "NASA context", inherited: true },
        { id: 20, conversationId: 9, role: "user", content: "Focus on launches", inherited: false },
      ],
    };
    render(<Chat />);

    await waitFor(() => expect(screen.getByText("2 remembered messages")).toBeTruthy());
    expect(screen.getAllByText("Inherited memory")).toHaveLength(2);
    const branchButtons = screen.getAllByRole("button", { name: "Branch from here" });
    expect(branchButtons).toHaveLength(3);
    fireEvent.click(branchButtons[0]);
    expect(mocks.branchMutate).toHaveBeenCalledWith({ conversationId: 8, messageId: 10 });
    fireEvent.click(branchButtons[2]);
    expect(mocks.branchMutate).toHaveBeenLastCalledWith({ conversationId: 9, messageId: 20 });
  });
});
