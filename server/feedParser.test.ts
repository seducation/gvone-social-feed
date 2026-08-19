import { describe, expect, it, vi } from "vitest";
import { parseFeed } from "./feedParser";

describe("parseFeed", () => {
  it("normalizes RSS metadata, article fields, thumbnails, and video enclosures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`<?xml version="1.0"?><rss><channel><title>Studio Notes</title><description>Ideas worth keeping.</description><item><guid>story-1</guid><title>Make room for better ideas</title><link>/story-1</link><description><![CDATA[<p>A thoughtful story.</p><img src="/cover.jpg" />]]></description><pubDate>Tue, 19 Aug 2026 08:00:00 GMT</pubDate><enclosure url="https://cdn.example.com/story.mp4" type="video/mp4" /></item></channel></rss>`, { status: 200 })));
    const result = await parseFeed("https://studio.example.com/feed.xml");
    expect(result.title).toBe("Studio Notes");
    expect(result.articles[0]).toMatchObject({ guid: "story-1", link: "https://studio.example.com/story-1", thumbnailUrl: "https://studio.example.com/cover.jpg", videoUrl: "https://cdn.example.com/story.mp4", videoMimeType: "video/mp4" });
  });

  it("discovers a site icon and embedded video source", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(`<?xml version="1.0"?><rss><channel><title>Video Notes</title><item><title>Clip</title><link>https://example.com/clip</link><description><![CDATA[<video controls><source src="/clip.mp4" type="video/mp4" /></video>]]></description></item></channel></rss>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(`<html><head><link rel="icon" href="/brand-icon.png" /></head></html>`, { status: 200 })));
    const result = await parseFeed("https://example.com/feed.xml");
    expect(result.faviconUrl).toBe("https://example.com/brand-icon.png");
    expect(result.articles[0]?.videoUrl).toBe("https://example.com/clip.mp4");
  });

  it("supports Atom entries", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`<feed><title>Atom Daily</title><entry><id>tag:example.com,2026:1</id><title>Atom story</title><link href="https://example.com/story"/><updated>2026-08-19T08:00:00Z</updated><summary>Summary</summary></entry></feed>`, { status: 200 })));
    const result = await parseFeed("https://example.com/atom.xml");
    expect(result.title).toBe("Atom Daily");
    expect(result.articles[0]?.title).toBe("Atom story");
    expect(result.articles[0]?.link).toBe("https://example.com/story");
  });
});
