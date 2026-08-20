// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  repostMutate: vi.fn(),
  profileUpdateMutate: vi.fn(),
  invalidatePulse: vi.fn().mockResolvedValue(undefined),
  invalidateProfile: vi.fn().mockResolvedValue(undefined),
  pulse: {
    discussion: { id: 12, storyUrl: "https://example.com/launch" },
    reposts: [{ id: 30, discussionId: 12, userId: 7, displayName: "Orbit", bio: null, content: "Worth watching", createdAt: new Date("2026-08-20T08:00:00Z") }],
  },
  profile: {
    profile: { userId: 42, displayName: "Reader", bio: "Signals and launches" },
    reposts: [{ id: 30, discussionId: 12, storyUrl: "https://example.com/launch", content: "Worth watching", createdAt: new Date("2026-08-20T08:00:00Z") }],
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
    mocks.profileUpdateMutate.mockClear();
    window.history.pushState({}, "", "/");
  });

  it("keeps the original RSS story fixed above repost-only activity", () => {
    window.history.pushState({}, "", "/pulse/12");
    render(<StoryPulse />);

    expect(screen.getByText("RSS story · live context")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Launch update" })).toBeTruthy();
    expect(screen.getByText("Pulse activity")).toBeTruthy();
    expect(screen.getByText("Reposted")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your repost"), { target: { value: "My signal" } });
    fireEvent.click(screen.getByRole("button", { name: "Repost" }));
    expect(mocks.repostMutate).toHaveBeenCalledWith({ discussionId: 12, content: "My signal" });
  });

  it("shows every Story Pulse repost in the member profile signal trail", () => {
    render(<Profile />);

    expect(screen.getByRole("heading", { name: "Reader" })).toBeTruthy();
    expect(screen.getByText("Signal trail")).toBeTruthy();
    expect(screen.getByText("Launch update")).toBeTruthy();
    expect(screen.getByText("Worth watching")).toBeTruthy();
  });
});
