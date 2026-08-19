import { describe, expect, it } from "vitest";
import { shouldStartPageLoadRefresh } from "./dashboardRefresh";

describe("shouldStartPageLoadRefresh", () => {
  it("refreshes once after an authenticated dashboard with saved sources becomes ready", () => {
    expect(shouldStartPageLoadRefresh({ isAuthenticated: true, isDashboardLoading: false, hasRefreshedOnLoad: false, feedCount: 3 })).toBe(true);
  });

  it("does not refresh while unauthenticated, loading, already refreshed, or empty", () => {
    expect(shouldStartPageLoadRefresh({ isAuthenticated: false, isDashboardLoading: false, hasRefreshedOnLoad: false, feedCount: 1 })).toBe(false);
    expect(shouldStartPageLoadRefresh({ isAuthenticated: true, isDashboardLoading: true, hasRefreshedOnLoad: false, feedCount: 1 })).toBe(false);
    expect(shouldStartPageLoadRefresh({ isAuthenticated: true, isDashboardLoading: false, hasRefreshedOnLoad: true, feedCount: 1 })).toBe(false);
    expect(shouldStartPageLoadRefresh({ isAuthenticated: true, isDashboardLoading: false, hasRefreshedOnLoad: false, feedCount: 0 })).toBe(false);
  });
});
