// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshAllMutate: vi.fn(),
  toastSuccess: vi.fn(),
  invalidateDashboard: vi.fn().mockResolvedValue(undefined),
  invalidateArticles: vi.fn().mockResolvedValue(undefined),
  invalidateGroupArticles: vi.fn().mockResolvedValue(undefined),
  refreshAllOptions: undefined as { onSuccess?: (data: { attempted: number; refreshed: number }) => Promise<void> } | undefined,
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false, logout: vi.fn() }),
}));
vi.mock("@/lib/feedError", () => ({ feedErrorMessage: (error: Error) => error.message }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ dashboard: { invalidate: mocks.invalidateDashboard }, feed: { articles: { invalidate: mocks.invalidateArticles } }, group: { articles: { invalidate: mocks.invalidateGroupArticles } } }),
    dashboard: { useQuery: () => ({ isLoading: false, data: { feeds: [{ id: 7, title: "Example feed", customTitle: null, faviconUrl: null }], groups: [] } }) },
    feed: {
      articles: { useQuery: () => ({ data: [] }) },
      add: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      refresh: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      refreshAll: { useMutation: (options: typeof mocks.refreshAllOptions) => { mocks.refreshAllOptions = options; return { mutate: mocks.refreshAllMutate, isPending: false }; } },
      remove: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    group: {
      articles: { useQuery: () => ({ data: [] }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      refresh: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      rename: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    assignment: {
      list: { useQuery: () => ({ data: [] }) },
      set: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import Home from "./Home";

describe("dashboard reload refresh controls", () => {
  afterEach(() => {
    cleanup();
    mocks.refreshAllMutate.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.invalidateDashboard.mockClear();
    mocks.invalidateArticles.mockClear();
    mocks.invalidateGroupArticles.mockClear();
    mocks.refreshAllOptions = undefined;
  });

  it("refreshes saved feeds once after dashboard load and exposes feedback controls", async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", { configurable: true, value: scrollTo });
    render(<Home />);

    await waitFor(() => expect(mocks.refreshAllMutate).toHaveBeenCalledTimes(1));
    expect((screen.getByRole("button", { name: "Refresh all feeds" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Scroll to top of feed" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });

    await mocks.refreshAllOptions?.onSuccess?.({ attempted: 1, refreshed: 1 });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Updated 1 of 1 sources");
    expect(mocks.invalidateDashboard).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateArticles).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateGroupArticles).toHaveBeenCalledTimes(1);
  });
});
