import React, { useEffect, useState } from "react";
import { Loader2, Plus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type Community = { providerHostname: string };

export function CommunityPostComposer({ open, onOpenChange, communities, defaultProviderHostname, onPublished }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communities: Community[];
  defaultProviderHostname?: string;
  onPublished?: (providerHostname: string) => void;
}) {
  const utils = trpc.useUtils();
  const [providerHostname, setProviderHostname] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const createPost = trpc.providerCommunity.createPost.useMutation({
    onSuccess: async (_post, input) => {
      await Promise.all([utils.providerCommunity.list.invalidate(), utils.providerCommunity.get.invalidate({ providerHostname: input.providerHostname })]);
      toast.success(`Posted to ${input.providerHostname}`);
      setTitle("");
      setBody("");
      onOpenChange(false);
      onPublished?.(input.providerHostname);
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!open) return;
    const next = defaultProviderHostname && communities.some((community) => community.providerHostname === defaultProviderHostname) ? defaultProviderHostname : communities[0]?.providerHostname ?? "";
    setProviderHostname(next);
  }, [communities, defaultProviderHostname, open]);

  if (!open) return null;
  const canPost = Boolean(providerHostname && title.trim() && !createPost.isPending);

  return <div className="fixed inset-0 z-50 flex items-end bg-[#101116]/45 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" role="presentation">
    <section role="dialog" aria-modal="true" aria-label="Create community post" className="w-full max-w-xl overflow-hidden rounded-t-[2rem] bg-[#101116] text-white shadow-2xl sm:rounded-[2rem]">
      <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4 sm:px-6"><button type="button" onClick={() => onOpenChange(false)} aria-label="Close post composer" className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-white/80 transition hover:bg-white/10"><X className="h-5 w-5" /></button><div className="min-w-0 flex-1"><div className="text-base font-semibold">Create post</div><div className="mt-0.5 text-xs text-white/45">Share with one of your provider communities</div></div><button type="button" disabled={!canPost} onClick={() => createPost.mutate({ providerHostname, title, body: body.trim() || undefined })} className="rounded-full bg-[#a7a1ff] px-4 py-2 text-sm font-semibold text-[#15151c] transition hover:bg-[#c0bcff] disabled:cursor-not-allowed disabled:opacity-35">{createPost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}</button></header>
      <div className="space-y-5 px-5 py-6 sm:px-7 sm:py-7">
        <label className="block"><span className="sr-only">Community</span><select value={providerHostname} onChange={(event) => setProviderHostname(event.target.value)} className="w-full appearance-none rounded-2xl border border-white/20 bg-white/8 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-[#a7a1ff]" disabled={!communities.length}><option value="" className="bg-[#1a1b22]">Select a community</option>{communities.map((community) => <option key={community.providerHostname} value={community.providerHostname} className="bg-[#1a1b22]">{community.providerHostname}</option>)}</select></label>
        {!communities.length ? <div className="rounded-2xl border border-dashed border-white/15 px-4 py-5 text-sm leading-6 text-white/55">Add an RSS source first. Its provider hostname will become a community you can post in.</div> : <><label className="block"><span className="sr-only">Post title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} placeholder="Title" autoFocus className="w-full bg-transparent text-2xl font-semibold tracking-[-.035em] text-white outline-none placeholder:text-white/40" /></label><label className="block"><span className="sr-only">Post body</span><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={6000} rows={8} placeholder="Body text (optional)" className="w-full resize-none bg-transparent text-base leading-7 text-white/80 outline-none placeholder:text-white/40" /></label><div className="flex items-center justify-between border-t border-white/10 pt-4"><span className="text-xs text-white/40">{title.length}/300</span><div className="inline-flex items-center gap-2 text-xs font-semibold text-white/50"><Plus className="h-3.5 w-3.5" /> Provider community <Send className="h-3.5 w-3.5" /></div></div></>}
      </div>
    </section>
  </div>;
}
