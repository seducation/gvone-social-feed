import { XMLParser } from "fast-xml-parser";

export type ParsedArticle = {
  guid: string;
  title: string;
  link: string;
  description: string | null;
  publishedAt: Date | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  videoMimeType: string | null;
};

export type ParsedFeed = {
  title: string;
  description: string | null;
  faviconUrl: string;
  articles: ParsedArticle[];
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", cdataPropName: "__cdata", maxNestedTags: 10000 });

function asText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(record.__cdata ?? record["#text"] ?? "");
  }
  return "";
}

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function localName(key: string) { return key.includes(":") ? key.split(":").pop()!.toLowerCase() : key.toLowerCase(); }
function childByLocalName(value: unknown, name: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const exact = record[name] ?? record[`rss:${name}`] ?? record[`atom:${name}`];
  if (exact !== undefined) return exact;
  const key = Object.keys(record).find((candidate) => localName(candidate) === name.toLowerCase());
  return key ? record[key] : undefined;
}

function absoluteUrl(value: string, baseUrl: string): string {
  try { return new URL(value, baseUrl).toString(); } catch { return value; }
}

function stripMarkup(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function discoverFeedCandidates(html: string, pageUrl: string): string[] {
  const candidates: string[] = [];
  const add = (href: string | undefined) => {
    if (!href) return;
    const absolute = absoluteUrl(href, pageUrl);
    if (!candidates.includes(absolute)) candidates.push(absolute);
  };
  const links = Array.from(html.matchAll(/<link\b[^>]*>/gi), (match) => match[0]);
  for (const link of links) {
    const rel = link.match(/\brel=["']([^"']+)["']/i)?.[1].toLowerCase() ?? "";
    const type = link.match(/\btype=["']([^"']+)["']/i)?.[1].toLowerCase() ?? "";
    const href = link.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href && (rel.includes("alternate") || type.includes("rss") || type.includes("atom") || type.includes("xml")) && (type.includes("rss") || type.includes("atom") || type.includes("xml") || /feed|rss|atom|\.xml(?:$|[?#])/i.test(href))) add(href);
  }
  const anchors = Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
  for (const anchor of anchors) {
    const href = anchor[1];
    const label = stripMarkup(anchor[2] ?? "");
    if (/feed|rss|atom|syndicat|xml/i.test(`${href} ${label}`)) add(href);
  }
  const base = new URL(pageUrl);
  for (const path of ["/feed/", "/feed.xml", "/rss/", "/rss.xml", "/atom.xml", "/index.xml", "/feeds/posts/default", "/?output=1"]) add(new URL(path, base.origin).toString());
  return candidates;
}

type ParseState = { seen: Set<string>; deadline: number };

async function tryDiscoveredFeeds(html: string, pageUrl: string, originalUrl: string, state: ParseState): Promise<ParsedFeed | null> {
  const candidates = discoverFeedCandidates(html, pageUrl).slice(0, 5);
  for (const candidate of candidates) {
    if (candidate === originalUrl || candidate === pageUrl || state.seen.has(candidate) || Date.now() >= state.deadline) continue;
    try { return await parseFeed(candidate, 5000, state); } catch { /* try the next likely feed endpoint */ }
  }
  return null;
}

function parseDate(value: string): Date | null {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function mediaUrl(item: Record<string, unknown>, baseUrl: string, description: string) {
  const enclosure = first(childByLocalName(item, "enclosure")) as Record<string, unknown> | undefined;
  const media = first(childByLocalName(item, "content")) as Record<string, unknown> | undefined;
  const candidate = enclosure?.["@_url"] ?? media?.["@_url"];
  const mime = String(enclosure?.["@_type"] ?? media?.["@_type"] ?? "");
  const embedded = description.match(/<(?:video|source)[^>]+src=[\"']([^\"']+)[\"']/i)?.[1] ?? null;
  if (embedded) return { url: absoluteUrl(embedded, baseUrl), mime: "video/mp4" };
  return candidate ? { url: absoluteUrl(String(candidate), baseUrl), mime } : { url: null, mime: null };
}

async function discoverFavicon(feedUrl: string): Promise<string> {
  const base = new URL(feedUrl);
  try {
    const homepage = await fetch(base.origin, { signal: AbortSignal.timeout(5000), headers: { "user-agent": "RSS Group Feed/1.0" } });
    const html = await homepage.text();
    const match = html.match(/<link[^>]+rel=[\"'][^\"']*(?:icon|apple-touch-icon)[^\"']*[\"'][^>]+href=[\"']([^\"']+)[\"']/i) ?? html.match(/<link[^>]+href=[\"']([^\"']+)[\"'][^>]+rel=[\"'][^\"']*(?:icon|apple-touch-icon)/i);
    if (match?.[1]) return absoluteUrl(match[1], feedUrl);
  } catch { /* fallback below */ }
  return `${base.origin}/favicon.ico`;
}

function articleFromItem(raw: unknown, baseUrl: string, atom = false): ParsedArticle {
  const item = (raw ?? {}) as Record<string, unknown>;
  const rawLink = childByLocalName(item, "link");
  const linkValue = atom ? first(rawLink) as Record<string, unknown> | undefined : undefined;
  const link = atom ? String(linkValue?.["@_href"] ?? asText(rawLink)) : asText(rawLink);
  const description = asText(childByLocalName(item, "description") ?? childByLocalName(item, "content:encoded") ?? childByLocalName(item, "summary") ?? childByLocalName(item, "content"));
  const title = asText(childByLocalName(item, "title")) || "Untitled article";
  const media = mediaUrl(item, baseUrl, description);
  const imageMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  const thumbnail = item["media:thumbnail"] as Record<string, unknown> | undefined;
  const thumbnailValue = thumbnail?.["@_url"] ?? imageMatch?.[1] ?? (media.mime && media.mime.startsWith("image/") ? media.url : null);
  const guid = asText(childByLocalName(item, "guid") ?? childByLocalName(item, "id") ?? link ?? `${title}-${asText(childByLocalName(item, "pubDate") ?? childByLocalName(item, "published"))}`);
  return {
    guid: guid.slice(0, 1024), title, link: absoluteUrl(link, baseUrl),
    description: description ? stripMarkup(description).slice(0, 420) : null,
    publishedAt: parseDate(asText(childByLocalName(item, "pubDate") ?? childByLocalName(item, "published") ?? childByLocalName(item, "updated") ?? childByLocalName(item, "date"))),
    thumbnailUrl: thumbnailValue ? absoluteUrl(String(thumbnailValue), baseUrl) : null,
    videoUrl: media.mime && media.mime.startsWith("video/") ? media.url : null,
    videoMimeType: media.mime && media.mime.startsWith("video/") ? media.mime : null,
  };
}

function isYouTubeChannelPage(url: string): boolean {
  const page = new URL(url);
  return /(^|\.)youtube\.com$/i.test(page.hostname) && /^\/(?:@|channel\/|c\/|user\/)/i.test(page.pathname);
}

function isFacebookPage(url: string): boolean {
  const page = new URL(url);
  return /(^|\.)facebook\.com$/i.test(page.hostname) && /^\/(?:pages\/|profile\.php|[A-Za-z0-9._-]+)\/?$/i.test(page.pathname);
}

function redditCommunityFeedUrl(url: string): string | null {
  const page = new URL(url);
  if (!/(^|\.)reddit\.com$/i.test(page.hostname)) return null;
  const match = page.pathname.match(/^\/r\/([^/]+)\/?$/i);
  if (!match?.[1]) return null;
  return `${page.origin}/r/${match[1]}/.rss`;
}

function extractJsonAssignment(html: string, marker: string): unknown {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = html.indexOf("{", markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) {
      try { return JSON.parse(html.slice(start, index + 1)); } catch { return null; }
    }
  }
  return null;
}

function youtubePageToFeed(html: string, pageUrl: string): ParsedFeed {
  const data = extractJsonAssignment(html, "ytInitialData = ") as Record<string, unknown> | null;
  const articles: ParsedArticle[] = [];
  const seen = new Set<string>();
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const record = value as Record<string, unknown>;
    const videoId = typeof record.videoId === "string" ? record.videoId : null;
    const titleNode = record.title as Record<string, unknown> | undefined;
    const titleRuns = titleNode?.runs as Array<Record<string, unknown>> | undefined;
    const title = asText(titleRuns?.[0]?.text ?? titleNode?.simpleText);
    if (videoId && title && !seen.has(videoId)) {
      seen.add(videoId);
      const thumbs = (record.thumbnail as Record<string, unknown> | undefined)?.thumbnails as Array<Record<string, unknown>> | undefined;
      const thumbnail = thumbs?.at(-1)?.url;
      const descriptionNode = record.descriptionSnippet as Record<string, unknown> | undefined;
      const descriptionRuns = descriptionNode?.runs as Array<Record<string, unknown>> | undefined;
      articles.push({ guid: `youtube:${videoId}`, title, link: `https://www.youtube.com/watch?v=${videoId}`, description: asText(descriptionRuns?.map((run) => asText(run.text)).join("")) || null, publishedAt: null, thumbnailUrl: typeof thumbnail === "string" ? thumbnail : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, videoUrl: `https://www.youtube.com/watch?v=${videoId}`, videoMimeType: "text/html" });
    }
    Object.values(record).forEach(walk);
  };
  walk(data);
  const pageTitle = html.match(/<title[^>]*>([^<]+?)(?:\s+-\s+YouTube)?<\/title>/i)?.[1]?.trim() || new URL(pageUrl).pathname.replace(/^\/@?/, "") || "YouTube channel";
  return { title: pageTitle, description: null, faviconUrl: "https://www.youtube.com/favicon.ico", articles: articles.slice(0, 100) };
}

async function parseYouTubeChannelPage(url: string): Promise<ParsedFeed> {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "user-agent": "RSS Group Feed/1.0" } });
  if (!response.ok) throw new Error(`YouTube channel page returned HTTP ${response.status}`);
  return youtubePageToFeed(await response.text(), url);
}

async function resolveKnownPageToFeed(url: string): Promise<string> {
  const page = new URL(url);
  const redditFeed = redditCommunityFeedUrl(url);
  if (redditFeed) return redditFeed;
  if (!isYouTubeChannelPage(url)) return url;
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "user-agent": "RSS Group Feed/1.0" } });
    const html = await response.text();
    const channelId = html.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,})/i)?.[1] ?? html.match(/(?:channelId|externalId)["']?\s*[:=]\s*["'](UC[A-Za-z0-9_-]{20,})["']/i)?.[1];
    if (channelId) return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  } catch { /* fall through to normal feed parsing */ }
  return url;
}

