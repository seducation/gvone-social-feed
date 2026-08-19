// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("embedded video control safe areas", () => {
  it("keeps inline embedded players at a stable widescreen ratio", () => {
    expect(stylesheet).toContain('main article iframe[title="Embedded feed video"]');
    expect(stylesheet).toContain("aspect-ratio: 16 / 9;");
  });

  it("keeps Shorts captions above the embedded player control rail", () => {
    expect(stylesheet).toContain("article[data-short-id] > div > div:last-child");
    expect(stylesheet).toContain("bottom: 5.25rem;");
  });
});
