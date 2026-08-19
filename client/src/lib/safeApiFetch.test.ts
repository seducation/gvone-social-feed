import { describe, expect, it } from "vitest";
import { normalizeApiResponse } from "./safeApiFetch";

describe("normalizeApiResponse", () => {
  it("normalizes a plain-text service outage into a JSON response", async () => {
    const response = await normalizeApiResponse(new Response("Service Unavailable", { status: 503 }));
    const body = await response.json();
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body[0].error.json.message).toContain("temporarily unavailable");
  });

  it("leaves successful JSON responses unchanged", async () => {
    const original = new Response(JSON.stringify([{ result: { data: { json: { ok: true } } } }]), { status: 200, headers: { "content-type": "application/json" } });
    const response = await normalizeApiResponse(original);
    expect(await response.json()).toEqual([{ result: { data: { json: { ok: true } } } }]);
  });
});
