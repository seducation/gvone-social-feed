import { describe, expect, it } from "vitest";
import { buildBranchHistory } from "./chatMemory";

describe("buildBranchHistory", () => {
  it("keeps only ancestor messages through the fork point and marks them as inherited", () => {
    const messages = new Map([
      [1, [
        { id: 10, conversationId: 1, role: "user" as const, content: "Root question", createdAt: new Date("2026-08-20T09:00:00Z") },
        { id: 11, conversationId: 1, role: "assistant" as const, content: "Root answer", createdAt: new Date("2026-08-20T09:01:00Z") },
        { id: 12, conversationId: 1, role: "user" as const, content: "Later root turn", createdAt: new Date("2026-08-20T09:02:00Z") },
      ]],
      [2, [{ id: 20, conversationId: 2, role: "user" as const, content: "Branch question", createdAt: new Date("2026-08-20T09:03:00Z") }]],
    ]);

    const history = buildBranchHistory([
      { id: 1, parentConversationId: null, forkMessageId: null },
      { id: 2, parentConversationId: 1, forkMessageId: 11 },
    ], messages);

    expect(history.map((message) => [message.id, message.inherited])).toEqual([[10, true], [11, true], [20, false]]);
    expect(history.map((message) => message.content)).not.toContain("Later root turn");
  });
});
