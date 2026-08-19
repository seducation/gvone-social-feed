import { describe, expect, it } from "vitest";
import { feedErrorMessage } from "./feedError";

describe("feedErrorMessage", () => {
  it("maps service outage errors to the add-feed toast message", () => {
    expect(feedErrorMessage(new Error("Unexpected token 'S', Service Unavailable"))).toBe("The feed service is temporarily unavailable. Please try again in a moment.");
  });

  it("preserves actionable feed errors", () => {
    expect(feedErrorMessage(new Error("This URL returned a web page, not an RSS/Atom feed."))).toContain("web page");
  });
});
