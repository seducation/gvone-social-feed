// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, loading: false }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    providerCommunity: {
      allPosts: { useQuery: () => ({ isLoading: false, data: [
        { id: 12, providerHostname: "youtube.com", title: "Launch discussion", body: "The engine result is promising.", createdAt: new Date("2026-08-20T08:00:00Z"), displayName: "Orbit", username: "orbit" },
        { id: 11, providerHostname: "cnn.com", title: "World update", body: null, createdAt: new Date("2026-08-20T07:00:00Z"), displayName: "North", username: "north" },
      ] }) },
    },
  },
}));

import CommunityDirectory from "./CommunityDirectory";

describe("Community directory", () => {
  it("mixes posts from every provider community while preserving provider and author labels", () => {
    render(<CommunityDirectory />);

    expect(screen.getByRole("heading", { name: "All community posts" })).toBeTruthy();
    expect(screen.getByText("Launch discussion")).toBeTruthy();
    expect(screen.getByText("World update")).toBeTruthy();
    expect(screen.getByText("@orbit")).toBeTruthy();
    expect(screen.getByText("@north")).toBeTruthy();
    expect(screen.getByRole("link", { name: /youtube.com/i }).getAttribute("href")).toBe("/community/youtube.com");
    expect(screen.getByRole("link", { name: /cnn.com/i }).getAttribute("href")).toBe("/community/cnn.com");
  });
});
