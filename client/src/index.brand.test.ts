// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("gvone application branding", () => {
  it("keeps the managed application title aligned with the browser title", () => {
    const html = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");

    expect(process.env.VITE_APP_TITLE).toBe("gvone");
    expect(html).toContain("<title>gvone — Your internet, beautifully organized</title>");
  });
});
