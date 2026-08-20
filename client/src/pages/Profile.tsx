import React, { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CornerDownRight, Loader2, MessageCircleQuestion, Pencil, Quote, Radio, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

function normalizeStoryUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  for (const key of Array.from(url.searchParams.keys())) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  return url.toString();
}

export default function Profile() {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const activity = trpc.storyPulse.profile.activity.useQuery(undefined, { enabled: auth.isAuthenticated });
  const rssArticles = trpc.feed.articles.useQuery(undefined, { enabled: auth.isAuthenticated });
  const dashboard = trpc.dashboard.useQuery(undefined, { enabled: auth.isAuthenticated });
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const articleByUrl = useMemo(() => new Map((rssArticles.data ?? []).map((article) => [normalizeStoryUrl(article.link), article])), [rssArticles.data]);
  const updateProfile = trpc.storyPulse.profile.update.useMutation({
    onSuccess: async () => { setEditing(false); await utils.storyPulse.profile.activity.invalidate(); toast.success("Profile updated"); },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => { if (activity.data?.profile) { setDisplayName(activity.data.profile.displayName); setUsername(activity.data.profile.username); setBio(activity.data.profile.bio ?? ""); } }, [activity.data?.profile]);
  if (auth.loading || activity.isLoading) return <div className="grid min-h-screen place-items-center bg-[#f7f8fa]"><Loader2 className="h-6 w-6 animate-spin text-[#635bff]" /></div>;
  if (!auth.isAuthenticated) return <main className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6 text-center"><div><Sparkles className="mx-auto h-7 w-7 text-[#635bff]" /><h1 className="mt-4 text-2xl font-semibold">Sign in to view your profile</h1><button type="button" onClick={startLogin} className="mt-5 rounded-full bg-[#635bff] px-5 py-3 text-sm font-semibold text-white">Sign in</button></div></main>;
  const profile = activity.data?.profile;
  const threads = activity.data?.reposts ?? [];
  const questions = threads.filter((item) => item.parentPostId === null || item.parentPostId === undefined);
  const answers = threads.filter((item) => item.parentPostId !== null && item.parentPostId !== undefined);

  return <div className="min-h-screen bg-[#f7f8fa] text-[#14161a]">
    <header className="flex h-[76px] items-center border-b border-[#e6e8ed] bg-[#f7f8fa]/90 px-5 backdrop-blur-xl sm:px-8"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#68707d] hover:text-[#635bff]"><ArrowLeft className="h-4 w-4" /> Reader</Link><div className="ml-5 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#17171d] text-white"><Sparkles className="h-4 w-4" /></span><span className="text-lg font-semibold tracking-[-.03em]">Your <span className="text-[#635bff]">profile</span></span></div></header>
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <section className="rounded-[1.75rem] bg-[#17171d] p-6 text-white shadow-[0_16px_42px_rgba(24,24,32,.15)]">
        <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-4"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#f0eaff] text-2xl font-bold text-[#704ee5]">{profile?.displayName?.charAt(0).toUpperCase() || "G"}</span><div><h1 className="text-2xl font-semibold tracking-[-.04em]">{profile?.displayName || "gvone member"}</h1><p className="mt-1 font-mono text-xs font-semibold text-[#bdb9ff]">@{profile?.username || "member"}</p><p className="mt-2 max-w-lg text-sm leading-6 text-white/55">{profile?.bio || "Sharing the signals worth carrying forward."}</p></div></div><button type="button" onClick={() => setEditing((value) => !value)} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold hover:bg-white/15"><Pencil className="h-3.5 w-3.5" /> Edit</button></div>
        {editing && <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} placeholder="Display name" className="rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm outline-none focus:border-[#a7a1ff]" /><div><div className="flex overflow-hidden rounded-xl border border-white/10 bg-black/15 focus-within:border-[#a7a1ff]"><span className="px-3 py-2.5 text-sm text-white/45">@</span><input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} minLength={3} maxLength={30} placeholder="unique_username" className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-sm outline-none" /></div><p className="mt-1.5 text-[11px] text-white/45">3–30 characters; letters, numbers, and underscores.</p></div><textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} rows={3} placeholder="A short bio" className="resize-none rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm outline-none focus:border-[#a7a1ff]" /><button type="button" disabled={!displayName.trim() || !/^[a-z][a-z0-9_]{2,29}$/.test(username) || updateProfile.isPending} onClick={() => updateProfile.mutate({ displayName, username, bio: bio || undefined })} className="ml-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#17171d] disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Save profile</button></div>}
        <div className="mt-6 flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70"><MessageCircleQuestion className="h-3.5 w-3.5 text-[#a7a1ff]" /> {questions.length} Thread{questions.length === 1 ? "" : "s"} started</span><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70"><CornerDownRight className="h-3.5 w-3.5 text-[#a7a1ff]" /> {answers.length} Echo{answers.length === 1 ? "" : "es"} sent</span></div>
      </section>
      <section className="mt-8"><div className="mb-4"><h2 className="text-xl font-semibold tracking-[-.03em]">Your Threads</h2><p className="mt-1 text-sm text-[#7d8794]">Story Threads you have opened from RSS stories.</p></div><div className="space-y-3">{questions.length ? questions.map((thread) => { const article = articleByUrl.get(normalizeStoryUrl(thread.storyUrl)); const feed = article ? dashboard.data?.feeds.find((item) => item.id === article.feedId) : undefined; const sourceLabel = feed?.customTitle || feed?.title || new URL(thread.storyUrl).hostname; return <Link key={thread.id} href={`/pulse/${thread.discussionId}#thread-${thread.id}`} className="block rounded-[1.25rem] border border-[#e3e6ec] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c8c4ff]"><div className="text-xs font-semibold text-[#635bff]">{sourceLabel}</div><h3 className="mt-1 line-clamp-2 text-base font-semibold">{article?.title || "RSS story reference"}</h3><div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#8b7ade]"><MessageCircleQuestion className="h-3.5 w-3.5" /> Story Thread</div><p className="mt-2 line-clamp-3 text-sm leading-6 text-[#657080]">{thread.content}</p></Link>; }) : <div className="rounded-[1.5rem] border border-dashed border-[#d8dce4] bg-white/55 px-6 py-12 text-center"><MessageCircleQuestion className="mx-auto h-6 w-6 text-[#a9a2dc]" /><p className="mt-3 text-sm text-[#7d8794]">Threads you open around RSS stories will appear here.</p></div>}</div></section>
      <section className="mt-10"><div className="mb-4"><h2 className="text-xl font-semibold tracking-[-.03em]">Your Echoes</h2><p className="mt-1 text-sm text-[#7d8794]">Echoes you have shared, each linked back to the original Thread.</p></div><div className="space-y-3">{answers.length ? answers.map((answer) => { const article = articleByUrl.get(normalizeStoryUrl(answer.storyUrl)); const feed = article ? dashboard.data?.feeds.find((item) => item.id === article.feedId) : undefined; const sourceLabel = feed?.customTitle || feed?.title || new URL(answer.storyUrl).hostname; return <Link key={answer.id} href={`/pulse/${answer.discussionId}#thread-${answer.parentPostId}`} className="block rounded-[1.25rem] border border-[#e3e6ec] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c8c4ff]"><div className="text-xs font-semibold text-[#635bff]">{sourceLabel}</div><h3 className="mt-1 line-clamp-2 text-base font-semibold">{article?.title || "RSS story reference"}</h3><div className="mt-3 rounded-xl border border-[#e5e2ff] bg-[#faf9ff] px-3 py-2 text-xs text-[#697280]"><div className="flex items-center gap-1.5 font-semibold text-[#635bff]"><Quote className="h-3.5 w-3.5" /> Echoing @{answer.quotedUsername || answer.parentUsername || "member"}’s Thread</div><p className="mt-1 line-clamp-2 leading-5">{answer.quotedContent || answer.parentContent || "Open the Thread"}</p></div><div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#8b7ade]"><CornerDownRight className="h-3.5 w-3.5" /> Echo · Open Thread</div><p className="mt-2 line-clamp-3 text-sm leading-6 text-[#657080]">{answer.content}</p></Link>; }) : <div className="rounded-[1.5rem] border border-dashed border-[#d8dce4] bg-white/55 px-6 py-12 text-center"><CornerDownRight className="mx-auto h-6 w-6 text-[#a9a2dc]" /><p className="mt-3 text-sm text-[#7d8794]">Echoes you share will appear here with their original Thread.</p></div>}</div></section>
    </main>
  </div>;
}
