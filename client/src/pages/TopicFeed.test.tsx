// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, loading: false }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { topicCommunity: { allFeed: { useQuery: () => ({ isLoading: false, data: [
  { id: 9, kind: "post", communityId: 2, communitySlug: "space", communityName: "Space", userId: 7, title: "Mission update", body: "A new spacecraft is ready.", createdAt: new Date("2026-08-20T09:00:00Z"), displayName: "Orbit", username: "orbit" },
  { id: 8, kind: "thread", communityId: 3, communitySlug: "technology", communityName: "Technology", userId: 8, title: "Model safety", body: "What needs to change?", sourceStoryUrl: "https://example.com/ai", story: { id: 18, title: "Full AI safety RSS story", link: "https://example.com/ai", description: "The complete article context from the RSS source.", thumbnailUrl: null, videoUrl: null, videoMimeType: null, publishedAt: new Date("2026-08-20T08:00:00Z") }, createdAt: new Date("2026-08-20T08:00:00Z"), displayName: "Reader", username: "reader" },
] }) } } } }));

import TopicFeed from "./TopicFeed";

describe("all-topic community feed", () => {
  it("shows mixed topic posts and Threads with topic links plus a discover-and-create entry", () => {
    render(<TopicFeed />);
    expect(screen.getByRole("heading", { name: "All topic posts" })).toBeTruthy();
    expect(screen.getByText("Mission update")).toBeTruthy();
    expect(screen.getByText("Model safety")).toBeTruthy();
    expect(screen.getByText("Full AI safety RSS story")).toBeTruthy();
    expect(screen.getByText("Thread")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Space" }).getAttribute("href")).toBe("/topics/space");
    expect(screen.getByRole("link", { name: "Discover & create" }).getAttribute("href")).toBe("/topics");
  });
});
