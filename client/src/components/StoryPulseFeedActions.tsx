import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ExternalLink, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { findRelatedStories, type RelatedStory } from "@/lib/articleRelations";

type StoryContext = RelatedStory & { sourceLabel: string; storyThumbnailUrl?: string };

function storyPayload(article: HTMLElement): StoryContext | undefined {
  const storyAnchor = Array.from(article.querySelectorAll<HTMLAnchorElement>("a")).find((anchor) => Boolean(anchor.querySelector("h2")));
  const title = storyAnchor?.querySelector("h2")?.textContent?.trim();
  if (!storyAnchor?.href || !title) return undefined;
  const sourceLabel = article.querySelector<HTMLElement>(".mb-4 .truncate")?.textContent?.trim() || "RSS source";
  const description = article.querySelector("a p")?.textContent?.trim();
  const thumbnailUrl = article.querySelector<HTMLImageElement>("a img")?.src;
  return { sourceLabel, title, link: storyAnchor.href, description: description || undefined, storyThumbnailUrl: thumbnailUrl || undefined };
}

export function StoryPulseFeedActions() {
  const auth = useAuth();
  const [, setLocation] = useLocation();
  const [relatedStory, setRelatedStory] = useState<StoryContext | null>(null);
  const openPulse = trpc.storyPulse.open.useMutation({ onSuccess: (discussion) => setLocation(`/pulse/${discussion.id}`), onError: (error) => toast.error(error.message) });
  const library = trpc.feed.articles.useQuery(undefined, { enabled: auth.isAuthenticated });
  const dashboard = trpc.dashboard.useQuery(undefined, { enabled: auth.isAuthenticated });
  const related = useMemo(() => relatedStory ? findRelatedStories(relatedStory, (library.data ?? []).map((article) => ({ id: article.id, feedId: article.feedId, title: article.title, link: article.link, description: article.description }))) : [], [library.data, relatedStory]);
  const feedNames = useMemo(() => new Map((dashboard.data?.feeds ?? []).map((feed) => [feed.id, feed.customTitle || feed.title])), [dashboard.data?.feeds]);

  useEffect(() => {
    const enhance = () => {
      document.querySelectorAll<HTMLElement>("main article").forEach((article) => {
        if (article.dataset.storyPulseEnhanced === "true") return;
        const payload = storyPayload(article);
        const footer = Array.from(article.querySelectorAll<HTMLElement>("div")).find((element) => element.textContent?.trim() === "Open original story");
        if (!payload || !footer) return;
        article.dataset.storyPulseEnhanced = "true";
        footer.classList.add("gap-2");
        const threadButton = document.createElement("button");
        threadButton.type = "button";
        threadButton.className = "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#eeedff] px-3 py-1.5 text-xs font-semibold text-[#635bff] transition hover:bg-[#dedbff]";
        threadButton.setAttribute("aria-label", `Open Story Pulse for ${payload.title}`);
        threadButton.textContent = "Thread";
        threadButton.addEventListener("click", () => openPulse.mutate({ storyUrl: payload.link }));
        const relatedButton = document.createElement("button");
        relatedButton.type = "button";
        relatedButton.className = "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e1e4ea] bg-white px-3 py-1.5 text-xs font-semibold text-[#68707d] transition hover:border-[#635bff] hover:text-[#635bff]";
        relatedButton.setAttribute("aria-label", `Find related stories for ${payload.title}`);
        relatedButton.textContent = "Related";
        relatedButton.addEventListener("click", () => setRelatedStory(payload));
        footer.prepend(threadButton, relatedButton);
      });
    };
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [openPulse]);

  return relatedStory ? <div role="dialog" aria-modal="true" aria-label="Related stories" className="fixed inset-0 z-[60] grid place-items-center bg-[#14161a]/35 p-4 backdrop-blur-sm"><section className="w-full max-w-lg rounded-[1.5rem] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-[#635bff]"><Sparkles className="h-3.5 w-3.5" /> Related in your library</div><h2 className="mt-2 line-clamp-2 text-xl font-semibold tracking-[-.03em]">{relatedStory.title}</h2></div><button type="button" onClick={() => setRelatedStory(null)} aria-label="Close related stories" className="rounded-full p-2 text-[#8a929f] hover:bg-[#f3f4f7]"><X className="h-4 w-4" /></button></div><div className="mt-5 max-h-[55vh] space-y-2 overflow-y-auto">{library.isLoading ? <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[#635bff]" /></div> : related.length ? related.map((story) => <a key={story.link} href={story.link} target="_blank" rel="noreferrer" className="block rounded-xl border border-[#e6e8ed] p-4 transition hover:border-[#c8c4ff] hover:bg-[#fbfbff]"><div className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#8b7ade]">{story.feedId ? feedNames.get(story.feedId) || "RSS source" : "RSS source"}</div><div className="mt-1 text-sm font-semibold leading-5 text-[#303642]">{story.title}</div><div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#635bff]">Open story <ExternalLink className="h-3.5 w-3.5" /></div></a>) : <div className="rounded-xl border border-dashed border-[#d9dde5] bg-[#fafbfc] px-5 py-10 text-center text-sm leading-6 text-[#7d8794]">No closely related stories are saved in your private library yet.</div>}</div></section></div> : null;
}
