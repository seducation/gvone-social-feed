import { ArrowUpRight, CalendarDays, Rss } from "lucide-react";
import React from "react";

type Story = { title: string; link: string; description: string | null; thumbnailUrl: string | null; videoUrl: string | null; videoMimeType: string | null; publishedAt: Date | string | null };

const asPlainText = (value: string | null) => value?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";

export function TopicRssStoryCard({ story }: { story: Story }) {
  const description = asPlainText(story.description);
  return <article className="mt-4 overflow-hidden rounded-2xl border border-[#dedbff] bg-[#faf9ff]"><div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_168px]"><div className="p-4"><div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-[#766bd0]"><Rss className="h-3.5 w-3.5" /> Shared RSS story</div><a href={story.link} target="_blank" rel="noreferrer" className="mt-2 block text-lg font-semibold leading-snug tracking-[-.02em] text-[#20212a] hover:text-[#635bff]">{story.title}</a>{description && <p className="mt-2 text-sm leading-6 text-[#68707d]">{description}</p>}<div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#766bd0]">{story.publishedAt && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {new Date(story.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>}<a href={story.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[#4c42c7]">Open story <ArrowUpRight className="h-3.5 w-3.5" /></a></div></div>{story.thumbnailUrl && <a href={story.link} target="_blank" rel="noreferrer" className="block min-h-[150px] bg-[#edeafd]"><img src={story.thumbnailUrl} alt="" className="h-full w-full object-cover" /></a>}</div>{story.videoUrl && <video controls preload="metadata" poster={story.thumbnailUrl ?? undefined} className="block w-full border-t border-[#e3e0fb] bg-black" src={story.videoUrl} />}</article>;
}
