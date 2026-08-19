export function shouldStartPageLoadRefresh({
  isAuthenticated,
  isDashboardLoading,
  hasRefreshedOnLoad,
  feedCount,
}: {
  isAuthenticated: boolean;
  isDashboardLoading: boolean;
  hasRefreshedOnLoad: boolean;
  feedCount: number;
}) {
  return isAuthenticated && !isDashboardLoading && !hasRefreshedOnLoad && feedCount > 0;
}
