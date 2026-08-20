import React, { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, FilePenLine, Hash, Loader2, MessageCircleQuestion, MessageSquarePlus, Pencil, Plus, Save, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { publicStoryProviderLabel } from "@/lib/storyProvider";

type ActivityTab = "all" | "stories" | "profile" | "provider" | "topics";
type OverviewItem = {
  key: string;
  kind: "Story Pulse" | "Profile post" | "Provider post" | "Topic post" | "RSS Thread";
  context: string;
  title: string;
  body: string;
  href: string;
  createdAt: Date | string;
  tone: "lilac" | "mint" | "blue" | "rose" | "amber";
  visual?: { thumbnailUrl?: string | null; videoUrl?: string | null; videoMimeType?: string | null };
};

const preview = (value: string | null | undefined, fallback: string) => (
  value?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || fallback
).slice(0, 180);

const cardTone: Record<OverviewItem["tone"], string> = {
  lilac: "border-[#e4e0fb] hover:border-[#afa3ff]",
  mint: "border-[#d6ece4] hover:border-[#7ac9ac]",
  blue: "border-[#dce9f8] hover:border-[#92c4ff]",
  rose: "border-[#f1e0e8] hover:border-[#ebb3cb]",
  amber: "border-[#eee3cf] hover:border-[#e5bd7a]",
};

function getYouTubePreview(videoUrl: string | null | undefined) {
  const match = videoUrl?.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([^?&#/]+)/i);
  return match?.[1] ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : null;
}

function ActivityVisual({ item }: { item: OverviewItem }) {
  const visual = item.visual;
  const imageUrl = visual?.thumbnailUrl || getYouTubePreview(visual?.videoUrl);
  const isNativeVideo = Boolean(visual?.videoUrl && visual.videoMimeType && visual.videoMimeType !== "text/html");
  if (!imageUrl && !isNativeVideo) return null;
  return <div className="relative -mx-3.5 -mt-3.5 mb-3 overflow-hidden rounded-t-[1.45rem] bg-[#eef0f4]">
    {isNativeVideo ? <video muted playsInline preload="metadata" src={visual?.videoUrl ?? undefined} poster={imageUrl ?? undefined} className="aspect-[4/3] w-full object-cover" /> : <img src={imageUrl ?? undefined} alt={`Preview for ${item.title}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />}
    <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-white">{isNativeVideo ? "Video" : "Story"}</span>
  </div>;
}

export default function Profile() {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const activity = trpc.storyPulse.profile.activity.useQuery(undefined, { enabled: auth.isAuthenticated });
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [tab, setTab] = useState<ActivityTab>("all");
  const [postComposerOpen, setPostComposerOpen] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const updateProfile = trpc.storyPulse.profile.update.useMutation({
    onSuccess: async () => {
      setEditing(false);
      await utils.storyPulse.profile.activity.invalidate();
      toast.success("Profile updated");
    },
    onError: error => toast.error(error.message),
  });
  const createProfilePost = trpc.storyPulse.profile.createPost.useMutation({
    onSuccess: async () => {
      setPostComposerOpen(false);
      setPostTitle("");
      setPostBody("");
      await utils.storyPulse.profile.activity.invalidate();
      toast.success("Profile post published");
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (activity.data?.profile) {
      setDisplayName(activity.data.profile.displayName);
      setUsername(activity.data.profile.username);
      setBio(activity.data.profile.bio ?? "");
    }
  }, [activity.data?.profile]);

  const profile = activity.data?.profile;
  const pulse = activity.data?.reposts ?? [];
  const questions = pulse.filter((item: any) => item.parentPostId == null);
  const replies = pulse.filter((item: any) => item.parentPostId != null);
  const profilePosts = activity.data?.profilePosts ?? [];
  const providerPosts = activity.data?.communityPosts ?? [];
  const topicActivity = activity.data?.topicActivity ?? [];
  const topicGroups = useMemo(() => Array.from(
    topicActivity.reduce((groups: Map<string, any[]>, item: any) => {
      const current = groups.get(item.communitySlug) ?? [];
      current.push(item);
      groups.set(item.communitySlug, current);
      return groups;
    }, new Map<string, any[]>()).entries(),
  ).map(([slug, items]) => ({
    slug,
    name: items[0].communityName,
    items: items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  })).sort((a, b) => new Date(b.items[0].createdAt).getTime() - new Date(a.items[0].createdAt).getTime()), [topicActivity]);
  const overviewItems = useMemo<OverviewItem[]>(() => [
    ...profilePosts.map((post: any) => ({
      key: `profile-${post.id}`,
      kind: "Profile post" as const,
      context: "Profile activity",
      title: post.title || "Profile update",
      body: preview(post.body, "Open profile post"),
      href: `/profile#profile-post-${post.id}`,
      createdAt: post.createdAt,
      tone: "mint" as const,
    })),
    ...pulse.map((item: any) => ({
      key: `pulse-${item.id}`,
      kind: "Story Pulse" as const,
      context: `${item.parentPostId == null ? "Thread" : "Reply"} · ${publicStoryProviderLabel(item.storyUrl)}`,
      title: item.parentPostId == null ? "Story Pulse Thread" : "Story Pulse Reply",
      body: preview(item.content, "Open the RSS story discussion"),
      href: `/pulse/${item.discussionId}#thread-${item.parentPostId ?? item.id}`,
      createdAt: item.createdAt,
      tone: "lilac" as const,
      visual: item.story ? { thumbnailUrl: item.story.thumbnailUrl, videoUrl: item.story.videoUrl, videoMimeType: item.story.videoMimeType } : undefined,
    })),
    ...providerPosts.map((post: any) => ({
      key: `provider-${post.id}`,
      kind: "Provider post" as const,
      context: post.providerHostname,
      title: post.title,
      body: preview(post.body, "Open provider post"),
      href: `/community/${encodeURIComponent(post.providerHostname)}`,
      createdAt: post.createdAt,
      tone: "blue" as const,
    })),
    ...topicActivity.map((item: any) => ({
      key: `topic-${item.kind}-${item.id}`,
      kind: (item.kind === "thread" ? "RSS Thread" : "Topic post") as OverviewItem["kind"],
      context: `# ${item.communityName}`,
      title: item.title || (item.kind === "thread" ? "RSS Thread" : "Topic post"),
      body: preview(item.body, item.kind === "thread" ? "Open the shared RSS Thread" : "Open topic post"),
      href: `/topics/${item.communitySlug}/discussion/${item.kind}/${item.id}`,
      createdAt: item.createdAt,
      tone: (item.kind === "thread" ? "amber" : "rose") as OverviewItem["tone"],
      visual: item.story ? { thumbnailUrl: item.story.thumbnailUrl, videoUrl: item.story.videoUrl, videoMimeType: item.story.videoMimeType } : undefined,
    })),
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()), [profilePosts, pulse, providerPosts, topicActivity]);
  const overviewColumns = useMemo(() => [
    overviewItems.filter((_, index) => index % 2 === 0),
    overviewItems.filter((_, index) => index % 2 === 1),
  ], [overviewItems]);
  const tabs: { id: ActivityTab; label: string; count: number }[] = [
    { id: "all", label: "Overview", count: overviewItems.length },
    { id: "stories", label: "Story Pulse", count: questions.length + replies.length },
    { id: "profile", label: "Profile posts", count: profilePosts.length },
    { id: "provider", label: "Provider posts", count: providerPosts.length },
    { id: "topics", label: "Topics", count: topicActivity.length },
  ];

  if (auth.loading || activity.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#f7f8fa]"><Loader2 className="h-6 w-6 animate-spin text-[#635bff]" /></div>;
  }

  if (!auth.isAuthenticated) {
    return <main className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6 text-center"><div><Sparkles className="mx-auto h-7 w-7 text-[#635bff]" /><h1 className="mt-4 text-2xl font-semibold">Sign in to view your profile</h1><button onClick={startLogin} className="mt-5 rounded-full bg-[#635bff] px-5 py-3 text-sm font-semibold text-white">Sign in</button></div></main>;
  }

  return <div className="min-h-screen bg-[#f7f8fa] text-[#14161a]">
    <header data-testid="profile-header" className="flex h-[76px] items-center border-b border-[#e6e8ed] bg-[#f7f8fa]/90 px-5 backdrop-blur-xl sm:px-8">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#68707d] hover:text-[#635bff]"><ArrowLeft className="h-4 w-4" /> Reader</Link>
      <div className="ml-5 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#17171d] text-white"><Sparkles className="h-4 w-4" /></span><span className="text-lg font-semibold">Your <span className="text-[#635bff]">profile</span></span></div>
      <button type="button" onClick={() => setPostComposerOpen(true)} aria-label="Create Profile post" className="ml-auto grid h-9 w-9 place-items-center rounded-xl bg-[#635bff] text-white shadow-[0_5px_12px_rgba(99,91,255,.25)] transition-transform active:scale-95"><Plus className="h-4 w-4" /></button>
    </header>
    {postComposerOpen && <div role="dialog" aria-modal="true" aria-label="New Profile post" onClick={() => setPostComposerOpen(false)} className="fixed inset-0 z-50 grid place-items-center bg-[#14161a]/35 p-5 backdrop-blur-sm"><form onClick={event => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); createProfilePost.mutate({ title: postTitle.trim() || undefined, body: postBody }); }} className="w-full max-w-lg rounded-[1.5rem] border border-[#ddd8ff] bg-[#f9f8ff] p-5 shadow-[0_20px_55px_rgba(24,27,36,.2)]"><div className="flex items-center justify-between gap-3"><div className="inline-flex items-center gap-2 text-sm font-bold text-[#41368f]"><FilePenLine className="h-4 w-4" /> New Profile post</div><button type="button" onClick={() => setPostComposerOpen(false)} aria-label="Close Profile post composer" className="grid h-7 w-7 place-items-center rounded-full text-[#706e81] hover:bg-white"><X className="h-4 w-4" /></button></div><input autoFocus value={postTitle} onChange={event => setPostTitle(event.target.value)} maxLength={160} placeholder="Title (optional)" className="mt-4 w-full rounded-xl border border-[#e4e1f5] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#8d83e8]" /><textarea value={postBody} onChange={event => setPostBody(event.target.value)} maxLength={2000} required rows={5} placeholder="Share a profile update…" className="mt-3 w-full resize-none rounded-xl border border-[#e4e1f5] bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-[#8d83e8]" /><div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] font-medium text-[#8a8a9d]">Visible in Overview and Profile posts.</span><button type="submit" disabled={!postBody.trim() || createProfilePost.isPending} className="rounded-full bg-[#635bff] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{createProfilePost.isPending ? "Publishing…" : "Post"}</button></div></form></div>}
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <section className="rounded-[1.75rem] bg-[#17171d] p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#f0eaff] text-2xl font-bold text-[#704ee5]">{profile?.displayName?.charAt(0).toUpperCase() || "G"}</span><div><h1 className="text-2xl font-semibold">{profile?.displayName || "gvone member"}</h1><p className="mt-1 font-mono text-xs font-semibold text-[#bdb9ff]">@{profile?.username || "member"}</p><p className="mt-2 max-w-lg text-sm leading-6 text-white/55">{profile?.bio || "Sharing the signals worth carrying forward."}</p></div></div>
          <button onClick={() => setEditing(value => !value)} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold"><Pencil className="h-3.5 w-3.5" /> Edit</button>
        </div>
        {editing && <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"><input value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={80} placeholder="Display name" className="rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm outline-none" /><div className="flex overflow-hidden rounded-xl border border-white/10 bg-black/15"><span className="px-3 py-2.5 text-sm text-white/45">@</span><input value={username} onChange={event => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} minLength={3} maxLength={30} placeholder="unique_username" className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-sm outline-none" /></div><textarea value={bio} onChange={event => setBio(event.target.value)} maxLength={280} rows={3} placeholder="A short bio" className="resize-none rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm outline-none" /><button disabled={!displayName.trim() || !/^[a-z][a-z0-9_]{2,29}$/.test(username) || updateProfile.isPending} onClick={() => updateProfile.mutate({ displayName, username, bio: bio || undefined })} className="ml-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#17171d] disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Save profile</button></div>}
        <div className="mt-6 flex flex-wrap gap-2"><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">{questions.length} Threads</span><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">{replies.length} Replies</span><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">{topicActivity.length} Topic contributions</span></div>
      </section>

      <section data-testid="profile-activity-board" className="mt-8 rounded-[1.75rem] border border-[#e3e6ec] bg-white p-5 shadow-[0_8px_25px_rgba(24,31,45,.03)]">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">Activity board</h2><p className="mt-1 text-sm text-[#7d8794]">Every contribution you have shared, arranged in a compact visual collection.</p></div><span className="text-xs font-semibold text-[#8b7ade]">{tabs.find(item => item.id === tab)?.count ?? 0} items</span></div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">{tabs.map(item => <button key={item.id} onClick={() => setTab(item.id)} aria-pressed={tab === item.id} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold ${tab === item.id ? "bg-[#635bff] text-white" : "bg-[#f3f2ff] text-[#68707d] hover:bg-[#e9e7ff]"}`}>{item.label} <span className="ml-1 opacity-70">{item.count}</span></button>)}</div>

        {tab === "all" && <div className="mt-5">{overviewItems.length > 0 ? <div aria-label="All user activity" data-testid="profile-overview-grid" className="mx-auto grid max-w-2xl grid-cols-2 items-start gap-3 sm:gap-5">{overviewColumns.map((column, columnIndex) => <div key={columnIndex} data-testid={`profile-overview-column-${columnIndex}`} className={`space-y-3 sm:space-y-5 ${columnIndex === 1 ? "pt-8 sm:pt-12" : ""}`}>{column.map(item => <Link key={item.key} href={item.href} id={item.key.startsWith("profile-") ? `profile-post-${item.key.replace("profile-", "")}` : undefined} aria-label={`${item.kind}: ${item.title}`} className={`block overflow-hidden rounded-[1.55rem] border bg-white p-3.5 shadow-[0_7px_18px_rgba(30,35,50,.045)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(30,35,50,.08)] ${cardTone[item.tone]}`}><ActivityVisual item={item} /><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold uppercase tracking-[.1em] text-[#7869d4]">{item.kind}</span><span className="max-w-[52%] truncate text-[10px] font-semibold text-[#8c95a2]">{item.context}</span></div><h3 className="mt-2 text-sm font-bold leading-[1.13] tracking-[-.02em] text-[#21242b] sm:text-base">{item.title}</h3><p className="mt-2 text-xs leading-5 text-[#7b8491]">{item.body}</p><p className="mt-3 text-[10px] font-medium text-[#a0a7b1]">{new Date(item.createdAt).toLocaleDateString()}</p></Link>)}</div>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-[#dfe2e8] bg-[#fafbfc] p-8 text-center text-sm text-[#7d8794]">Your posts, Threads, and Replies will appear here as you share them.</div>}</div>}

        {tab === "stories" && <div className="mt-5 grid gap-3 md:grid-cols-2">{[...questions.map((item: any) => ({ ...item, role: "Thread" })), ...replies.map((item: any) => ({ ...item, role: "Reply" }))].slice(0, 8).map((item: any) => <Link key={`${item.role}-${item.id}`} href={`/pulse/${item.discussionId}#thread-${item.parentPostId ?? item.id}`} className="rounded-2xl border border-[#e5e7ed] p-4 hover:border-[#c8c4ff]"><div className="flex items-center gap-2 text-xs font-semibold text-[#635bff]"><MessageCircleQuestion className="h-3.5 w-3.5" /> {item.role} · {publicStoryProviderLabel(item.storyUrl)}</div><p className="mt-3 line-clamp-3 text-sm leading-6 text-[#596270]">{preview(item.content, "Open the RSS story discussion")}</p></Link>)}</div>}
        {tab === "profile" && <div className="mt-5 grid gap-3 md:grid-cols-2">{profilePosts.length ? profilePosts.map((post: any) => <article key={post.id} id={`profile-post-${post.id}`} className="rounded-2xl border border-[#d6ece4] bg-[#fbfffd] p-4"><div className="flex items-center gap-2 text-xs font-semibold text-[#3d9475]"><FilePenLine className="h-3.5 w-3.5" /> Profile post</div><h3 className="mt-3 font-semibold">{post.title || "Profile update"}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#68707d]">{post.body}</p><p className="mt-3 text-[11px] font-medium text-[#98a3a7]">{new Date(post.createdAt).toLocaleDateString()}</p></article>) : <div className="rounded-2xl border border-dashed border-[#d6ece4] bg-[#fbfffd] p-8 text-center text-sm text-[#7d8794]">Use the plus button in the header to publish your first Profile post.</div>}</div>}
        {tab === "provider" && <div className="mt-5 grid gap-3 md:grid-cols-2">{providerPosts.slice(0, 8).map((post: any) => <Link key={post.id} href={`/community/${encodeURIComponent(post.providerHostname)}`} className="rounded-2xl border border-[#e5e7ed] p-4 hover:border-[#c8c4ff]"><div className="flex items-center gap-2 text-xs font-semibold text-[#635bff]"><MessageSquarePlus className="h-3.5 w-3.5" /> {post.providerHostname}</div><h3 className="mt-2 font-semibold">{post.title}</h3><p className="mt-2 line-clamp-2 text-sm text-[#68707d]">{preview(post.body, "Open provider post")}</p></Link>)}</div>}
        {tab === "topics" && <div className="mt-5 grid gap-3 md:grid-cols-2">{topicGroups.map(group => <section key={group.slug} className="rounded-2xl border border-[#e5e7ed] p-4"><Link href={`/topics/${group.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#635bff]"><Hash className="h-4 w-4" /> {group.name}</Link><p className="mt-1 text-xs text-[#8a929f]">{group.items.length} contribution{group.items.length === 1 ? "" : "s"}</p><div className="mt-3 space-y-2">{group.items.slice(0, 2).map((item: any) => <Link key={`${item.kind}-${item.id}`} href={`/topics/${group.slug}/discussion/${item.kind}/${item.id}`} className="block rounded-xl bg-[#fafbfc] px-3 py-2.5 hover:bg-[#f3f2ff]"><div className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#8b7ade]">{item.kind === "thread" ? "RSS Thread" : "Topic post"}</div><div className="mt-1 line-clamp-1 text-sm font-semibold">{item.title || preview(item.body, "Topic post")}</div></Link>)}</div></section>)}</div>}
      </section>
    </main>
  </div>;
}
