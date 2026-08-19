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

  it("extracts playable media from Media RSS content and groups even when another enclosure comes first", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`<?xml version="1.0"?><rss xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Clips</title><item><title>Media content clip</title><link>https://example.com/one</link><enclosure url="https://example.com/audio.mp3" type="audio/mpeg" /><media:content url="/clips/one.webm" medium="video" /></item><item><title>Grouped clip</title><link>https://example.com/two</link><media:group><media:content url="/clips/two.mp4" type="video/mp4" /></media:group></item></channel></rss>`, { status: 200 })));
    const result = await parseFeed("https://example.com/feed.xml");
    expect(result.articles.map((article) => [article.videoUrl, article.videoMimeType])).toEqual([
      ["https://example.com/clips/one.webm", "video/webm"],
      ["https://example.com/clips/two.mp4", "video/mp4"],
    ]);
  });

  it("extracts Atom video enclosure links and makes YouTube Atom entries embeddable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015"><title>Video atom</title><entry><id>atom-video</id><title>Atom enclosure</title><link href="https://example.com/story"/><link rel="enclosure" href="/video.m3u8" type="application/vnd.apple.mpegurl"/></entry><entry><id>yt:video:abc123</id><yt:videoId>abc123</yt:videoId><title>YouTube upload</title><link href="https://www.youtube.com/watch?v=abc123"/></entry></feed>`, { status: 200 })));
    const result = await parseFeed("https://example.com/atom.xml");
    expect(result.articles[0]).toMatchObject({ videoUrl: "https://example.com/video.m3u8", videoMimeType: "application/vnd.apple.mpegurl" });
    expect(result.articles[1]).toMatchObject({ videoUrl: "https://www.youtube.com/embed/abc123", videoMimeType: "text/html" });
  });

  it("supports namespaced RSS and RDF/RSS 1.0 roots", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(`<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><rss:channel><rss:title>RDF Journal</rss:title></rss:channel><rss:item><rss:title>Namespaced story</rss:title><rss:link>https://example.com/namespaced</rss:link><dc:date>2026-08-19T08:00:00Z</dc:date></rss:item></rdf:RDF>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(`<html><head></head></html>`, { status: 200 })));
    const result = await parseFeed("https://example.com/rdf.xml");
    expect(result.title).toBe("RDF Journal");
    expect(result.articles[0]?.title).toBe("Namespaced story");
  });

  it("discovers a feed from a common endpoint path", async () => {
    const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>Common path feed</title><item><title>Story</title><link>https://example.com/story</link></item></channel></rss>`;
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(`<html><head><title>Example</title></head><body>News</body></html>`, { status: 200 }))
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(new Response(rss, { status: 200, headers: { "content-type": "application/rss+xml" } }))
      .mockResolvedValueOnce(new Response(`<html><link rel="icon" href="/favicon.ico"></html>`, { status: 200 })));
    const result = await parseFeed("https://example.com/news");
    expect(result.title).toBe("Common path feed");
  });

  it("discovers a feed from an RSS-labeled anchor", async () => {
    const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>Anchor feed</title><item><title>Story</title><link>https://example.com/story</link></item></channel></rss>`;
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(`<html><body><a href="/custom-feed">RSS feed</a></body></html>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(rss, { status: 200, headers: { "content-type": "application/rss+xml" } }))
      .mockResolvedValueOnce(new Response(`<html><link rel="icon" href="/favicon.ico"></html>`, { status: 200 })));
    const result = await parseFeed("https://example.com/news");
    expect(result.title).toBe("Anchor feed");
  });

  it("normalizes a plain-text upstream service outage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Service Unavailable", { status: 503 })));
    await expect(parseFeed("https://example.com/outage.xml")).rejects.toThrow("Feed returned HTTP 503");
  });

  it("explains when a non-YouTube feed blocks server access", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("login required", { status: 403 })));
    await expect(parseFeed("https://example.com/private.xml")).rejects.toThrow("private or blocks server access");
  });

  it("explains that Facebook pages without feed links are unsupported", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`<html><head><title>NASA - Facebook</title></head><body>NASA posts and followers</body></html>`, { status: 200, headers: { "content-type": "text/html" } })));
    await expect(parseFeed("https://www.facebook.com/NASA/")).rejects.toThrow("For NASA updates, add the official feed instead: https://www.nasa.gov/feed/");
  });

  it("resolves the provided Reddit Technology page to its public Atom feed", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>technology</title><entry><id>t3_technology</id><title>Technology story</title><link href="https://www.reddit.com/r/technology/comments/example"/><updated>2026-08-19T08:00:00Z</updated><summary>Discussion</summary></entry></feed>`, { status: 200, headers: { "content-type": "application/atom+xml" } }))
      .mockResolvedValueOnce(new Response(`<html><head></head></html>`, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await parseFeed("https://www.reddit.com/r/technology/");
    expect(result.title).toBe("technology");
    expect(result.articles[0]?.title).toBe("Technology story");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://www.reddit.com/r/technology/.rss");
  });

  it("resolves the provided CNN World page to CNN's official world RSS feed", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(`<?xml version="1.0"?><rss><channel><title>CNN World</title><item><guid>cnn-world-1</guid><title>World story</title><link>https://www.cnn.com/world/story</link><pubDate>Tue, 19 Aug 2026 08:00:00 GMT</pubDate></item></channel></rss>`, { status: 200, headers: { "content-type": "text/xml" } }))
      .mockResolvedValueOnce(new Response(`<html><head></head></html>`, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await parseFeed("https://www.cnn.com/world");
    expect(result.title).toBe("CNN World");
    expect(result.articles[0]?.title).toBe("World story");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://rss.cnn.com/rss/edition_world.rss");
  });

  it("treats malformed webpage HTML as a webpage instead of surfacing an XML CDATA error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(`<!doctype html><html><body><![CDATA[not closed`, { status: 200, headers: { "content-type": "text/html" } })));
    await expect(parseFeed("https://example.com/malformed-page", 1000)).rejects.toThrow("This URL returned a web page, not an RSS/Atom feed");
  });

  it("reports malformed non-YouTube XML clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("this is not xml", { status: 200, headers: { "content-type": "application/xml" } })));
    await expect(parseFeed("https://example.com/broken.xml")).rejects.toThrow("not a recognized RSS or Atom feed");
  });

  it("falls back to channel-page videos when YouTube RSS returns 404", async () => {
    const page = `<title>NASA - YouTube</title><script>var ytInitialData = {"videoRenderer":{"videoId":"abc123","title":{"runs":[{"text":"NASA upload"}]},"thumbnail":{"thumbnails":[{"url":"https://i.ytimg.com/vi/abc123/hqdefault.jpg"}]}}};</script>`;
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(`<html><link rel="canonical" href="https://www.youtube.com/channel/UCLA_DiR1FfKNvjuUpBHmylQ" /></html>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(`not found`, { status: 404 }))
      .mockResolvedValueOnce(new Response(page, { status: 200 })));
    const result = await parseFeed("https://m.youtube.com/@NASA");
    expect(result.title).toBe("NASA");
    expect(result.articles[0]?.title).toBe("NASA upload");
    expect(result.articles[0]?.link).toBe("https://www.youtube.com/watch?v=abc123");
  });

  it("resolves a YouTube @channel page to its channel feed", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(`<html><link rel="canonical" href="https://www.youtube.com/channel/UCLA_DiR1FfKNvjuUpBHmylQ" /></html>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>NASA</title><entry><id>yt:video:abc</id><title>NASA story</title><link href="https://www.youtube.com/watch?v=abc"/><updated>2026-08-19T08:00:00Z</updated></entry></feed>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(`<html><head></head></html>`, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await parseFeed("https://m.youtube.com/@NASA");
    expect(result.title).toBe("NASA");
    expect(result.articles[0]?.title).toBe("NASA story");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("feeds/videos.xml?channel_id=UCLA_DiR1FfKNvjuUpBHmylQ");
  });

  it("follows redirects to the final feed URL", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/final.xml" } }))
      .mockResolvedValueOnce(new Response(`<?xml version="1.0"?><rss><channel><title>Redirected Feed</title><item><title>Redirected story</title><link>https://example.com/redirected</link></item></channel></rss>`, { status: 200, headers: { "content-type": "text/plain" } }))
      .mockResolvedValueOnce(new Response(`<html><head></head></html>`, { status: 200 })));
    const result = await parseFeed("https://example.com/start");
    expect(result.title).toBe("Redirected Feed");
    expect(result.articles[0]?.title).toBe("Redirected story");
  });

  it("parses valid XML even when the server uses a nonstandard content type", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(`<?xml version="1.0"?><rss><channel><title>Plain Text Feed</title><item><title>Plain text story</title><link>https://example.com/plain</link></item></channel></rss>`, { status: 200, headers: { "content-type": "text/plain" } }))
      .mockResolvedValueOnce(new Response(`<html><head></head></html>`, { status: 200 })));
    const result = await parseFeed("https://example.com/plain-feed");
    expect(result.title).toBe("Plain Text Feed");
  });

  it("discovers an RSS feed linked from a web page", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(`<html><head><link rel="alternate" type="application/rss+xml" href="/news.xml" /></head></html>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(`<?xml version="1.0"?><rss><channel><title>Linked News</title><item><title>Linked story</title><link>https://example.com/story</link></item></channel></rss>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(`<html><head></head></html>`, { status: 200 })));
    const result = await parseFeed("https://example.com/news");
    expect(result.title).toBe("Linked News");
    expect(result.articles[0]?.title).toBe("Linked story");
  });

  it("settles promptly when a website has no usable feed candidates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(parseFeed("https://example.com/no-feed", 1000)).rejects.toThrow("Feed returned HTTP 404");
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("explains when a URL returns an ordinary web page without a feed link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(`<!doctype html><html><head><title>Website</title></head><body>Welcome</body></html>`, { status: 200 })));
    await expect(parseFeed("https://example.com/website")).rejects.toThrow("Paste the direct RSS/Atom XML URL, or try a common path such as /feed/, /rss.xml, or /atom.xml.");
  });

  it("supports prefixed Atom feed roots", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(`<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Prefixed Atom</atom:title><atom:entry><atom:id>tag:example.com,2026:2</atom:id><atom:title>Prefixed story</atom:title><atom:link href="https://example.com/prefixed"/><atom:updated>2026-08-19T08:00:00Z</atom:updated><atom:summary>Atom summary</atom:summary></atom:entry></atom:feed>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(`<html><head></head></html>`, { status: 200 })));
    const result = await parseFeed("https://example.com/prefixed-atom.xml");
    expect(result.title).toBe("Prefixed Atom");
    expect(result.articles[0]?.title).toBe("Prefixed story");
    expect(result.articles[0]?.link).toBe("https://example.com/prefixed");
  });

  it("accepts deeply nested article markup without throwing", async () => {
    const nested = `${"<span>".repeat(1200)}Deep story${"</span>".repeat(1200)}`;
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(`<?xml version="1.0"?><rss><channel><title>Nested Feed</title><item><title>Deep article</title><link>https://example.com/deep</link><description><![CDATA[${nested}]]></description></item></channel></rss>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(`<html><head></head></html>`, { status: 200 })));
    const result = await parseFeed("https://example.com/deep-feed.xml");
    expect(result.articles[0]?.title).toBe("Deep article");
  });

  it("supports Atom entries", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`<feed><title>Atom Daily</title><entry><id>tag:example.com,2026:1</id><title>Atom story</title><link href="https://example.com/story"/><updated>2026-08-19T08:00:00Z</updated><summary>Summary</summary></entry></feed>`, { status: 200 })));
    const result = await parseFeed("https://example.com/atom.xml");
    expect(result.title).toBe("Atom Daily");
    expect(result.articles[0]?.title).toBe("Atom story");
    expect(result.articles[0]?.link).toBe("https://example.com/story");
  });
});
