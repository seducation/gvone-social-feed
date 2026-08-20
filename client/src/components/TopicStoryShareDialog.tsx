import { Link } from "wouter";
import React, { useEffect, useState } from "react";
import { Hash, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

type TopicStoryShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storyUrl: string | null;
  storyTitle: string | null;
};

export function TopicStoryShareDialog({ open, onOpenChange, storyUrl, storyTitle }: TopicStoryShareDialogProps) {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("Discuss this RSS story");
  const [body, setBody] = useState("");
  const topics = trpc.topicCommunity.list.useQuery(undefined, { enabled: open && auth.isAuthenticated });
  const joinedTopics = (topics.data ?? []).filter((topic) => topic.isMember);

  useEffect(() => {
    if (!open) return;
    setTitle("Discuss this RSS story");
    setBody("");
    setSlug("");
  }, [open, storyUrl]);

  useEffect(() => {
    if (slug || !joinedTopics.length) return;
    setSlug(joinedTopics[0].slug);
  }, [joinedTopics, slug]);

  const share = trpc.topicCommunity.createThread.useMutation({
    onSuccess: async (thread) => {
      toast.success("RSS story shared as a Topic Thread");
      await Promise.all([utils.topicCommunity.list.invalidate(), utils.topicCommunity.get.invalidate({ slug: thread ? slug : "" })]);
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  if (!open || !storyUrl) return null;

  return <div role="dialog" aria-modal="true" aria-label="Share RSS story to a topic" className="fixed inset-0 z-50 grid place-items-center bg-[#14161a]/35 p-4 backdrop-blur-sm">
    <div className="w-full max-w-lg rounded-[1.5rem] bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-[#8b7ade]"><Hash className="h-3.5 w-3.5" /> Topic Thread</div><h2 className="mt-2 text-xl font-semibold tracking-[-.03em]">Share this RSS story</h2><p className="mt-1 text-sm leading-6 text-[#7d8794]">The topic keeps only the story URL as shared context. Write your own discussion prompt below.</p></div>
        <button type="button" onClick={() => onOpenChange(false)} aria-label="Close topic share dialog" className="rounded-full p-2 text-[#8a929f] hover:bg-[#f5f6f8]"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-5 rounded-xl border border-[#e5e2ff] bg-[#faf9ff] px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#8b7ade]">RSS story reference</div><p className="mt-1 line-clamp-2 text-sm font-semibold text-[#535c6a]">{storyTitle || "Saved RSS story"}</p></div>
      {topics.isLoading ? <div className="grid h-36 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#635bff]" /></div> : joinedTopics.length ? <>
        <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-[#8a929f]">Topic community
          <select value={slug} onChange={(event) => setSlug(event.target.value)} className="mt-2 w-full rounded-xl border border-[#e1e4ea] bg-white px-3 py-3 text-sm font-semibold text-[#4e5765] outline-none focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10">
            {joinedTopics.map((topic) => <option key={topic.id} value={topic.slug}>{topic.name} · {topic.memberCount} member{topic.memberCount === 1 ? "" : "s"}</option>)}
          </select>
        </label>
        <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-[#8a929f]">Thread title
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} className="mt-2 w-full rounded-xl border border-[#e1e4ea] px-3 py-3 text-sm outline-none focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10" />
        </label>
        <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-[#8a929f]">Your angle <span className="font-normal normal-case">(optional)</span>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={6000} rows={4} placeholder="What should the topic discuss about this story?" className="mt-2 w-full resize-none rounded-xl border border-[#e1e4ea] px-3 py-3 text-sm leading-6 outline-none focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10" />
        </label>
        <button type="button" disabled={!slug || !title.trim() || share.isPending} onClick={() => share.mutate({ slug, title, body: body || undefined, sourceStoryUrl: storyUrl })} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#635bff] py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{share.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Share as Thread</button>
      </> : <div className="mt-6 rounded-2xl border border-dashed border-[#d8dce4] bg-[#fafbfc] p-6 text-center"><Hash className="mx-auto h-6 w-6 text-[#8b7ade]" /><h3 className="mt-3 text-base font-semibold">Join a topic first</h3><p className="mt-2 text-sm leading-6 text-[#7d8794]">Browse user-created topics, then join one before sharing this story into its discussion.</p><Link href="/topics" onClick={() => onOpenChange(false)} className="mt-4 inline-flex rounded-full bg-[#17171d] px-4 py-2.5 text-sm font-semibold text-white">Discover Topics</Link></div>}
    </div>
  </div>;
}
