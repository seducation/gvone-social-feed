import React, { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Bot, GitFork, Loader2, MessageSquarePlus, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";

const promptSuggestions = [
  "Summarize what matters in my feeds today",
  "Help me build a research plan",
  "Compare two ideas without changing this conversation",
];

export default function Chat() {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const conversations = trpc.chat.list.useQuery(undefined, { enabled: auth.isAuthenticated });
  const activeInput = useMemo(() => ({ conversationId: activeConversationId ?? 0 }), [activeConversationId]);
  const activeChat = trpc.chat.get.useQuery(activeInput, { enabled: auth.isAuthenticated && Boolean(activeConversationId) });

  useEffect(() => {
    if (!activeConversationId && conversations.data?.[0]) setActiveConversationId(conversations.data[0].id);
  }, [activeConversationId, conversations.data]);

  const createConversation = trpc.chat.create.useMutation({
    onSuccess: async (conversation) => {
      setActiveConversationId(conversation.id);
      await utils.chat.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const branchConversation = trpc.chat.branch.useMutation({
    onSuccess: async (conversation) => {
      setActiveConversationId(conversation.id);
      await Promise.all([utils.chat.list.invalidate(), utils.chat.get.invalidate()]);
      toast.success("New branch created with inherited memory");
    },
    onError: (error) => toast.error(error.message),
  });
  const sendMessage = trpc.chat.send.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.chat.get.invalidate(), utils.chat.list.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });

  if (auth.loading) return <div className="grid min-h-screen place-items-center bg-[#f7f8fa]"><Loader2 className="h-6 w-6 animate-spin text-[#635bff]" /></div>;
  if (!auth.isAuthenticated) {
    return <main className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6 text-center text-[#14161a]"><div className="max-w-md"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#17171d] text-white"><Sparkles className="h-6 w-6" /></span><h1 className="mt-6 text-3xl font-semibold tracking-[-.04em]">Private conversations, branching memory.</h1><p className="mt-3 text-sm leading-6 text-[#68707d]">Sign in to create a gvone chat and branch safely from any earlier message.</p><button type="button" onClick={startLogin} className="mt-7 rounded-full bg-[#635bff] px-5 py-3 text-sm font-semibold text-white">Sign in to chat</button></div></main>;
  }

  const activeConversation = activeChat.data?.conversation;
  const messages = (activeChat.data?.messages ?? []) as Message[];
  const inheritedCount = activeChat.data?.inheritedMessageCount ?? 0;

  return <div className="min-h-screen bg-[#f7f8fa] text-[#14161a]">
    <header className="flex h-[76px] items-center border-b border-[#e6e8ed] bg-[#f7f8fa]/90 px-5 backdrop-blur-xl sm:px-8"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#68707d] transition hover:text-[#635bff]"><ArrowLeft className="h-4 w-4" /> Reader</Link><div className="ml-5 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#17171d] text-white"><Bot className="h-4 w-4" /></span><span className="text-lg font-semibold tracking-[-.03em]">gvone <span className="text-[#635bff]">chat</span></span></div><div className="ml-auto hidden items-center gap-2 text-xs font-medium text-[#8a929f] sm:flex"><ShieldCheck className="h-4 w-4 text-[#24a992]" /> Private to your account</div></header>

    <main className="mx-auto grid min-h-[calc(100vh-76px)] max-w-[1500px] lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b border-[#e6e8ed] bg-white/55 p-4 lg:min-h-[calc(100vh-76px)] lg:border-b-0 lg:border-r"><button type="button" onClick={() => createConversation.mutate({})} disabled={createConversation.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#17171d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2b34] disabled:opacity-50"><Plus className="h-4 w-4" /> New chat</button><div className="mt-6 flex items-center justify-between px-2"><span className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9ba2ae]">Your conversations</span><span className="text-xs text-[#a0a7b2]">{conversations.data?.length ?? 0}</span></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">{conversations.isLoading ? <Loader2 className="m-3 h-4 w-4 animate-spin text-[#635bff]" /> : conversations.data?.length ? conversations.data.map((conversation) => <button type="button" key={conversation.id} onClick={() => setActiveConversationId(conversation.id)} className={`min-w-[184px] rounded-xl px-3 py-3 text-left transition lg:block lg:w-full ${conversation.id === activeConversationId ? "bg-[#eeedff] text-[#4235ae]" : "text-[#657080] hover:bg-white"}`}><span className="flex items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-lg ${conversation.parentConversationId ? "bg-[#f0eaff] text-[#704ee5]" : "bg-[#f1f2f5] text-[#7d8795]"}`}>{conversation.parentConversationId ? <GitFork className="h-3.5 w-3.5" /> : <MessageSquarePlus className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{conversation.title}</span></span><span className="mt-1.5 block pl-9 text-[11px] text-[#9ba2ae]">{conversation.parentConversationId ? "Branch with memory" : "Original conversation"}</span></button>) : <p className="px-3 py-4 text-xs leading-5 text-[#8a929f]">Create a conversation to begin a private gvone chat.</p>}</div></aside>

      <section className="min-w-0 p-4 sm:p-6 lg:p-8">{!activeConversationId ? <div className="grid min-h-[560px] place-items-center rounded-[1.75rem] border border-dashed border-[#d8dce4] bg-white/55 p-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#eeedff] text-[#635bff]"><Sparkles className="h-6 w-6" /></span><h1 className="mt-5 text-2xl font-semibold tracking-[-.04em]">Start a private gvone chat</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#68707d]">When a thought opens a new direction, branch from any message. The original stays unchanged and the new branch remembers everything before it.</p><button type="button" onClick={() => createConversation.mutate({})} className="mt-6 rounded-full bg-[#635bff] px-5 py-3 text-sm font-semibold text-white">Create conversation</button></div></div> : <div className="mx-auto flex max-w-4xl flex-col"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-[#8a929f]"><Bot className="h-3.5 w-3.5 text-[#635bff]" /> Private workspace</div><h1 className="mt-1 text-2xl font-semibold tracking-[-.04em]">{activeConversation?.title ?? "Conversation"}</h1></div>{activeConversation?.parentConversationId && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0eaff] px-3 py-1.5 text-xs font-semibold text-[#704ee5]"><GitFork className="h-3.5 w-3.5" /> {inheritedCount} remembered message{inheritedCount === 1 ? "" : "s"}</span>}</div>{activeChat.isLoading ? <div className="grid h-[620px] place-items-center rounded-[1.5rem] bg-white"><Loader2 className="h-6 w-6 animate-spin text-[#635bff]" /></div> : <AIChatBox messages={messages} onSendMessage={(content) => { if (activeConversationId) sendMessage.mutate({ conversationId: activeConversationId, content }); }} isLoading={sendMessage.isPending} height="min(68vh, 680px)" placeholder="Ask gvone anything…" emptyStateMessage="This private conversation is ready." suggestedPrompts={promptSuggestions} messageActions={(message) => message.id && message.conversationId ? <button type="button" onClick={() => branchConversation.mutate({ conversationId: message.conversationId!, messageId: message.id! })} disabled={branchConversation.isPending} className="mt-1 inline-flex items-center gap-1 rounded-md px-1 text-[11px] font-semibold text-[#7b728d] transition hover:text-[#635bff] disabled:opacity-50"><GitFork className="h-3 w-3" /> Branch from here</button> : null} />}</div>}</section>
    </main>
  </div>;
}
