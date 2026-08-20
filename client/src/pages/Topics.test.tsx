// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  createMutate: vi.fn(),
  joinMutate: vi.fn(),
  leaveMutate: vi.fn(),
  createPostMutate: vi.fn(),
  createThreadMutate: vi.fn(),
  replyMutate: vi.fn(),
  invalidateList: vi.fn().mockResolvedValue(undefined),
  invalidateGet: vi.fn().mockResolvedValue(undefined),
  topics: [{ id: 4, slug: "space", name: "Space", description: "Launches, missions, and the long view.", creatorUserId: 7, createdAt: new Date(), updatedAt: new Date(), isMember: true, memberCount: 3, threadCount: 1 }],
  detail: {
    community: { id: 4, slug: "space", name: "Space", description: "Launches, missions, and the long view.", creatorUserId: 7, createdAt: new Date(), updatedAt: new Date() },
    isMember: true,
    memberCount: 3,
    posts: [{ id: 6, communityId: 4, userId: 42, title: "Community update", body: "A plain member post without an RSS Thread.", createdAt: new Date("2026-08-20T07:30:00Z"), displayName: "Reader", username: "reader" }],
    threads: [{ id: 11, communityId: 4, userId: 7, title: "What does the next mission change?", body: "A focused angle for this community.", sourceStoryUrl: "https://example.com/launch", createdAt: new Date("2026-08-20T08:00:00Z"), updatedAt: new Date(), displayName: "Orbit", username: "orbit", replies: [{ id: 12, threadId: 11, userId: 42, body: "It opens a new path for research.", createdAt: new Date("2026-08-20T08:20:00Z"), displayName: "Reader", username: "reader" }] }],
  },
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, loading: false }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ topicCommunity: { list: { invalidate: mocks.invalidateList }, get: { invalidate: mocks.invalidateGet } } }),
    topicCommunity: {
      list: { useQuery: () => ({ data: mocks.topics, isLoading: false }) },
      get: { useQuery: () => ({ data: mocks.detail, isLoading: false }) },
      create: { useMutation: () => ({ mutate: mocks.createMutate, isPending: false }) },
      join: { useMutation: () => ({ mutate: mocks.joinMutate, isPending: false }) },
      leave: { useMutation: () => ({ mutate: mocks.leaveMutate, isPending: false }) },
      createPost: { useMutation: () => ({ mutate: mocks.createPostMutate, isPending: false }) },
      createThread: { useMutation: () => ({ mutate: mocks.createThreadMutate, isPending: false }) },
      reply: { useMutation: () => ({ mutate: mocks.replyMutate, isPending: false }) },
    },
  },
}));

import Topics from "./Topics";
import TopicCommunity from "./TopicCommunity";

describe("standalone topic communities", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.history.pushState({}, "", "/");
  });

  it("discovers user-created communities and exposes a dedicated creation flow", () => {
    window.history.pushState({}, "", "/topics");
    render(<Topics />);

    expect(screen.getByRole("heading", { name: "Discover Topics" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Space" }).getAttribute("href")).toBe("/topics/space");
    fireEvent.click(screen.getByRole("button", { name: "Create topic" }));
    fireEvent.change(screen.getByPlaceholderText("Space exploration"), { target: { value: "Climate futures" } });
    fireEvent.change(screen.getByPlaceholderText("What belongs in this community?"), { target: { value: "Discuss evidence and action." } });
    fireEvent.click(screen.getByRole("button", { name: "Create community" }));
    expect(mocks.createMutate).toHaveBeenCalledWith({ name: "Climate futures", slug: "climate-futures", description: "Discuss evidence and action." });
  });

  it("keeps ordinary posts separate from RSS Threads and permits a member Reply", () => {
    window.history.pushState({}, "", "/topics/space");
    render(<TopicCommunity />);

    expect(screen.getByText("Topic posts")).toBeTruthy();
    expect(screen.getByText("Community update")).toBeTruthy();
    expect(screen.getByText("A plain member post without an RSS Thread.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Topic post"), { target: { value: "A second ordinary post." } });
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));
    expect(mocks.createPostMutate).toHaveBeenCalledWith({ slug: "space", title: undefined, body: "A second ordinary post." });
    expect(screen.getByText("Topic Threads")).toBeTruthy();
    expect(screen.getByText(/Shared RSS story · example.com/i)).toBeTruthy();
    expect(screen.getByText("What does the next mission change?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    fireEvent.change(screen.getByLabelText("Your Reply"), { target: { value: "This deserves a closer look." } });
    fireEvent.click(screen.getByRole("button", { name: "Send Reply" }));
    expect(mocks.replyMutate).toHaveBeenCalledWith({ threadId: 11, body: "This deserves a closer look." });
  });
});
