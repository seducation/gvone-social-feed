import React, { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ExternalLink, Loader2, Radio, Repeat2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

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
  const pulse = trpc.storyPulse.get.useQuery({ discussionId }, { enabled: auth.isAuthenticated && Number.isFinite(discussionId) && discussionId > 0 });
  const rssArticles = trpc.feed.articles.useQuery(undefined, { enabled: auth.isAuthenticated });
  const dashboard = trpc.dashboard.useQuery(undefined, { enabled: auth.isAuthenticated });
  const repost = trpc.storyPulse.repost.useMutation({
    onSuccess: async () => {
      setContent("");
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
  const feed = article ? dashboard.data?.feeds.find((item) => item.id === article.feedId) : undefined;
  const sourceLabel = feed?.customTitle || feed?.title || new URL(discussion.storyUrl).hostname;
  const storyTitle = article?.title || "RSS story reference";
  const reposts = pulse.data.reposts;

  return <div className="min-h-screen bg-[#f7f8fa] text-[#14161a]">
    <header className="flex h-[76px] items-center border-b border-[#e6e8ed] bg-[#f7f8fa]/90 px-5 backdrop-blur-xl sm:px-8">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#68707d] hover:text-[#635bff]"><ArrowLeft className="h-4 w-4" /> Reader</Link>
      <div className="ml-5 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#17171d] text-white"><Radio className="h-4 w-4" /></span><span className="text-lg font-semibold tracking-[-.03em]">Story <span className="text-[#635bff]">Pulse</span></span></div>
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
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold tracking-[-.03em]">Pulse activity</h2><p className="mt-1 text-sm text-[#7d8794]">Every response is a repost of this RSS story.</p></div><span className="rounded-full bg-[#eeedff] px-3 py-1.5 text-xs font-semibold text-[#635bff]">{reposts.length} repost{reposts.length === 1 ? "" : "s"}</span></div>
        <div className="rounded-[1.5rem] border border-[#e3e6ec] bg-white p-4 shadow-[0_8px_25px_rgba(24,31,45,.03)]">
          <label className="sr-only" htmlFor="repost-note">Your repost</label>
          <textarea id="repost-note" value={content} onChange={(event) => setContent(event.target.value)} maxLength={600} rows={3} placeholder="Add your signal to this story…" className="w-full resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[#a1a8b4]" />
          <div className="mt-2 flex items-center justify-between border-t border-[#eef0f3] pt-3"><span className="text-xs text-[#9aa2ae]">{content.length}/600</span><button type="button" disabled={!content.trim() || repost.isPending} onClick={() => repost.mutate({ discussionId, content })} className="inline-flex items-center gap-2 rounded-full bg-[#635bff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Repeat2 className="h-4 w-4" /> Repost</button></div>
        </div>
        <div className="mt-4 space-y-3">
          {reposts.length ? reposts.map((item) => <article key={item.id} className="rounded-[1.25rem] border border-[#e5e8ed] bg-white p-5"><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f0eaff] text-sm font-bold text-[#704ee5]">{initial(item.displayName)}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{item.displayName || "gvone member"}</span><span className="text-xs text-[#9aa2ae]">· {relativeTime(item.createdAt)}</span></div><div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#8b7ade]"><Repeat2 className="h-3 w-3" /> Reposted</div>{item.content && <p className="mt-3 text-sm leading-6 text-[#4f5968]">{item.content}</p>}</div></div></article>) : <div className="rounded-[1.5rem] border border-dashed border-[#d8dce4] bg-white/55 px-6 py-12 text-center"><Repeat2 className="mx-auto h-6 w-6 text-[#a9a2dc]" /><p className="mt-3 text-sm text-[#7d8794]">Be the first to add a signal to this story.</p></div>}
        </div>
      </section>
    </main>
  </div>;
}
