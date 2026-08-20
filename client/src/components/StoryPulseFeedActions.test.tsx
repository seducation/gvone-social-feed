// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), setLocation: vi.fn() }));

vi.mock("wouter", () => ({ useLocation: () => ["/", mocks.setLocation] }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, loading: false }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    storyPulse: { open: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) } },
    feed: { articles: { useQuery: () => ({ data: [], isLoading: false }) } },
    dashboard: { useQuery: () => ({ data: { feeds: [] }, isLoading: false }) },
  },
}));

import { StoryPulseFeedActions } from "./StoryPulseFeedActions";

describe("Story Pulse feed actions", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    mocks.mutate.mockClear();
    mocks.setLocation.mockClear();
  });

  it("adds a Thread action to a rendered RSS story and opens Story Pulse with its fixed context", () => {
    document.body.innerHTML = `<main><article><div><div class="mb-4"><div class="truncate">NASA</div></div><a href="https://example.com/launch"><h2>Launch update</h2><p>A launch briefing</p></a><div class="mt-5 flex items-center justify-between"><span>Open original story</span></div></div></article></main>`;
    render(<StoryPulseFeedActions />);

    const button = screen.getByRole("button", { name: "Open Story Pulse for Launch update" });
    expect(screen.getByRole("button", { name: "Find related stories for Launch update" })).toBeTruthy();
    fireEvent.click(button);

    expect(mocks.mutate).toHaveBeenCalledWith({ storyUrl: "https://example.com/launch" });
  });
});