async function fetchFeedResponse(url: string, redirects = 0, timeoutMs = 15000): Promise<{ response: Response; finalUrl: string }> {
  if (redirects > 5) throw new Error("Feed redirected too many times");
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "RSS Group Feed/1.0" } });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error(`Feed returned HTTP ${response.status} without a redirect location`);
    return fetchFeedResponse(absoluteUrl(location, url), redirects + 1, timeoutMs);
  }
  return { response, finalUrl: url };
}

function facebookFeedError(url: string): string {
  const page = new URL(url);
  if (/^\/NASA\/?$/i.test(page.pathname)) return "Facebook page URLs do not provide a public RSS/Atom feed. For NASA updates, add the official feed instead: https://www.nasa.gov/feed/";
  return "Facebook page URLs do not provide a public RSS/Atom feed. Add the page’s direct RSS feed URL or its website’s feed instead.";
}

export async function parseFeed(url: string, timeoutMs = 15000, state?: ParseState): Promise<ParsedFeed> {
  const parseState = state ?? { seen: new Set<string>(), deadline: Date.now() + timeoutMs };
  if (Date.now() >= parseState.deadline) throw new Error("Feed discovery timed out. Paste a direct RSS/Atom XML URL and try again.");
  if (parseState.seen.has(url)) throw new Error("Feed discovery encountered a loop. Paste the direct RSS/Atom XML URL instead.");
  parseState.seen.add(url);
  const resolvedUrl = await resolveKnownPageToFeed(url);
  const { response, finalUrl } = await fetchFeedResponse(resolvedUrl, 0, Math.min(timeoutMs, Math.max(500, parseState.deadline - Date.now())));
  if (!response.ok) {
    if (response.status === 404 && isYouTubeChannelPage(url)) return parseYouTubeChannelPage(url);
    if (isFacebookPage(url)) throw new Error(facebookFeedError(url));
    if (response.status === 401 || response.status === 403) throw new Error("This feed is private or blocks server access. Use a public RSS/Atom URL that does not require login.");
    throw new Error(`Feed returned HTTP ${response.status}`);
  }
  const xml = await response.text();
  if (isFacebookPage(url)) throw new Error(facebookFeedError(url));
  if (xml.length > 8_000_000) throw new Error("Feed is too large to safely parse");
  let parsed: Record<string, any>;
  try {
    parsed = parser.parse(xml) as Record<string, any>;
  } catch (error) {
    const discoveredFeed = await tryDiscoveredFeeds(xml, finalUrl, url, parseState);
    if (discoveredFeed) return discoveredFeed;
    throw new Error(`Could not parse the feed XML: ${error instanceof Error ? error.message : String(error)}`);
  }
  const rootKey = Object.keys(parsed).find((key) => ["rss", "rdf", "rdf:rdf", "feed"].includes(key.toLowerCase()) || ["rss", "rdf", "feed"].includes(localName(key)));
  const root = rootKey ? parsed[rootKey] : parsed;
  const channel = childByLocalName(root, "channel");
  const atom = localName(rootKey ?? "") === "feed" ? root : undefined;
  const rss = channel ?? (atom ? undefined : root);
  const hasRssShape = Boolean(channel || childByLocalName(root, "item"));
  const hasAtomShape = Boolean(atom && childByLocalName(atom, "entry"));
  if (!hasRssShape && !hasAtomShape) {
    const discoveredFeed = await tryDiscoveredFeeds(xml, finalUrl, url, parseState);
    if (discoveredFeed) return discoveredFeed;
    if (/^\s*<!doctype\s+html|^\s*<html[\s>]/i.test(xml)) throw new Error("This URL returned a web page, not an RSS/Atom feed. Paste the direct RSS/Atom XML URL, or try a common path such as /feed/, /rss.xml, or /atom.xml.");
    throw new Error("The URL returned XML, but it was not a recognized RSS or Atom feed");
  }
  const base = new URL(finalUrl);
  const rawItems = childByLocalName(rss, "item") ?? childByLocalName(root, "item") ?? childByLocalName(atom, "entry") ?? [];
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).map((item) => articleFromItem(item, finalUrl, Boolean(atom))).filter((item) => item.link);
  return {
    title: asText(first(childByLocalName(rss, "title") ?? childByLocalName(atom, "title"))) || base.hostname,
    description: (asText(first(childByLocalName(rss, "description") ?? childByLocalName(atom, "subtitle"))) || null),
    faviconUrl: await discoverFavicon(finalUrl),
    articles: items.slice(0, 100),
  };
}
