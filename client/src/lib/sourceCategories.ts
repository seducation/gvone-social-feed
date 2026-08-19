export type SourceChannelKind = "all" | "youtube" | "reddit" | "domain";
export type SourceChannelKey = "all" | "youtube" | "reddit" | `domain:${string}`;

export type SourceFeed = { id: number; url: string };
export type SourceArticle = { feedId: number };

export type SourceChannel = {
  key: SourceChannelKey;
  kind: SourceChannelKind;
  label: string;
  shortLabel: string;
  description: string;
  feedIds: number[];
};

const domainAliases: Record<string, { domain: string; label: string }> = {
  "rss.nytimes.com": { domain: "nytimes.com", label: "New York Times" },
  "nytimes.com": { domain: "nytimes.com", label: "New York Times" },
  "cnn.com": { domain: "cnn.com", label: "CNN" },
  "bbc.co.uk": { domain: "bbc.co.uk", label: "BBC" },
};

const multiPartSuffixes = new Set(["co.uk", "org.uk", "ac.uk", "com.au", "net.au", "org.au", "co.nz", "com.br", "co.jp", "co.in"]);

export function sourceHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown-source";
  }
}

export function sourceDomain(url: string): string {
  const hostname = sourceHostname(url);
  if (hostname === "unknown-source") return hostname;
  const parts = hostname.split(".");
  if (parts.length < 3) return hostname;
  const suffix = parts.slice(-2).join(".");
  return multiPartSuffixes.has(suffix) ? parts.slice(-3).join(".") : suffix;
}

export function getSourceChannelKey(url: string): Exclude<SourceChannelKey, "all"> {
  const hostname = sourceHostname(url);
  if (hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be") return "youtube";
  if (hostname === "reddit.com" || hostname.endsWith(".reddit.com")) return "reddit";
  return `domain:${sourceDomain(url)}`;
}

function domainPresentation(domain: string) {
  const alias = domainAliases[domain];
  if (alias) return alias;
  if (domain === "unknown-source") return { domain, label: "Other source" };
  const root = domain.split(".")[0];
  return { domain, label: root.charAt(0).toUpperCase() + root.slice(1) };
}

export function buildSourceChannels(feeds: SourceFeed[]): SourceChannel[] {
  const all: SourceChannel = { key: "all", kind: "all", label: "All signals", shortLabel: "All", description: "Every source in your private library.", feedIds: feeds.map((feed) => feed.id) };
  const grouped = new Map<Exclude<SourceChannelKey, "all">, number[]>();
  for (const feed of feeds) {
    const key = getSourceChannelKey(feed.url);
    grouped.set(key, [...(grouped.get(key) ?? []), feed.id]);
  }

  const channels: SourceChannel[] = [all];
  for (const key of ["youtube", "reddit"] as const) {
    const feedIds = grouped.get(key) ?? [];
    if (!feedIds.length) continue;
    channels.push(key === "youtube"
      ? { key, kind: "youtube", label: "YouTube channels", shortLabel: "YouTube", description: "Every saved YouTube channel in one community feed.", feedIds }
      : { key, kind: "reddit", label: "Reddit communities", shortLabel: "Reddit", description: "Every saved Reddit community in one community feed.", feedIds });
  }

  const domainChannels = Array.from(grouped.entries())
    .filter(([key]) => key.startsWith("domain:"))
    .map(([key, feedIds]) => {
      const presentation = domainPresentation(key.slice("domain:".length));
      return { key, kind: "domain" as const, label: presentation.label, shortLabel: presentation.label, description: `Stories from your saved ${presentation.label} feeds.`, feedIds };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
  return [...channels, ...domainChannels];
}

export function applySourceTabOrder(channels: SourceChannel[], orderedKeys: string[]): SourceChannel[] {
  const fixed = channels.find((channel) => channel.kind === "all");
  const editable = channels.filter((channel) => channel.kind !== "all");
  const position = new Map(orderedKeys.map((key, index) => [key, index]));
  const ordered = [...editable].sort((left, right) => {
    const leftPosition = position.get(left.key) ?? Number.MAX_SAFE_INTEGER;
    const rightPosition = position.get(right.key) ?? Number.MAX_SAFE_INTEGER;
    return leftPosition === rightPosition ? 0 : leftPosition - rightPosition;
  });
  return fixed ? [fixed, ...ordered] : ordered;
}

export function moveEditableSourceTab(keys: string[], movingKey: string, targetKey: string): string[] {
  if (movingKey === targetKey || !keys.includes(movingKey) || !keys.includes(targetKey)) return keys;
  const withoutMoving = keys.filter((key) => key !== movingKey);
  const targetIndex = withoutMoving.indexOf(targetKey);
  return [...withoutMoving.slice(0, targetIndex), movingKey, ...withoutMoving.slice(targetIndex)];
}

export function filterArticlesForSourceChannel<T extends SourceArticle>(articles: T[], channel: SourceChannel | undefined): T[] {
  if (!channel) return [];
  const feedIds = new Set(channel.feedIds);
  return articles.filter((article) => feedIds.has(article.feedId));
}
