import React, { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, CornerDownRight, ExternalLink, Hash, Loader2, MessageCircleQuestion, Quote, Radio, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { publicStoryProviderLabel } from "@/lib/storyProvider";

function initial(name: string | null) {
  return (name?.trim().charAt(0) || "G").toUpperCase();
}

function relativeTime(value: Date | string) {
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeStoryUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  for (const key of Array.from(url.searchParams.keys())) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  return url.toString();
}

export default function StoryPulse() {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const [, params] = useRoute("/pulse/:id");
  const discussionId = Number(params?.id ?? 0);
  const [content, setContent] = useState("");
  const [selectedTopicSlugs, setSelectedTopicSlugs] = useState<string[]>([]);
  const [answerContent, setAnswerContent] = useState("");
  const [answerTarget, setAnswerTarget] = useState<{ id: number; displayName: string | null; username: string | null; content: string | null } | null>(null);
  const pulse = trpc.storyPulse.get.useQuery({ discussionId }, { enabled: auth.isAuthenticated && Number.isFinite(discussionId) && discussionId > 0 });
  const rssArticles = trpc.feed.articles.useQuery(undefined, { enabled: auth.isAuthenticated });
  const topics = trpc.topicCommunity.list.useQuery(undefined, { enabled: auth.isAuthenticated });
  const repost = trpc.storyPulse.repost.useMutation({
    onSuccess: async () => {
      setContent("");
      setSelectedTopicSlugs([]);
      await Promise.all([utils.storyPulse.get.invalidate({ discussionId }), utils.storyPulse.profile.activity.invalidate(), utils.topicCommunity.list.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });
  const reply = trpc.storyPulse.reply.useMutation({
    onSuccess: async () => {
      setAnswerContent("");
      setAnswerTarget(null);
      await Promise.all([utils.storyPulse.get.invalidate({ discussionId }), utils.storyPulse.profile.activity.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => { if (pulse.error) toast.error(pulse.error.message); }, [pulse.error]);

  if (auth.loading) return <div className="grid min-h-screen place-items-center bg-[#f7f8fa]"><Loader2 className="h-6 w-6 animate-spin text-[#635bff]" /></div>;
  if (!auth.isAuthenticated) return <main className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#17171d] text-white"><Radio className="h-6 w-6" /></span><h1 className="mt-5 text-2xl font-semibold">Sign in to open Story Pulse</h1><button type="button" onClick={startLogin} className="mt-5 rounded-full bg-[#635bff] px-5 py-3 text-sm font-semibold text-white">Sign in</button></div></main>;
  if (pulse.isLoading) return <div className="grid min-h-screen place-items-center bg-[#f7f8fa]"><Loader2 className="h-6 w-6 animate-spin text-[#635bff]" /></div>;
  const discussion = pulse.data?.discussion;
  if (!discussion || !pulse.data) return <main className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6 text-center"><div><h1 className="text-2xl font-semibold">Story Pulse unavailable</h1><Link href="/" className="mt-4 inline-block text-sm font-semibold text-[#635bff]">Return to reader</Link></div></main>;

  const article = (rssArticles.data ?? []).find((item) => normalizeStoryUrl(item.link) === discussion.storyUrl);
  const sourceLabel = publicStoryProviderLabel(discussion.storyUrl);
  const storyTitle = article?.title || "RSS story reference";
  const reposts = pulse.data.reposts;
  const joinedTopics = (topics.data ?? []).filter((topic) => topic.isMember);

  return <div className="min-h-screen bg-[#f7f8fa] text-[#14161a]">
    <header className="flex h-[76px] items-center border-b border-[#e6e8ed] bg-[#f7f8fa]/90 px-5 backdrop-blur-xl sm:px-8">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#68707d] hover:text-[#635bff]"><ArrowLeft className="h-4 w-4" /> Reader</Link>
      <div className="ml-5 flex min-w-0 items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#17171d] text-white"><Radio className="h-4 w-4" /></span><div className="min-w-0"><div className="truncate text-lg font-semibold tracking-[-.03em]">{sourceLabel}</div><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#8a929f]">RSS story · Story Pulse</div></div></div>
      <Link href="/profile" className="ml-auto inline-flex items-center gap-2 rounded-full border border-[#e1e4ea] bg-white px-3.5 py-2 text-sm font-semibold text-[#596270] hover:border-[#635bff] hover:text-[#635bff]"><Sparkles className="h-4 w-4" /> Profile</Link>
    </header>
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-[#8a929f]"><Radio className="h-3.5 w-3.5 text-[#635bff]" /> RSS story · live context</div>
      <article className="overflow-hidden rounded-[1.5rem] border border-[#e3e6ec] bg-white shadow-[0_12px_34px_rgba(24,31,45,.05)]">
        <div className="p-6">
          {article?.thumbnailUrl && <img src={article.thumbnailUrl} alt="" className="mb-5 aspect-[2/1] w-full rounded-xl object-cover" />}
          <div className="text-xs font-semibold text-[#635bff]">{sourceLabel}</div>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-[-.04em] sm:text-3xl">{storyTitle}</h1>
          {article?.description && <p className="mt-3 text-sm leading-6 text-[#68707d]">{article.description}</p>}
          <a href={discussion.storyUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#635bff] hover:text-[#4c42c7]">Open RSS story <ExternalLink className="h-4 w-4" /></a>
        </div>
      </article>
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold tracking-[-.03em]">Story Threads</h2><p className="mt-1 text-sm text-[#7d8794]">Open a Thread around this RSS story, then add a Reply to a member’s Thread.</p></div><span className="rounded-full bg-[#eeedff] px-3 py-1.5 text-xs font-semibold text-[#635bff]">{reposts.length} Thread{reposts.length === 1 ? "" : "s"}</span></div>
        <div className="rounded-[1.5rem] border border-[#e3e6ec] bg-white p-4 shadow-[0_8px_25px_rgba(24,31,45,.03)]">
          <label className="sr-only" htmlFor="repost-note">Start a Thread</label>
          <textarea id="repost-note" value={content} onChange={(event) => setContent(event.target.value)} maxLength={600} rows={3} placeholder="Add your angle to this story…" className="w-full resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[#a1a8b4]" />
          {joinedTopics.length > 0 && <fieldset className="mt-3 border-t border-[#eef0f3] pt-3"><legend className="flex items-center gap-1.5 text-xs font-semibold text-[#68707d]"><Hash className="h-3.5 w-3.5 text-[#8b7ade]" /> Also publish to Topics <span className="font-normal text-[#9aa2ae]">(optional)</span></legend><div className="mt-2 flex flex-wrap gap-2">{joinedTopics.map((topic) => { const selected = selectedTopicSlugs.includes(topic.slug); return <button type="button" key={topic.id} aria-pressed={selected} onClick={() => setSelectedTopicSlugs((slugs) => selected ? slugs.filter((slug) => slug !== topic.slug) : [...slugs, topic.slug])} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selected ? "border-[#635bff] bg-[#eeedff] text-[#635bff]" : "border-[#e1e4ea] bg-white text-[#68707d] hover:border-[#bdb9ff]"}`}>{topic.name}</button>; })}</div><p className="mt-2 text-[11px] leading-4 text-[#9aa2ae]">No topic selected means this Thread stays only with this RSS story.</p></fieldset>}
          <div className="mt-2 flex items-center justify-between border-t border-[#eef0f3] pt-3"><span className="text-xs text-[#9aa2ae]">{content.length}/600</span><button type="button" disabled={!content.trim() || repost.isPending} onClick={() => repost.mutate(selectedTopicSlugs.length ? { discussionId, content, topicSlugs: selectedTopicSlugs } : { discussionId, content })} className="inline-flex items-center gap-2 rounded-full bg-[#635bff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><MessageCircleQuestion className="h-4 w-4" /> Start Thread</button></div>
        </div>
        <div className="mt-4 space-y-3">
          {reposts.length ? reposts.map((item) => <article key={item.id} id={`thread-${item.id}`} className="scroll-mt-6 rounded-[1.25rem] border border-[#e5e8ed] bg-white p-5"><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f0eaff] text-sm font-bold text-[#704ee5]">{initial(item.displayName)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="truncate text-sm font-semibold">{item.displayName || "gvone member"}</span><span className="font-mono text-xs font-semibold text-[#8b7ade]">@{item.username || "member"}</span><span className="text-xs text-[#9aa2ae]">· {relativeTime(item.createdAt)}</span></div><div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#8b7ade]"><MessageCircleQuestion className="h-3 w-3" /> Story Thread</div>{item.content && <p className="mt-3 text-sm leading-6 text-[#4f5968]">{item.content}</p>}<div className="mt-4 flex items-center gap-3"><button type="button" onClick={() => { setAnswerTarget({ id: item.id, displayName: item.displayName, username: item.username, content: item.content }); setAnswerContent(""); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#635bff] hover:text-[#4c42c7]"><Quote className="h-3.5 w-3.5" /> Reply</button><span className="text-xs text-[#9aa2ae]">{item.replies.length} Reply{item.replies.length === 1 ? "" : "es"}</span></div>{answerTarget?.id === item.id && <div className="mt-4 rounded-2xl border border-[#dcd9ff] bg-[#f8f7ff] p-3"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-1.5 text-xs font-semibold text-[#635bff]"><Quote className="h-3.5 w-3.5" /> Replying to @{item.username || "member"}’s Thread</div><p className="mt-1 line-clamp-2 text-xs leading-5 text-[#6d7584]">{item.content}</p></div><button type="button" onClick={() => setAnswerTarget(null)} aria-label="Cancel Reply" className="rounded-lg p-1 text-[#8a929f] hover:bg-white hover:text-[#4f5968]"><X className="h-4 w-4" /></button></div><label className="sr-only" htmlFor={`answer-note-${item.id}`}>Your Reply</label><textarea id={`answer-note-${item.id}`} value={answerContent} onChange={(event) => setAnswerContent(event.target.value)} maxLength={600} rows={3} placeholder="Add your Reply…" className="mt-3 w-full resize-none rounded-xl border border-[#e1dfff] bg-white px-3 py-2.5 text-sm outline-none placeholder:text-[#a1a8b4] focus:border-[#a7a1ff]" /><div className="mt-2 flex items-center justify-between"><span className="text-xs text-[#9aa2ae]">{answerContent.length}/600</span><button type="button" disabled={!answerContent.trim() || reply.isPending} onClick={() => reply.mutate({ discussionId, parentPostId: item.id, quotedPostId: item.id, content: answerContent })} className="inline-flex items-center gap-1.5 rounded-full bg-[#635bff] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"><CornerDownRight className="h-3.5 w-3.5" /> Send Reply</button></div></div>}{item.replies.length > 0 && <section aria-label={`Replies on ${item.username || item.displayName || "gvone member"}’s Thread`} className="mt-5 space-y-3 border-l-2 border-[#eeedff] pl-4">{item.replies.map((answer) => <article key={answer.id} className="rounded-2xl bg-[#fafbfc] p-4"><a href={`#thread-${item.id}`} className="block rounded-xl border border-[#e5e2ff] bg-white px-3 py-2 text-xs text-[#697280] hover:border-[#c8c4ff]"><span className="flex items-center gap-1.5 font-semibold text-[#635bff]"><Quote className="h-3.5 w-3.5" /> Replying to @{answer.quotedUsername || item.username || "member"}’s Thread</span><span className="mt-1 block line-clamp-2 leading-5">{answer.quotedContent || item.content}</span></a><div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f0eaff] text-xs font-bold text-[#704ee5]">{initial(answer.displayName)}</span><span className="text-sm font-semibold">{answer.displayName || "gvone member"}</span><span className="font-mono text-xs font-semibold text-[#8b7ade]">@{answer.username || "member"}</span><span className="text-xs text-[#9aa2ae]">· {relativeTime(answer.createdAt)}</span></div>{answer.content && <p className="mt-2 text-sm leading-6 text-[#4f5968]">{answer.content}</p>}</article>)}</section>}</div></div></article>) : <div className="rounded-[1.5rem] border border-dashed border-[#d8dce4] bg-white/55 px-6 py-12 text-center"><MessageCircleQuestion className="mx-auto h-6 w-6 text-[#a9a2dc]" /><p className="mt-3 text-sm text-[#7d8794]">Be the first to open a Thread around this RSS story.</p></div>}
        </div>
      </section>
    </main>
  </div>;
}
