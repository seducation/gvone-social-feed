export function publicStoryProviderLabel(storyUrl: string) {
  try {
    const url = new URL(storyUrl);
    const hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
    return hostname || "RSS source";
  } catch {
    return "RSS source";
  }
}
