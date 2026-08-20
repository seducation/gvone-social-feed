// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("embedded video control safe areas", () => {
  it("keeps inline embedded players at a stable widescreen ratio", () => {
    expect(stylesheet).toContain('main article iframe[title="Embedded feed video"]');
    expect(stylesheet).toContain("aspect-ratio: 16 / 9;");
  });

  it("stacks the Shorts original link above its title while keeping all metadata above the player control rail", () => {
    expect(stylesheet).toContain("article[data-short-id] > div > div:last-child");
    expect(stylesheet).toContain("bottom: 4.75rem;");
    expect(stylesheet).toContain("article[data-short-id] > div > div:last-child a");
    expect(stylesheet).toContain("order: 1;");
    expect(stylesheet).toContain("article[data-short-id] > div > div:last-child h3");
    expect(stylesheet).toContain("order: 2;");
  });
});
