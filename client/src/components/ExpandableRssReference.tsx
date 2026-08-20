import { ChevronDown, ExternalLink, Rss } from "lucide-react";
import React, { useId, useState } from "react";
import { publicStoryProviderLabel } from "@/lib/storyProvider";

export function ExpandableRssReference({ storyUrl }: { storyUrl: string }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const provider = publicStoryProviderLabel(storyUrl);
  return <div className="mt-3"><button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded((value) => !value)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#e1e4ea] bg-[#fafbfc] px-3 py-2.5 text-left text-xs font-semibold text-[#635bff] transition hover:border-[#c8c4ff] hover:bg-[#f8f7ff]"><span className="flex min-w-0 items-center gap-1.5"><Rss className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">RSS feed · {provider}</span></span><span className="flex shrink-0 items-center gap-1 text-[#7b72d7]">{expanded ? "Collapse" : "Expand"}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} /></span></button>{expanded && <div id={panelId} className="mt-2 rounded-xl border border-[#e2defe] bg-[#f8f7ff] p-3"><div className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#8b7ade]">RSS story reference</div><p className="mt-2 break-all text-xs leading-5 text-[#68707d]">{storyUrl}</p><a href={storyUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#635bff] shadow-sm ring-1 ring-[#e1dfff] hover:bg-[#f4f3ff]">Open original story <ExternalLink className="h-3.5 w-3.5" /></a></div>}</div>;
}
