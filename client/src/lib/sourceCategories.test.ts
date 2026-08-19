import { describe, expect, it } from "vitest";
import { applySourceTabOrder, buildSourceChannels, filterArticlesForSourceChannel, getSourceChannelKey, moveEditableSourceTab, sourceDomain } from "./sourceCategories";

describe("RSS source community channels", () => {
  const feeds = [
    { id: 1, url: "https://m.youtube.com/@NASA" },
    { id: 2, url: "https://www.youtube.com/@SpaceX/videos" },
    { id: 3, url: "https://www.reddit.com/r/technology/.rss" },
    { id: 4, url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" },
    { id: 5, url: "https://www.nytimes.com/section/technology" },
    { id: 6, url: "https://rss.cnn.com/rss/edition_world.rss" },
  ];

  it("normalizes feed hostnames into YouTube, Reddit, and canonical domain channel keys", () => {
    expect(getSourceChannelKey(feeds[0].url)).toBe("youtube");
    expect(getSourceChannelKey(feeds[2].url)).toBe("reddit");
    expect(sourceDomain(feeds[3].url)).toBe("nytimes.com");
    expect(sourceDomain(feeds[5].url)).toBe("cnn.com");
  });

  it("creates one channel per website domain while retaining shared YouTube and Reddit communities", () => {
    const channels = buildSourceChannels(feeds);
    expect(channels.map((channel) => [channel.key, channel.label, channel.feedIds])).toEqual([
      ["all", "All signals", [1, 2, 3, 4, 5, 6]],
      ["youtube", "YouTube channels", [1, 2]],
      ["reddit", "Reddit communities", [3]],
      ["domain:cnn.com", "CNN", [6]],
      ["domain:nytimes.com", "New York Times", [4, 5]],
    ]);
  });

  it("shows only the articles attached to the selected domain channel", () => {
    const channel = buildSourceChannels(feeds).find((item) => item.key === "domain:nytimes.com");
    const articles = [{ feedId: 1, title: "NASA" }, { feedId: 4, title: "NYT World" }, { feedId: 6, title: "CNN World" }];
    expect(filterArticlesForSourceChannel(articles, channel)).toEqual([{ feedId: 4, title: "NYT World" }]);
  });

  it("keeps All fixed while applying a saved order only to editable source tabs", () => {
    const ordered = applySourceTabOrder(buildSourceChannels(feeds), ["domain:nytimes.com", "reddit"]);
    expect(ordered.map((channel) => channel.key)).toEqual(["all", "domain:nytimes.com", "reddit", "youtube", "domain:cnn.com"]);
  });

  it("moves one editable tab before another without inventing or removing keys", () => {
    expect(moveEditableSourceTab(["youtube", "reddit", "domain:cnn.com"], "domain:cnn.com", "youtube")).toEqual(["domain:cnn.com", "youtube", "reddit"]);
    expect(moveEditableSourceTab(["youtube", "reddit"], "youtube", "missing")).toEqual(["youtube", "reddit"]);
  });
});
