import React, { useEffect, useState } from "react";
import { ArrowLeft, Globe2, Loader2, MessageSquarePlus, Plus, Radio } from "lucide-react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { CommunityPostComposer } from "@/components/CommunityPostComposer";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

function relativeTime(value: Date | string) {
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ProviderCommunity() {
  const auth = useAuth();
  const [, params] = useRoute("/community/:providerHostname");
  const providerHostname = (params?.providerHostname ?? "").toLowerCase();
  const [showComposer, setShowComposer] = useState(false);
  const communities = trpc.providerCommunity.list.useQuery(undefined, { enabled: auth.isAuthenticated });
  const postableCommunities = trpc.providerCommunity.mine.useQuery(undefined, { enabled: auth.isAuthenticated });
  const community = trpc.providerCommunity.get.useQuery({ providerHostname }, { enabled: auth.isAuthenticated && Boolean(providerHostname) });
  useEffect(() => { if (community.error) toast.error(community.error.message); }, [community.error]);

  if (auth.loading || communities.isLoading || community.isLoading) return <div className="grid min-h-screen place-items-center bg-[#f7f8fa]"><Loader2 className="h-6 w-6 animate-spin text-[#635bff]" /></div>;
  if (!auth.isAuthenticated) return <main className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6 text-center"><div><Radio className="mx-auto h-7 w-7 text-[#635bff]" /><h1 className="mt-4 text-2xl font-semibold">Sign in to open communities</h1><button type="button" onClick={startLogin} className="mt-5 rounded-full bg-[#635bff] px-5 py-3 text-sm font-semibold text-white">Sign in</button></div></main>;
  if (!community.data) return <main className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6 text-center"><div><Globe2 className="mx-auto h-7 w-7 text-[#635bff]" /><h1 className="mt-4 text-2xl font-semibold">Community unavailable</h1><p className="mt-2 text-sm text-[#7d8794]">Add an RSS source from this provider before opening its community.</p><Link href="/" className="mt-5 inline-block text-sm font-semibold text-[#635bff]">Return to reader</Link></div></main>;

  return <div className="min-h-screen bg-[#f7f8fa] text-[#14161a]">
    <header className="flex h-[76px] items-center border-b border-[#e6e8ed] bg-[#f7f8fa]/90 px-5 backdrop-blur-xl sm:px-8"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#68707d] hover:text-[#635bff]"><ArrowLeft className="h-4 w-4" /> Reader</Link><div className="ml-5 flex min-w-0 items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#17171d] text-white"><Globe2 className="h-4 w-4" /></span><div className="min-w-0"><div className="truncate text-lg font-semibold tracking-[-.03em]">{community.data.community.providerHostname}</div><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#8a929f]">Provider community</div></div></div><button type="button" onClick={() => setShowComposer(true)} className="ml-auto inline-flex items-center gap-2 rounded-full bg-[#635bff] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_7px_18px_rgba(99,91,255,.2)]"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Create post</span></button></header>
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-[-.045em]">{community.data.community.providerHostname}</h1><p className="mt-2 text-sm text-[#7d8794]">Newest member posts first.</p></div><div className="flex items-center gap-2"><Link href="/communities" className="rounded-full border border-[#e1e4ea] bg-white px-3.5 py-2 text-xs font-semibold text-[#68707d] hover:border-[#635bff] hover:text-[#635bff]">All posts</Link><button type="button" onClick={() => setShowComposer(true)} aria-label="Create community post" className="grid h-10 w-10 place-items-center rounded-xl border border-[#e1e4ea] bg-white text-[#635bff] hover:border-[#635bff]"><MessageSquarePlus className="h-4 w-4" /></button></div></div>
      <div className="space-y-4">{community.data.posts.length ? community.data.posts.map((post) => <article key={post.id} className="rounded-[1.35rem] border border-[#e3e6ec] bg-white p-5 shadow-[0_8px_25px_rgba(24,31,45,.03)]"><div className="flex items-center gap-2 text-xs"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f0eaff] font-bold text-[#704ee5]">{(post.displayName?.charAt(0) || "G").toUpperCase()}</span><span className="font-semibold text-[#4e5765]">{post.displayName || "gvone member"}</span><span className="font-mono font-semibold text-[#8b7ade]">@{post.username || "member"}</span><span className="text-[#a0a7b2]">· {relativeTime(post.createdAt)}</span></div><h3 className="mt-4 text-xl font-semibold tracking-[-.025em]">{post.title}</h3>{post.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#68707d]">{post.body}</p>}</article>) : <div className="rounded-[1.5rem] border border-dashed border-[#d9dde5] bg-white/55 px-6 py-14 text-center"><MessageSquarePlus className="mx-auto h-6 w-6 text-[#a9a2dc]" /><h2 className="mt-4 text-lg font-semibold">Start this community</h2><p className="mt-2 text-sm text-[#7d8794]">Share the first post about {community.data.community.providerHostname}.</p><button type="button" onClick={() => setShowComposer(true)} className="mt-5 rounded-full bg-[#17171d] px-4 py-2.5 text-sm font-semibold text-white">Create post</button></div>}</div>
    </main>
    <CommunityPostComposer open={showComposer} onOpenChange={setShowComposer} communities={postableCommunities.data ?? []} defaultProviderHostname={community.data.community.providerHostname} />
  </div>;
}
