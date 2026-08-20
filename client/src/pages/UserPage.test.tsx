// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, loading: false, user: { id: 42 } }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    storyPulse: {
      profile: {
        public: { useQuery: () => ({ isLoading: false, data: { profile: { userId: 7, displayName: "Orbit", username: "orbit", bio: "Launch notes" }, reposts: [{ id: 30, discussionId: 12, storyUrl: "https://www.youtube.com/watch?v=launch", parentPostId: null, content: "What does this launch prove?", createdAt: new Date("2026-08-20T08:00:00Z") }], communityPosts: [{ id: 44, providerHostname: "youtube.com", title: "Launch discussion", body: "What stood out?", createdAt: new Date("2026-08-20T08:20:00Z") }] } }) },
      },
    },
  },
}));

import UserPage from "./UserPage";

describe("Public user page", () => {
  it("shows public past activity without profile editing controls for another member", () => {
    window.history.pushState({}, "", "/u/@orbit");
    render(<UserPage />);

    expect(screen.getByRole("heading", { name: "Orbit" })).toBeTruthy();
    expect(screen.getByText("@orbit")).toBeTruthy();
    expect(screen.getByText("Launch discussion")).toBeTruthy();
    expect(screen.getByText("What does this launch prove?")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /youtube.com/i })[0].getAttribute("href")).toBe("/community/youtube.com");
    expect(screen.queryByRole("link", { name: "Edit profile" })).toBeNull();
  });
});
