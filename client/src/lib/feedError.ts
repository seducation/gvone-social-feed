export function feedErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/service unavailable|bad gateway|gateway timeout|temporarily unavailable|HTTP 50[234]/i.test(message)) return "The feed service is temporarily unavailable. Please try again in a moment.";
  return message || "Could not add that feed";
}
