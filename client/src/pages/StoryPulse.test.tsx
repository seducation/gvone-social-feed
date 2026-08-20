// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  repostMutate: vi.fn(),
  replyMutate: vi.fn(),
  profileUpdateMutate: vi.fn(),
  invalidatePulse: vi.fn().mockResolvedValue(undefined),
  invalidateProfile: vi.fn().mockResolvedValue(undefined),
  pulse: {
    discussion: { id: 12, storyUrl: "https://example.com/launch" },
    reposts: [{ id: 30, discussionId: 12, userId: 7, displayName: "Orbit", username: "orbit", bio: null, content: "What does this launch prove?", createdAt: new Date("2026-08-20T08:00:00Z"), replies: [{ id: 31, discussionId: 12, userId: 42, displayName: "Reader", username: "reader", bio: null, parentPostId: 30, quotedPostId: 30, quotedDisplayName: "Orbit", quotedUsername: "orbit", quotedContent: "What does this launch prove?", content: "It verifies the new engine performance.", createdAt: new Date("2026-08-20T08:10:00Z") }] }],
  },
  profile: {
    profile: { userId: 42, displayName: "Reader", username: "reader", bio: "Signals and launches" },
    reposts: [{ id: 30, discussionId: 12, storyUrl: "https://example.com/launch", parentPostId: null, quotedPostId: null, content: "What does this launch prove?", createdAt: new Date("2026-08-20T08:00:00Z") }, { id: 31, discussionId: 12, storyUrl: "https://example.com/launch", parentPostId: 30, quotedPostId: 30, parentDisplayName: "Orbit", parentUsername: "orbit", parentContent: "What does this launch prove?", quotedDisplayName: "Orbit", quotedUsername: "orbit", quotedContent: "What does this launch prove?", content: "It verifies the new engine performance.", createdAt: new Date("2026-08-20T08:10:00Z") }],
  },
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, loading: false }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ storyPulse: { get: { invalidate: mocks.invalidatePulse }, profile: { activity: { invalidate: mocks.invalidateProfile } } } }),
    storyPulse: {
      get: { useQuery: () => ({ data: mocks.pulse, isLoading: false, error: null }) },
      repost: { useMutation: () => ({ mutate: mocks.repostMutate, isPending: false }) },
      reply: { useMutation: () => ({ mutate: mocks.replyMutate, isPending: false }) },
      profile: {
        activity: { useQuery: () => ({ data: mocks.profile, isLoading: false }) },
        update: { useMutation: () => ({ mutate: mocks.profileUpdateMutate, isPending: false }) },
      },
    },
    feed: { articles: { useQuery: () => ({ data: [{ id: 4, feedId: 9, title: "Launch update", link: "https://example.com/launch", description: "A launch briefing", thumbnailUrl: null }], isLoading: false }) } },
    dashboard: { useQuery: () => ({ data: { feeds: [{ id: 9, title: "NASA", customTitle: null }] }, isLoading: false }) },
  },
}));

import Profile from "./Profile";
import StoryPulse from "./StoryPulse";

describe("Story Pulse and member profile", () => {
  afterEach(() => {
    cleanup();
    mocks.repostMutate.mockClear();
    mocks.replyMutate.mockClear();
    mocks.profileUpdateMutate.mockClear();
    window.history.pushState({}, "", "/");
  });

  it("keeps the original RSS story fixed above question Threads and their quote answers", () => {
    window.history.pushState({}, "", "/pulse/12");
    render(<StoryPulse />);

    expect(screen.getByText("RSS story · live context")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Launch update" })).toBeTruthy();
    expect(screen.getByText("Questions")).toBeTruthy();
    expect(screen.getByText("Question Thread")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Ask a question"), { target: { value: "My question" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask question" }));
    expect(mocks.repostMutate).toHaveBeenCalledWith({ discussionId: 12, content: "My question" });
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "My answer" } });
    fireEvent.click(screen.getByRole("button", { name: "Post answer" }));
    expect(mocks.replyMutate).toHaveBeenCalledWith({ discussionId: 12, parentPostId: 30, quotedPostId: 30, content: "My answer" });
    expect(screen.getByText("@orbit")).toBeTruthy();
    expect(screen.getByText("In answer to @orbit’s question")).toBeTruthy();
  });

  it("separates question Threads from quote answers in the member profile", () => {
    render(<Profile />);

    expect(screen.getByRole("heading", { name: "Reader" })).toBeTruthy();
    expect(screen.getByText("@reader")).toBeTruthy();
    expect(screen.getByText("Your questions")).toBeTruthy();
    expect(screen.getByText("Your answers")).toBeTruthy();
    expect(screen.getByText("1 question asked")).toBeTruthy();
    expect(screen.getByText("1 answer shared")).toBeTruthy();
    expect(screen.getAllByText("Launch update").length).toBe(2);
    expect(screen.getAllByText("What does this launch prove?").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("It verifies the new engine performance.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByPlaceholderText("unique_username"), { target: { value: "reader_orbit" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(mocks.profileUpdateMutate).toHaveBeenCalledWith({ displayName: "Reader", username: "reader_orbit", bio: "Signals and launches" });
  });
});
