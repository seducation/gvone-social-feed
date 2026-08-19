export type BranchNode = {
  id: number;
  parentConversationId: number | null;
  forkMessageId: number | null;
};

export type DirectBranchMessage = {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
};

export type BranchHistoryMessage = DirectBranchMessage & {
  inherited: boolean;
};

/**
 * Turns a root-to-active conversation lineage into the exact context seen by
 * the active branch. Ancestors stop at the child branch's fork message, while
 * the active branch receives all of its direct messages.
 */
export function buildBranchHistory(
  lineage: BranchNode[],
  messagesByConversation: Map<number, DirectBranchMessage[]>,
): BranchHistoryMessage[] {
  const activeConversationId = lineage.at(-1)?.id;
  if (!activeConversationId) return [];

  return lineage.flatMap((conversation, index) => {
    const child = lineage[index + 1];
    const directMessages = messagesByConversation.get(conversation.id) ?? [];
    const visibleMessages = child?.forkMessageId
      ? directMessages.filter((message) => message.id <= child.forkMessageId!)
      : directMessages;

    return visibleMessages.map((message) => ({
      ...message,
      inherited: message.conversationId !== activeConversationId,
    }));
  });
}
