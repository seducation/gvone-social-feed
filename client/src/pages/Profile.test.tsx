// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: { isAuthenticated: true, loading: false } }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ storyPulse: { profile: { activity: { invalidate: vi.fn() } } } }),
  storyPulse: { profile: {
    activity: { useQuery: () => ({ isLoading: false, data: { profile: { displayName: "Orbit", username: "orbit", bio: "Launch notes" }, reposts: [{ id: 2, discussionId: 4, parentPostId: null, storyUrl: "https://example.com/story", content: "A story Thread", createdAt: new Date() }], communityPosts: [{ id: 3, providerHostname: "youtube.com", title: "Provider launch", body: "A provider post", createdAt: new Date() }], topicActivity: [{ id: 8, kind: "thread", communityId: 9, communitySlug: "space", communityName: "Space", title: "New spacecraft", body: "A shared RSS Thread", sourceStoryUrl: "https://example.com/story", createdAt: new Date() }, { id: 7, kind: "post", communityId: 9, communitySlug: "space", communityName: "Space", title: "Mission note", body: "A compact topic post", createdAt: new Date() }] } }) },
    update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
  } },
} }));

import Profile from "./Profile";

describe("compact profile activity", () => {
  afterEach(() => { cleanup(); mocks.auth.loading = false; });

  it("groups topic posts and Threads under a compact Topics filter with discussion links", () => {
    render(<Profile />);
    expect(screen.getByText("Activity board")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Topics 2/ }));
    expect(screen.getByText("Space")).toBeTruthy();
    expect(screen.getByText("New spacecraft")).toBeTruthy();
    expect(screen.getByRole("link", { name: /New spacecraft/ }).getAttribute("href")).toBe("/topics/space/discussion/thread/8");
  });

  it("keeps Profile hooks stable when activity changes from loading to ready", () => {
    mocks.auth.loading = true;
    const view = render(<Profile />);
    expect(screen.queryByText("Activity board")).toBeNull();

    mocks.auth.loading = false;
    expect(() => view.rerender(<Profile />)).not.toThrow();
    expect(screen.getByText("Activity board")).toBeTruthy();
  });
});
