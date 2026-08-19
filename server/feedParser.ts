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

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", cdataPropName: "__cdata" });

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

function absoluteUrl(value: string, baseUrl: string): string {
  try { return new URL(value, baseUrl).toString(); } catch { return value; }
}

function stripMarkup(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseDate(value: string): Date | null {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function mediaUrl(item: Record<string, unknown>, baseUrl: string, description: string) {
  const enclosure = first(item.enclosure) as Record<string, unknown> | undefined;
  const media = first(item["media:content"]) as Record<string, unknown> | undefined;
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
  const linkValue = atom ? first(item.link) as Record<string, unknown> | undefined : undefined;
  const link = atom ? String(linkValue?.["@_href"] ?? asText(item.link)) : asText(item.link);
  const description = asText(item.description ?? item["content:encoded"] ?? item.summary ?? item.content);
  const title = asText(item.title) || "Untitled article";
  const media = mediaUrl(item, baseUrl, description);
  const imageMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  const thumbnail = item["media:thumbnail"] as Record<string, unknown> | undefined;
  const thumbnailValue = thumbnail?.["@_url"] ?? imageMatch?.[1] ?? (media.mime && media.mime.startsWith("image/") ? media.url : null);
  const guid = asText(item.guid ?? item.id ?? link ?? `${title}-${asText(item.pubDate ?? item.published)}`);
  return {
    guid: guid.slice(0, 1024), title, link: absoluteUrl(link, baseUrl),
    description: description ? stripMarkup(description).slice(0, 420) : null,
    publishedAt: parseDate(asText(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"])),
    thumbnailUrl: thumbnailValue ? absoluteUrl(String(thumbnailValue), baseUrl) : null,
    videoUrl: media.mime && media.mime.startsWith("video/") ? media.url : null,
    videoMimeType: media.mime && media.mime.startsWith("video/") ? media.mime : null,
  };
}

export async function parseFeed(url: string): Promise<ParsedFeed> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "user-agent": "RSS Group Feed/1.0" } });
  if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
  const xml = await response.text();
  const parsed = parser.parse(xml) as Record<string, any>;
  const rss = parsed.rss?.channel;
  const atom = parsed.feed;
  if (!rss && !atom) throw new Error("The URL did not return a supported RSS or Atom feed");
  const base = new URL(url);
  const rawItems = rss?.item ?? atom?.entry ?? [];
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).map((item) => articleFromItem(item, url, Boolean(atom))).filter((item) => item.link);
  return {
    title: asText(first(rss?.title ?? atom?.title)) || base.hostname,
    description: (asText(first(rss?.description ?? atom?.subtitle)) || null),
    faviconUrl: await discoverFavicon(url),
    articles: items.slice(0, 100),
  };
}
