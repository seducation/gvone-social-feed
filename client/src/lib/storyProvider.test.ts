import { describe, expect, it } from "vitest";
import { publicStoryProviderLabel } from "./storyProvider";

describe("publicStoryProviderLabel", () => {
  it("uses only the canonical provider hostname for YouTube stories", () => {
    expect(publicStoryProviderLabel("https://www.youtube.com/@NASA/videos?utm_source=rss")).toBe("youtube.com");
  });

  it("uses the same neutral hostname rule for non-YouTube stories", () => {
    expect(publicStoryProviderLabel("https://www.cnn.com/world/2026/08/20/story.html")).toBe("cnn.com");
    expect(publicStoryProviderLabel("https://www.reddit.com/r/technology/comments/example")).toBe("reddit.com");
  });

  it("returns a safe fallback for malformed story URLs", () => {
    expect(publicStoryProviderLabel("not a URL")).toBe("RSS source");
  });
});
