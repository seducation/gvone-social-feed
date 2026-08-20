// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: { isAuthenticated: true, loading: false }, createProfilePost: vi.fn() }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ storyPulse: { profile: { activity: { invalidate: vi.fn() } } } }),
  storyPulse: { profile: {
    activity: { useQuery: () => ({ isLoading: false, data: { profile: { displayName: "Orbit", username: "orbit", bio: "Launch notes" }, profilePosts: [{ id: 9, userId: 1, title: "Profile log", body: "A personal activity update", createdAt: new Date("2026-08-20T15:00:00Z") }], reposts: [{ id: 2, discussionId: 4, parentPostId: null, storyUrl: "https://example.com/story", content: "A story Thread", createdAt: new Date("2026-08-20T10:00:00Z"), story: { thumbnailUrl: "https://images.example.com/pulse.jpg", videoUrl: null, videoMimeType: null } }, { id: 3, discussionId: 4, parentPostId: 2, storyUrl: "https://example.com/story", content: "A helpful story Reply", createdAt: new Date("2026-08-20T11:00:00Z"), story: { thumbnailUrl: "https://images.example.com/pulse.jpg", videoUrl: null, videoMimeType: null } }], communityPosts: [{ id: 4, providerHostname: "youtube.com", title: "Provider launch", body: "A provider post", createdAt: new Date("2026-08-20T12:00:00Z") }], topicActivity: [{ id: 8, kind: "thread", communityId: 9, communitySlug: "space", communityName: "Space", title: "New spacecraft", body: "A shared RSS Thread", sourceStoryUrl: "https://example.com/story", createdAt: new Date("2026-08-20T13:00:00Z"), story: { thumbnailUrl: "https://images.example.com/space.jpg", videoUrl: null, videoMimeType: null } }, { id: 7, kind: "post", communityId: 9, communitySlug: "space", communityName: "Space", title: "Mission note", body: "A compact topic post", createdAt: new Date("2026-08-20T14:00:00Z") }] } }) },
    update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    createPost: { useMutation: () => ({ mutate: mocks.createProfilePost, isPending: false }) },
  } },
} }));

import Profile from "./Profile";

describe("compact profile activity", () => {
  afterEach(() => { cleanup(); mocks.auth.loading = false; mocks.createProfilePost.mockClear(); });

  it("renders every user contribution in a compact mixed Overview grid", () => {
    render(<Profile />);
    const grid = screen.getByTestId("profile-overview-grid");
    expect(grid.className).toContain("grid-cols-2");
    expect(screen.getByTestId("profile-overview-column-0").querySelectorAll("a")).toHaveLength(3);
    expect(screen.getByTestId("profile-overview-column-1").querySelectorAll("a")).toHaveLength(3);
    expect(grid.querySelectorAll("a")).toHaveLength(6);
    expect(screen.getAllByRole("img", { name: /Preview for/ })).toHaveLength(3);
    expect(screen.getByRole("img", { name: "Preview for New spacecraft" }).getAttribute("src")).toBe("https://images.example.com/space.jpg");
    expect(screen.getByRole("link", { name: "Story Pulse: Story Pulse Thread" }).getAttribute("href")).toBe("/pulse/4#thread-2");
    expect(screen.getByRole("link", { name: "Story Pulse: Story Pulse Reply" }).getAttribute("href")).toBe("/pulse/4#thread-2");
    expect(screen.getByRole("link", { name: "Provider post: Provider launch" }).getAttribute("href")).toBe("/community/youtube.com");
    expect(screen.getByRole("link", { name: "RSS Thread: New spacecraft" }).getAttribute("href")).toBe("/topics/space/discussion/thread/8");
    expect(screen.getByRole("link", { name: "Topic post: Mission note" }).getAttribute("href")).toBe("/topics/space/discussion/post/7");
    expect(screen.getByRole("link", { name: "Profile post: Profile log" }).getAttribute("href")).toBe("/profile#profile-post-9");
  });

  it("opens the header composer and shows Profile posts in their dedicated activity tab", () => {
    render(<Profile />);
    expect(screen.getAllByRole("button", { name: "Create Profile post" })).toHaveLength(1);
    const trigger = screen.getByRole("button", { name: "Create Profile post" });
    expect(screen.getByTestId("profile-header").lastElementChild).toBe(trigger);
    expect(trigger.className).toContain("ml-auto");
    fireEvent.click(trigger);
    const composer = screen.getByRole("dialog", { name: "New Profile post" });
    expect(composer).toBeTruthy();
    expect(screen.getByTestId("profile-activity-board").contains(composer)).toBe(false);
    fireEvent.change(screen.getByPlaceholderText("Title (optional)"), { target: { value: "Fresh note" } });
    fireEvent.change(screen.getByPlaceholderText("Share a profile update…"), { target: { value: "Publishing from my Profile header." } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(mocks.createProfilePost).toHaveBeenCalledWith({ title: "Fresh note", body: "Publishing from my Profile header." });

    fireEvent.click(screen.getByRole("button", { name: /Profile posts 1/ }));
    expect(screen.getByText("Profile log")).toBeTruthy();
    expect(screen.getByText("A personal activity update")).toBeTruthy();
  });

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
