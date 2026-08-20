// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ replyPost: vi.fn(), invalidate: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, loading: false }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({ topicCommunity: { discussion: { invalidate: mocks.invalidate } } }), topicCommunity: {
  discussion: { useQuery: () => ({ isLoading: false, data: window.location.pathname.includes("/thread/") ? { community: { name: "Space" }, isMember: true, kind: "thread", entry: { id: 11, title: "Launch update", body: "A story Thread", sourceStoryUrl: "https://example.com/launch", createdAt: new Date(), displayName: "Orbit" }, replies: [] } : { community: { name: "Space" }, isMember: true, kind: "post", entry: { id: 6, title: "Community update", body: "A plain post", createdAt: new Date(), displayName: "Reader" }, replies: [] } }) },
  reply: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, replyToPost: { useMutation: () => ({ mutate: mocks.replyPost, isPending: false }) },
} } }));

import TopicDiscussion from "./TopicDiscussion";

describe("topic discussion page", () => {
  afterEach(() => cleanup());
  it("shows an ordinary post conversation and submits its dedicated Reply", () => {
    window.history.pushState({}, "", "/topics/space/discussion/post/6");
    render(<TopicDiscussion />);
    expect(screen.getByText("Community update")).toBeTruthy();
    expect(screen.getByText("No replies yet. Start the discussion.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reply"), { target: { value: "Useful update." } });
    fireEvent.click(screen.getByRole("button", { name: "Send Reply" }));
    expect(mocks.replyPost).toHaveBeenCalledWith({ postId: 6, body: "Useful update." });
  });

  it("expands the RSS story reference for a Thread only on its discussion page", () => {
    window.history.pushState({}, "", "/topics/space/discussion/thread/11");
    render(<TopicDiscussion />);
    fireEvent.click(screen.getByRole("button", { name: /Expand/i }));
    expect(screen.getByText("https://example.com/launch")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open original story" }).getAttribute("href")).toBe("https://example.com/launch");
  });
});
