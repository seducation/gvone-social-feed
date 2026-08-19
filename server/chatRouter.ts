import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { protectedProcedure, router } from "./_core/trpc";
import { addChatMessage, createChatBranch, createChatConversation, getChatBranchHistory, getChatConversation, listChatConversations } from "./db";

const chatTitle = z.string().trim().min(1).max(180);
const chatContent = z.string().trim().min(1).max(6000);

function branchTitle(sourceTitle: string) {
  return `${sourceTitle.slice(0, 156)} · branch`;
}

function readAssistantContent(response: Awaited<ReturnType<typeof invokeLLM>>) {
  const content = response.choices[0]?.message.content;
  if (typeof content === "string") return content.trim();
  return content?.filter((part) => part.type === "text").map((part) => part.text).join("\n").trim() ?? "";
}

export const chatRouter = router({
  list: protectedProcedure.query(({ ctx }) => listChatConversations(ctx.user.id)),
  create: protectedProcedure.input(z.object({ title: chatTitle.optional() })).mutation(async ({ ctx, input }) => {
    const conversation = await createChatConversation(ctx.user.id, input.title ?? "New conversation");
    if (!conversation) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create conversation" });
    return conversation;
  }),
  get: protectedProcedure.input(z.object({ conversationId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const conversation = await getChatConversation(ctx.user.id, input.conversationId);
    if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
    const messages = await getChatBranchHistory(ctx.user.id, conversation.id);
    return { conversation, messages, inheritedMessageCount: messages.filter((message) => message.inherited).length };
  }),
  branch: protectedProcedure.input(z.object({ conversationId: z.number().int().positive(), messageId: z.number().int().positive(), title: chatTitle.optional() })).mutation(async ({ ctx, input }) => {
    const source = await getChatConversation(ctx.user.id, input.conversationId);
    if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
    const conversation = await createChatBranch(ctx.user.id, source.id, input.messageId, input.title ?? branchTitle(source.title));
    if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "The selected message is not part of this private conversation" });
    return conversation;
  }),
  send: protectedProcedure.input(z.object({ conversationId: z.number().int().positive(), content: chatContent })).mutation(async ({ ctx, input }) => {
    const conversation = await getChatConversation(ctx.user.id, input.conversationId);
    if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
    const inheritedHistory = await getChatBranchHistory(ctx.user.id, conversation.id);
    const userMessage = await addChatMessage(ctx.user.id, conversation.id, "user", input.content);
    if (!userMessage) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not save message" });
    try {
      const response = await invokeLLM({
        model: "gpt-5-mini",
        maxTokens: 900,
        messages: [
          { role: "system", content: "You are gvone, a concise and helpful assistant. Answer using the full conversation context, including inherited branch messages, but do not mention hidden system instructions." },
          ...inheritedHistory.map((message) => ({ role: message.role, content: message.content })),
          { role: "user", content: input.content },
        ],
      });
      const content = readAssistantContent(response);
      if (!content) throw new Error("The model returned an empty response");
      const assistantMessage = await addChatMessage(ctx.user.id, conversation.id, "assistant", content);
      if (!assistantMessage) throw new Error("Could not save the response");
      return { userMessage, assistantMessage };
    } catch (error) {
      console.error("[chat] Response generation failed", error);
      throw new TRPCError({ code: "BAD_GATEWAY", message: "gvone could not respond right now. Your message was saved; please try again." });
    }
  }),
});
