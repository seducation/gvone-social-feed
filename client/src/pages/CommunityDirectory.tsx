import React from "react";
import { ArrowLeft, Globe2, Loader2, MessageSquarePlus, Radio } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

function relativeTime(value: Date | string) {
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function CommunityDirectory() {
  const auth = useAuth();
  const posts = trpc.providerCommunity.allPosts.useQuery(undefined, { enabled: auth.isAuthenticated });

  if (auth.loading || posts.isLoading) return <div className="grid min-h-screen place-items-center bg-[#f7f8fa]"><Loader2 className="h-6 w-6 animate-spin text-[#635bff]" /></div>;
  if (!auth.isAuthenticated) return <main className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6 text-center"><div><Radio className="mx-auto h-7 w-7 text-[#635bff]" /><h1 className="mt-4 text-2xl font-semibold">Sign in to visit communities</h1><button type="button" onClick={startLogin} className="mt-5 rounded-full bg-[#635bff] px-5 py-3 text-sm font-semibold text-white">Sign in</button></div></main>;

  return <div className="min-h-screen bg-[#f7f8fa] text-[#14161a]"><header className="flex h-[76px] items-center border-b border-[#e6e8ed] bg-[#f7f8fa]/90 px-5 backdrop-blur-xl sm:px-8"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#68707d] hover:text-[#635bff]"><ArrowLeft className="h-4 w-4" /> Reader</Link><div className="ml-5 flex min-w-0 items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#17171d] text-white"><Globe2 className="h-4 w-4" /></span><div><div className="text-lg font-semibold tracking-[-.03em]">Visit community</div><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#8a929f]">All provider posts</div></div></div></header><main className="mx-auto max-w-3xl px-5 py-8 sm:px-8"><div className="mb-6"><h1 className="text-3xl font-semibold tracking-[-.045em]">All community posts</h1><p className="mt-2 text-sm text-[#7d8794]">Newest posts from every gvone provider community.</p></div><div className="space-y-4">{posts.data?.length ? posts.data.map((post) => <article key={post.id} className="rounded-[1.35rem] border border-[#e3e6ec] bg-white p-5 shadow-[0_8px_25px_rgba(24,31,45,.03)]"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f0eaff] font-bold text-[#704ee5]">{(post.displayName?.charAt(0) || "G").toUpperCase()}</span>{post.username ? <Link href={`/u/@${post.username}`} className="font-semibold text-[#4e5765] hover:text-[#635bff]">{post.displayName || "gvone member"}</Link> : <span className="font-semibold text-[#4e5765]">{post.displayName || "gvone member"}</span>}{post.username && <Link href={`/u/@${post.username}`} className="font-mono font-semibold text-[#8b7ade] hover:text-[#635bff]">@{post.username}</Link>}<span className="text-[#a0a7b2]">· {relativeTime(post.createdAt)}</span><Link href={`/community/${encodeURIComponent(post.providerHostname)}`} className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#f3f2ff] px-2.5 py-1 font-semibold text-[#635bff] hover:bg-[#eae8ff]"><Globe2 className="h-3 w-3" /> {post.providerHostname}</Link></div><h2 className="mt-4 text-xl font-semibold tracking-[-.025em]">{post.title}</h2>{post.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#68707d]">{post.body}</p>}</article>) : <div className="rounded-[1.5rem] border border-dashed border-[#d9dde5] bg-white/55 px-6 py-14 text-center"><MessageSquarePlus className="mx-auto h-6 w-6 text-[#a9a2dc]" /><h2 className="mt-4 text-lg font-semibold">No community posts yet</h2><p className="mt-2 text-sm text-[#7d8794]">Posts from every provider community will appear here.</p></div>}</div></main></div>;
}
