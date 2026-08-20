import { describe, expect, it } from "vitest";
import { findRelatedStories } from "./articleRelations";

describe("findRelatedStories", () => {
  it("ranks private library stories by meaningful shared title and description terms", () => {
    const related = findRelatedStories(
      { id: 1, title: "NASA launches lunar science mission", link: "https://example.com/one", description: "A lunar launch update" },
      [
        { id: 2, title: "NASA lunar mission prepares for launch", link: "https://example.com/two", description: "Mission details" },
        { id: 3, title: "City transport plan approved", link: "https://example.com/three", description: "Local policy update" },
      ],
    );
    expect(related.map((story) => story.id)).toEqual([2]);
  });

  it("excludes the original story even when its terms are identical", () => {
    const story = { id: 1, title: "NASA mission", link: "https://example.com/one", description: null };
    expect(findRelatedStories(story, [story])).toEqual([]);
  });
});
