export type SourceCategory = "all" | "youtube" | "reddit" | "website";

export type SourceFeed = { id: number; url: string };
export type SourceArticle = { feedId: number };

export const sourceCategoryDetails: Record<SourceCategory, { label: string; shortLabel: string }> = {
  all: { label: "All signals", shortLabel: "All" },
  youtube: { label: "YouTube channels", shortLabel: "YouTube" },
  reddit: { label: "Reddit communities", shortLabel: "Reddit" },
  website: { label: "Web feeds", shortLabel: "Web" },
};

export function getSourceCategory(url: string): Exclude<SourceCategory, "all"> {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "youtube";
    if (host === "reddit.com" || host.endsWith(".reddit.com")) return "reddit";
  } catch {
    // Invalid saved URLs are treated as generic web feeds so they remain accessible.
  }
  return "website";
}

export function feedIdsForSourceCategory(feeds: SourceFeed[], category: SourceCategory): number[] {
  if (category === "all") return feeds.map((feed) => feed.id);
  return feeds.filter((feed) => getSourceCategory(feed.url) === category).map((feed) => feed.id);
}

export function filterArticlesForSourceCategory<T extends SourceArticle>(articles: T[], feeds: SourceFeed[], category: SourceCategory): T[] {
  const ids = new Set(feedIdsForSourceCategory(feeds, category));
  return articles.filter((article) => ids.has(article.feedId));
}
