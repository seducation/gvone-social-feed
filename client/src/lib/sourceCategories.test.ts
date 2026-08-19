import { describe, expect, it } from "vitest";
import { feedIdsForSourceCategory, filterArticlesForSourceCategory, getSourceCategory } from "./sourceCategories";

describe("RSS source categories", () => {
  const feeds = [
    { id: 1, url: "https://m.youtube.com/@NASA" },
    { id: 2, url: "https://www.youtube.com/@SpaceX/videos" },
    { id: 3, url: "https://www.reddit.com/r/technology/.rss" },
    { id: 4, url: "https://www.bbc.co.uk/news/10628494" },
  ];

  it("recognizes YouTube, Reddit, and regular website feeds", () => {
    expect(getSourceCategory(feeds[0].url)).toBe("youtube");
    expect(getSourceCategory(feeds[2].url)).toBe("reddit");
    expect(getSourceCategory(feeds[3].url)).toBe("website");
  });

  it("returns only the channels and articles associated with the selected source category", () => {
    expect(feedIdsForSourceCategory(feeds, "youtube")).toEqual([1, 2]);
    expect(filterArticlesForSourceCategory([{ feedId: 1, title: "NASA" }, { feedId: 3, title: "Reddit" }, { feedId: 4, title: "BBC" }], feeds, "youtube")).toEqual([{ feedId: 1, title: "NASA" }]);
  });
});
