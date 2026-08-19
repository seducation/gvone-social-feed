import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { feedErrorMessage } from "@/lib/feedError";
import { shouldStartPageLoadRefresh } from "@/lib/dashboardRefresh";
import { pauseEmbeddedShort, playEmbeddedShort, readEmbeddedShortMuteState, requestEmbeddedShortMuteState, setEmbeddedShortMuted, syncShortPlayback } from "@/lib/shortsPlayback";
import { applySourceTabOrder, buildSourceChannels, filterArticlesForSourceChannel, moveEditableSourceTab, type SourceChannelKey, type SourceChannelKind } from "@/lib/sourceCategories";
import { SourceManager } from "@/components/SourceManager";
import { GroupBuilder } from "@/components/GroupBuilder";
import { startLogin } from "@/const";
import { toast } from "sonner";
import { ArrowUpRight, Bookmark, Check, ChevronDown, Compass, Globe2, Hash, Layers3, Loader2, LogOut, Megaphone, MoreHorizontal, Plus, Radio, RefreshCw, Rss, Search, Settings2, SlidersHorizontal, Sparkles, Trash2, Video, Volume2, VolumeX, X, Youtube } from "lucide-react";

function formatDate(value: Date | string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function favicon(url: string | null) {
  return url || "https://www.google.com/s2/favicons?domain=rss.app&sz=64";
}

function ChannelIcon({ kind, className }: { kind: SourceChannelKind; className?: string }) {
  if (kind === "youtube") return <Youtube className={className} />;
  if (kind === "reddit") return <Radio className={className} />;
  if (kind === "domain") return <Globe2 className={className} />;
  return <Compass className={className} />;
}

function channelTint(kind: SourceChannelKind) {
  if (kind === "youtube") return "bg-[#ffefef] text-[#e84b4b]";
  if (kind === "reddit") return "bg-[#fff0e8] text-[#ee7240]";
  if (kind === "domain") return "bg-[#eaf5ff] text-[#377ab5]";
  return "bg-[#eeedff] text-[#635bff]";
}

function FeedVideo({ url, mimeType, poster, className, videoRef, iframeRef, muted = false, autoPlay = false, preload = "metadata" }: { url: string | null; mimeType?: string | null; poster?: string | null; className: string; videoRef?: (node: HTMLVideoElement | null) => void; iframeRef?: (node: HTMLIFrameElement | null) => void; muted?: boolean; autoPlay?: boolean; preload?: "none" | "metadata" | "auto" }) {
  if (!url) return null;
  if (mimeType === "text/html") {
    let src = url;
    try {
      const embedded = new URL(url);
      if (/(^|\.)youtube\.com$/i.test(embedded.hostname)) {
        embedded.searchParams.set("enablejsapi", "1");
        embedded.searchParams.set("playsinline", "1");
        embedded.searchParams.set("rel", "0");
        embedded.searchParams.set("mute", muted ? "1" : "0");
        embedded.searchParams.set("autoplay", autoPlay ? "1" : "0");
        src = embedded.toString();
      }
    } catch { /* preserve a non-standard embed URL */ }
    return <iframe ref={iframeRef} title="Embedded feed video" src={src} className={className} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen />;
  }
  return <video ref={videoRef} controls playsInline muted={muted} preload={preload} className={className} src={url} poster={poster ?? undefined}><track kind="captions" /></video>;
}

export default function Home() {
  const auth = useAuth();
  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<SourceChannelKey>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showSourceManager, setShowSourceManager] = useState(false);
  const [managedFeedId, setManagedFeedId] = useState<number | null>(null);
  const [showShorts, setShowShorts] = useState(false);
  const [activeShortId, setActiveShortId] = useState<number | null>(null);
  const [loadedShortIds, setLoadedShortIds] = useState<number[]>([]);
  const [shortsSoundEnabled, setShortsSoundEnabled] = useState(() => localStorage.getItem("signalflow-shorts-sound") === "on");
  const [isSourceBarCompact, setIsSourceBarCompact] = useState(false);
  const [sourceTabOrderOverride, setSourceTabOrderOverride] = useState<string[] | null>(null);
  const [draggedSourceTabKey, setDraggedSourceTabKey] = useState<string | null>(null);
  const [showGroups, setShowGroups] = useState(false);
  const [showGroupBuilder, setShowGroupBuilder] = useState(false);
  const [showAssign, setShowAssign] = useState<number | null>(null);
  const [url, setUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedGroupFeedIds, setSelectedGroupFeedIds] = useState<number[]>([]);
  const [didRefreshOnLoad, setDidRefreshOnLoad] = useState(false);
  const shortViewportRef = useRef<HTMLDivElement | null>(null);
  const shortCardRefs = useRef(new Map<number, HTMLElement>());
  const shortVideoRefs = useRef(new Map<number, HTMLVideoElement>());
  const shortEmbedRefs = useRef(new Map<number, HTMLIFrameElement>());
  const utils = trpc.useUtils();
  const dashboard = trpc.dashboard.useQuery(undefined, { enabled: auth.isAuthenticated, refetchInterval: 60_000 });
  const feeds = dashboard.data?.feeds ?? [];
  const groups = dashboard.data?.groups ?? [];
  const groupArticles = trpc.group.articles.useQuery({ id: activeGroup ?? 0 }, { enabled: Boolean(activeGroup) });
  const allArticles = trpc.feed.articles.useQuery(undefined, { enabled: auth.isAuthenticated, refetchInterval: 60_000 });
  const managedFeeds = trpc.feed.list.useQuery(undefined, { enabled: auth.isAuthenticated && showSourceManager });
  const managedFeedArticles = trpc.feed.sourceArticles.useQuery({ id: managedFeedId ?? 0 }, { enabled: showSourceManager && Boolean(managedFeedId) });
  const sourceTabOrderQuery = trpc.sourceTabs.order.useQuery(undefined, { enabled: auth.isAuthenticated });

  const addFeed = trpc.feed.add.useMutation({
    onSuccess: () => {
      toast.success("Feed added to your library");
      setShowAdd(false);
      setUrl("");
      setCustomTitle("");
      setActiveCategory("all");
      utils.dashboard.invalidate();
      utils.feed.articles.invalidate();
    },
    onError: (error) => toast.error(feedErrorMessage(error)),
  });
  const createGroup = trpc.group.create.useMutation({
    onSuccess: () => {
      toast.success("Collection created");
      setGroupName("");
      setShowGroups(false);
      utils.dashboard.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const createGroupWithFeeds = trpc.group.createWithFeeds.useMutation({
    onSuccess: async (group) => {
      toast.success("Category group created");
      setGroupName("");
      setSelectedGroupFeedIds([]);
      setShowGroupBuilder(false);
      setActiveGroup(group.id);
      setActiveCategory("all");
      await Promise.all([utils.dashboard.invalidate(), utils.group.articles.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });
  const refreshGroup = trpc.group.refresh.useMutation({
    onSuccess: (data) => {
      toast.success(`Refreshed ${data.refreshed} feeds`);
      groupArticles.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const refreshFeed = trpc.feed.refresh.useMutation({
    onSuccess: () => {
      toast.success("Feed refreshed");
      utils.dashboard.invalidate();
      utils.feed.articles.invalidate();
      if (activeGroup) groupArticles.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const refreshAllFeeds = trpc.feed.refreshAll.useMutation({
    onSuccess: async (data) => {
      await Promise.all([utils.dashboard.invalidate(), utils.feed.articles.invalidate(), utils.group.articles.invalidate()]);
      if (data.attempted) {
        if (data.failed) toast.error(`Updated ${data.refreshed} of ${data.attempted} sources. ${data.failed} need attention.`);
        else toast.success(`Updated ${data.refreshed} of ${data.attempted} sources`);
      }
    },
    onError: (error) => toast.error(feedErrorMessage(error)),
  });
  const removeFeed = trpc.feed.remove.useMutation({
    onSuccess: (_data, variables) => {
      toast.success("Feed removed");
      if (managedFeedId === variables.id) setManagedFeedId(null);
      utils.dashboard.invalidate();
      utils.feed.articles.invalidate();
      managedFeeds.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const setFeedEnabled = trpc.feed.setEnabled.useMutation({
    onSuccess: async (data) => {
      await Promise.all([utils.dashboard.invalidate(), utils.feed.articles.invalidate(), utils.group.articles.invalidate(), managedFeeds.refetch()]);
      toast.success(data.isEnabled ? "Source enabled" : "Source disabled");
    },
    onError: (error) => toast.error(error.message),
  });
  const renameGroup = trpc.group.rename.useMutation({ onSuccess: () => { toast.success("Collection renamed"); utils.dashboard.invalidate(); }, onError: (error) => toast.error(error.message) });
  const deleteGroup = trpc.group.delete.useMutation({ onSuccess: () => { toast.success("Collection deleted"); setActiveGroup(null); utils.dashboard.invalidate(); }, onError: (error) => toast.error(error.message) });
  const assignment = trpc.assignment.list.useQuery({ groupId: showAssign ?? 0 }, { enabled: Boolean(showAssign) });
  const setAssignment = trpc.assignment.set.useMutation({ onSuccess: () => { assignment.refetch(); toast.success("Collection updated"); }, onError: (error) => toast.error(error.message) });
  const saveSourceTabOrder = trpc.sourceTabs.setOrder.useMutation({
    onSuccess: () => { sourceTabOrderQuery.refetch(); },
    onError: (error) => { setSourceTabOrderOverride(null); toast.error(error.message); },
  });

  const baseSourceChannels = useMemo(() => buildSourceChannels(feeds), [feeds]);
  const sourceTabOrder = sourceTabOrderOverride ?? sourceTabOrderQuery.data ?? [];
  const sourceChannels = useMemo(() => applySourceTabOrder(baseSourceChannels, sourceTabOrder), [baseSourceChannels, sourceTabOrder]);
  const activeChannel = sourceChannels.find((channel) => channel.key === activeCategory) ?? sourceChannels[0];
  const baseArticles = activeGroup ? groupArticles.data ?? [] : allArticles.data ?? [];
  const videoArticles = useMemo(() => (allArticles.data ?? []).filter((article) => Boolean(article.videoUrl)), [allArticles.data]);
  const visibleArticles = useMemo(() => activeGroup ? baseArticles : filterArticlesForSourceChannel(baseArticles, activeChannel), [activeGroup, activeChannel, baseArticles]);
  const sourceCount = useMemo(() => new Set(visibleArticles.map((article) => article.feedId)).size, [visibleArticles]);
  const categoryFeeds = useMemo(() => feeds.filter((feed) => activeChannel?.feedIds.includes(feed.id)), [activeChannel, feeds]);
  const activeLabel = activeGroup ? groups.find((group) => group.id === activeGroup)?.name ?? "Collection" : activeChannel?.label ?? "All signals";
  const activeDescription = activeGroup ? "A focused collection from your private signal." : activeChannel?.description ?? "Every source in your private library.";

  useEffect(() => {
    if (!shouldStartPageLoadRefresh({ isAuthenticated: auth.isAuthenticated, isDashboardLoading: dashboard.isLoading, hasRefreshedOnLoad: didRefreshOnLoad, feedCount: feeds.length })) return;
    setDidRefreshOnLoad(true);
    refreshAllFeeds.mutate();
  }, [auth.isAuthenticated, dashboard.isLoading, didRefreshOnLoad, feeds.length, refreshAllFeeds]);

  useEffect(() => {
    const syncSourceBarDensity = () => setIsSourceBarCompact(window.scrollY > 88);
    syncSourceBarDensity();
    window.addEventListener("scroll", syncSourceBarDensity, { passive: true });
    return () => window.removeEventListener("scroll", syncSourceBarDensity);
  }, []);

  useEffect(() => {
    localStorage.setItem("signalflow-shorts-sound", shortsSoundEnabled ? "on" : "off");
  }, [shortsSoundEnabled]);

  useEffect(() => {
    if (!showShorts) return;
    const rememberNativeShortSound = (event: Event) => {
      const player = event.target;
      if (player instanceof HTMLVideoElement && player.closest("[data-short-id]")) {
        setShortsSoundEnabled(!player.muted && player.volume > 0);
      }
    };
    document.addEventListener("volumechange", rememberNativeShortSound, true);
    return () => document.removeEventListener("volumechange", rememberNativeShortSound, true);
  }, [showShorts]);

  useEffect(() => {
    const activeEmbed = activeShortId ? shortEmbedRefs.current.get(activeShortId) : undefined;
    if (!showShorts || !activeEmbed) return;
    const rememberYouTubeShortSound = (event: MessageEvent) => {
      if (!/^https:\/\/www\.youtube(?:-nocookie)?\.com$/i.test(event.origin)) return;
      const muted = readEmbeddedShortMuteState(event.data);
      if (muted !== null) setShortsSoundEnabled(!muted);
    };
    window.addEventListener("message", rememberYouTubeShortSound);
    requestEmbeddedShortMuteState(activeEmbed);
    return () => window.removeEventListener("message", rememberYouTubeShortSound);
  }, [activeShortId, showShorts]);

  useEffect(() => {
    if (!showShorts) return;
    const reapplySoundAfterEmbedLoad = (event: Event) => {
      const frame = event.target;
      if (!(frame instanceof HTMLIFrameElement)) return;
      const activeEmbed = activeShortId ? shortEmbedRefs.current.get(activeShortId) : undefined;
      if (frame !== activeEmbed) return;
      setEmbeddedShortMuted(frame, !shortsSoundEnabled);
      requestEmbeddedShortMuteState(frame);
      playEmbeddedShort(frame);
    };
    document.addEventListener("load", reapplySoundAfterEmbedLoad, true);
    return () => document.removeEventListener("load", reapplySoundAfterEmbedLoad, true);
  }, [activeShortId, showShorts, shortsSoundEnabled]);

  useEffect(() => {
    if (!showShorts || !videoArticles.length) {
      setActiveShortId(null);
      setLoadedShortIds([]);
      return;
    }
    setActiveShortId(videoArticles[0]?.id ?? null);
    setLoadedShortIds(videoArticles.slice(0, 2).map((article) => article.id));
    const viewport = shortViewportRef.current;
    if (!viewport || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const id = Number((visible?.target as HTMLElement | undefined)?.dataset.shortId);
      if (Number.isFinite(id) && id > 0) setActiveShortId(id);
    }, { root: viewport, threshold: [0.35, 0.6] });
    shortCardRefs.current.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [showShorts, videoArticles]);

  useEffect(() => {
    if (!activeShortId) return;
    const activeIndex = videoArticles.findIndex((article) => article.id === activeShortId);
    if (activeIndex < 0) return;
    const nearbyIds = videoArticles.slice(Math.max(0, activeIndex - 1), activeIndex + 2).map((article) => article.id);
    setLoadedShortIds((current) => Array.from(new Set([...current, ...nearbyIds])));
  }, [activeShortId, videoArticles]);

  useEffect(() => {
    if (!showShorts) {
      syncShortPlayback(shortVideoRefs.current, null);
      shortEmbedRefs.current.forEach((iframe) => pauseEmbeddedShort(iframe));
      return;
    }
    syncShortPlayback(shortVideoRefs.current, activeShortId, { soundEnabled: shortsSoundEnabled });
    shortEmbedRefs.current.forEach((iframe, id) => {
      if (id !== activeShortId) {
        pauseEmbeddedShort(iframe);
        return;
      }
      setEmbeddedShortMuted(iframe, !shortsSoundEnabled);
      playEmbeddedShort(iframe);
    });
  }, [activeShortId, showShorts, shortsSoundEnabled]);

  const selectCategory = (category: SourceChannelKey) => {
    setActiveGroup(null);
    setActiveCategory(category);
  };

  const persistSourceTabOrder = (keys: string[]) => {
    setSourceTabOrderOverride(keys);
    saveSourceTabOrder.mutate({ keys });
  };

  const reorderEditableSourceTab = (movingKey: string, targetKey: string) => {
    const editableKeys = sourceChannels.filter((channel) => channel.kind !== "all").map((channel) => channel.key);
    const nextOrder = moveEditableSourceTab(editableKeys, movingKey, targetKey);
    if (nextOrder.join("|") !== editableKeys.join("|")) persistSourceTabOrder(nextOrder);
  };

  const handleSourceTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, key: SourceChannelKey) => {
    if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const editableKeys = sourceChannels.filter((channel) => channel.kind !== "all").map((channel) => channel.key);
    const index = editableKeys.indexOf(key);
    const targetKey = editableKeys[index + (event.key === "ArrowLeft" ? -1 : 1)];
    if (!targetKey) return;
    event.preventDefault();
    reorderEditableSourceTab(key, targetKey);
  };

  const toggleShortsSound = () => {
    const nextSoundEnabled = !shortsSoundEnabled;
    setShortsSoundEnabled(nextSoundEnabled);
    const activeVideo = activeShortId ? shortVideoRefs.current.get(activeShortId) : undefined;
    if (activeVideo) {
      activeVideo.muted = !nextSoundEnabled;
      if (nextSoundEnabled) Promise.resolve(activeVideo.play()).catch(() => undefined);
    }
    const activeEmbed = activeShortId ? shortEmbedRefs.current.get(activeShortId) : undefined;
    setEmbeddedShortMuted(activeEmbed, !nextSoundEnabled);
    if (nextSoundEnabled) playEmbeddedShort(activeEmbed);
  };

  if (auth.loading || dashboard.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#f7f8fa]"><Loader2 className="h-6 w-6 animate-spin text-[#635bff]" /></div>;
  }

  if (!auth.isAuthenticated) {
    return <div className="min-h-screen overflow-hidden bg-[#f7f8fa] text-[#14161a]"><div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(99,91,255,.18),transparent_30%),radial-gradient(circle_at_15%_85%,rgba(36,193,176,.14),transparent_32%)]" /><header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-7"><div className="flex items-center gap-3 font-semibold"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#14161a] text-white"><Rss className="h-5 w-5" /></span><span>signal<span className="text-[#635bff]">flow</span></span></div><button onClick={() => startLogin()} className="rounded-full bg-[#14161a] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5">Sign in</button></header><main className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_.95fr]"><div><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dfe2ea] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#635bff]"><Sparkles className="h-3.5 w-3.5" /> Your signal, beautifully organized</div><h1 className="max-w-2xl text-5xl font-semibold leading-[1.05] tracking-[-.06em] sm:text-7xl">The calm way to keep up with the internet.</h1><p className="mt-7 max-w-xl text-lg leading-8 text-[#68707d]">Bring your favorite RSS feeds together, shape them into focused collections, and read every story in one fluid social-style stream.</p><button onClick={() => startLogin()} className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#635bff] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_15px_35px_rgba(99,91,255,.25)] transition hover:-translate-y-0.5">Build your signal <ArrowUpRight className="h-4 w-4" /></button></div><div className="relative rounded-[2rem] border border-white bg-white/75 p-4 shadow-[0_30px_80px_rgba(40,44,60,.12)] backdrop-blur"><div className="rounded-[1.5rem] bg-[#f4f5f8] p-5"><div className="mb-7 flex items-center justify-between"><div><div className="text-xs font-medium text-[#8c94a3]">YOUR PERSONAL COMMUNITY</div><div className="mt-1 text-xl font-semibold">Your morning signal</div></div><div className="grid h-9 w-9 place-items-center rounded-xl bg-white"><Search className="h-4 w-4 text-[#7e8794]" /></div></div>{["Focused channels", "Source spaces", "A calmer feed"].map((title, index) => <div key={title} className="mb-3 rounded-2xl bg-white p-4"><div className="flex items-center gap-3"><div className={`h-8 w-8 rounded-xl ${index === 0 ? "bg-[#635bff]" : index === 1 ? "bg-[#24c1b0]" : "bg-[#ffb86b]"}`} /><div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-wider text-[#9098a5]">Signalflow community</div><div className="mt-1 truncate text-sm font-semibold">{title}</div></div><ArrowUpRight className="ml-auto h-4 w-4 text-[#b3bac5]" /></div></div>)}</div></div></main></div>;
  }

  return <div className="min-h-screen bg-[#f7f8fa] text-[#14161a]">
    <header className="sticky top-0 z-30 flex h-[76px] items-center border-b border-[#e6e8ed] bg-[#f7f8fa]/90 px-5 backdrop-blur-xl lg:px-8">
      <div className="flex items-center gap-3 lg:w-[270px]"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#14161a] text-white"><Rss className="h-4 w-4" /></div><span className="text-lg font-semibold tracking-[-.03em]">signal<span className="text-[#635bff]">flow</span></span></div>
      <div className="hidden max-w-xl flex-1 items-center gap-3 rounded-full border border-[#e1e4ea] bg-white px-4 py-2.5 text-sm text-[#9aa1ad] md:flex"><Search className="h-4 w-4" /> Search your signal</div>
      <div className="ml-auto flex items-center gap-2"><button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-full bg-[#635bff] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_7px_18px_rgba(99,91,255,.2)] transition hover:-translate-y-0.5"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add feed</span></button><button onClick={() => auth.logout()} aria-label="Sign out" className="grid h-10 w-10 place-items-center rounded-full border border-[#e1e4ea] bg-white text-[#727b89] transition hover:text-[#14161a]"><LogOut className="h-4 w-4" /></button></div>
    </header>

    <section data-source-bar data-compact={isSourceBarCompact} className={`sticky top-[76px] z-20 border-b border-[#e6e8ed] bg-[#f7f8fa]/95 px-4 backdrop-blur-xl transition-[padding] duration-200 ease-out sm:px-8 ${isSourceBarCompact ? "py-1.5" : "py-2.5"}`}>
      <div className="mx-auto flex max-w-[1440px] items-center gap-2 py-0.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Source category tabs">
          {sourceChannels.map((channel) => {
          const selected = !activeGroup && activeCategory === channel.key;
          const editable = channel.kind !== "all";
          return <React.Fragment key={channel.key}>{channel.kind === "all" && <button type="button" onClick={() => setShowShorts(true)} aria-label="Open Shorts" aria-pressed={showShorts} aria-haspopup="dialog" title="Open Shorts" className={`group flex shrink-0 items-center justify-center transition ${isSourceBarCompact ? "h-10 w-10 rounded-xl" : "min-w-[80px] flex-col gap-1.5 rounded-2xl px-3 py-2"} ${showShorts ? "bg-[#704ee5] text-white shadow-[0_8px_18px_rgba(112,78,229,.24)]" : "bg-[#f0eaff] text-[#704ee5] shadow-[0_8px_18px_rgba(112,78,229,.12)] hover:bg-[#e7dcff]"}`}><span className={`grid place-items-center ${showShorts ? "bg-white/15" : "bg-white/70"} ${isSourceBarCompact ? "h-7 w-7 rounded-lg" : "h-8 w-8 rounded-xl"}`}><Video className="h-4 w-4" /></span>{!isSourceBarCompact && <span className="text-[11px] font-semibold">Shorts</span>}</button>}<button type="button" draggable={editable} onDragStart={(event) => { if (!editable) return; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", channel.key); setDraggedSourceTabKey(channel.key); }} onDragEnd={() => setDraggedSourceTabKey(null)} onDragOver={(event) => { if (editable && draggedSourceTabKey && draggedSourceTabKey !== channel.key) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const movingKey = event.dataTransfer.getData("text/plain") || draggedSourceTabKey; if (editable && movingKey) reorderEditableSourceTab(movingKey, channel.key); setDraggedSourceTabKey(null); }} onKeyDown={(event) => editable && handleSourceTabKeyDown(event, channel.key)} onClick={() => selectCategory(channel.key)} aria-label={`Show ${channel.label}`} aria-pressed={selected} aria-keyshortcuts={editable ? "Alt+ArrowLeft Alt+ArrowRight" : undefined} title={editable ? "Drag to reorder. Use Alt + Left/Right Arrow to reorder with a keyboard." : undefined} className={`group flex shrink-0 items-center transition ${isSourceBarCompact ? "min-w-[72px] gap-2 rounded-xl px-2.5 py-1.5" : "min-w-[80px] flex-col gap-1.5 rounded-2xl px-3 py-2"} ${selected ? "bg-[#14161a] text-white shadow-[0_8px_18px_rgba(24,22,32,.14)]" : "text-[#657080] hover:bg-white"} ${editable ? "cursor-grab active:cursor-grabbing" : ""} ${draggedSourceTabKey === channel.key ? "scale-95 opacity-45" : ""}`}>
            <span className={`grid place-items-center ${isSourceBarCompact ? "h-7 w-7 rounded-lg" : "h-8 w-8 rounded-xl"} ${selected ? "bg-white/12 text-white" : channelTint(channel.kind)}`}><ChannelIcon kind={channel.kind} className="h-4 w-4" /></span>
            <span className={`${isSourceBarCompact ? "max-w-[104px] text-xs" : "max-w-[78px] text-[11px]"} truncate font-semibold`}>{channel.shortLabel}</span>{!isSourceBarCompact && <span className={`text-[10px] ${selected ? "text-white/55" : "text-[#a0a8b5]"}`}>{channel.feedIds.length} source{channel.feedIds.length === 1 ? "" : "s"}</span>}
          </button></React.Fragment>;
          })}
          <button type="button" onClick={() => setShowAdd(true)} aria-label="Add a source" className={`flex shrink-0 items-center text-[#697281] transition hover:bg-white ${isSourceBarCompact ? "min-w-[88px] gap-2 rounded-xl px-2.5 py-1.5" : "min-w-[80px] flex-col gap-1.5 rounded-2xl px-3 py-2"}`}><span className={`grid place-items-center bg-white text-[#635bff] shadow-sm ${isSourceBarCompact ? "h-7 w-7 rounded-lg" : "h-8 w-8 rounded-xl"}`}><Plus className="h-4 w-4" /></span><span className={`${isSourceBarCompact ? "text-xs" : "text-[11px]"} font-semibold`}>Add source</span>{!isSourceBarCompact && <span className="text-[10px] text-[#a0a8b5]">New channel</span>}</button>
        </div>
        <div className="flex shrink-0 items-center border-l border-[#e0e3e9] pl-2">
          <button type="button" onClick={() => { setManagedFeedId(null); setShowSourceManager(true); }} aria-label="Manage RSS sources" className={`inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#e1e4ea] bg-white font-semibold text-[#4e5765] transition hover:border-[#635bff] hover:text-[#635bff] ${isSourceBarCompact ? "h-9 w-9 justify-center" : "px-3 py-2 text-xs"}`}><SlidersHorizontal className="h-4 w-4" /><span className="hidden md:inline">Manage</span></button>
        </div>
      </div>
    </section>

    <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[270px_minmax(0,680px)_290px]">
      <aside className="hidden min-h-[calc(100vh-151px)] border-r border-[#e6e8ed] bg-[#17171d] px-4 py-5 text-white lg:block">
        <div className="overflow-hidden rounded-2xl bg-[#222229] p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-white/50"><Sparkles className="h-3.5 w-3.5 text-[#ffcc82]" /> Private community</div><div className="text-lg font-semibold">Your signal spaces</div><p className="mt-1 text-xs leading-5 text-white/50">Only your own feeds and collections appear here.</p></div>
        <div className="mt-6 px-2 text-[11px] font-semibold uppercase tracking-[.16em] text-white/40">Browse</div>
        <button type="button" onClick={() => { setActiveGroup(null); setActiveCategory("all"); }} className={`mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${!activeGroup && activeCategory === "all" ? "bg-white/12 text-white" : "text-white/55 hover:bg-white/7 hover:text-white"}`}><Compass className="h-4 w-4" /> All signals <span className="ml-auto text-xs text-white/35">{feeds.length}</span></button>
        <div className="mt-7 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[.16em] text-white/40"><span>Collections</span><button type="button" onClick={() => setShowGroupBuilder(true)} aria-label="Create collection" className="text-white/55 hover:text-white"><Plus className="h-4 w-4" /></button></div>
        <div className="mt-2 space-y-1">{groups.length ? groups.map((group) => <div key={group.id} className="group flex items-center gap-1"><button type="button" onClick={() => { setActiveGroup(group.id); setActiveCategory("all"); }} className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${activeGroup === group.id ? "bg-white/12 font-semibold text-white" : "text-white/55 hover:bg-white/7 hover:text-white"}`}><Layers3 className="h-4 w-4 shrink-0" /><span className="truncate">{group.name}</span></button><button type="button" onClick={() => setShowAssign(group.id)} aria-label={`Manage ${group.name}`} className="hidden rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-white group-hover:block"><SlidersHorizontal className="h-3.5 w-3.5" /></button></div>) : <p className="px-3 py-2 text-xs leading-5 text-white/35">Create a collection to combine related channels.</p>}</div>
        <div className="mt-7 px-2 text-[11px] font-semibold uppercase tracking-[.16em] text-white/40">Source channels</div>
        <div className="mt-2 space-y-1">{sourceChannels.slice(1).map((channel) => <button key={channel.key} type="button" onClick={() => selectCategory(channel.key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${!activeGroup && activeCategory === channel.key ? "bg-white/12 font-semibold text-white" : "text-white/55 hover:bg-white/7 hover:text-white"}`}><ChannelIcon kind={channel.kind} className="h-4 w-4" /><span className="truncate">{channel.shortLabel}</span><span className="ml-auto text-xs text-white/35">{channel.feedIds.length}</span></button>)}</div>
        <div className="mt-7 px-2 text-[11px] font-semibold uppercase tracking-[.16em] text-white/40">In this space</div>
        <div className="mt-2 space-y-1">{categoryFeeds.length ? categoryFeeds.map((feed) => <div key={feed.id} className="group flex items-center gap-2 rounded-xl px-3 py-2.5 transition hover:bg-white/7"><img src={favicon(feed.faviconUrl)} alt="" className="h-5 w-5 rounded-md" onError={(event) => { event.currentTarget.src = favicon(null); }} /><span className="min-w-0 flex-1 truncate text-sm text-white/60">{feed.customTitle || feed.title}</span><button type="button" onClick={() => refreshFeed.mutate({ id: feed.id })} aria-label={`Refresh ${feed.customTitle || feed.title}`} className="hidden text-white/40 hover:text-white group-hover:block"><RefreshCw className="h-3.5 w-3.5" /></button></div>) : <p className="px-3 py-2 text-xs leading-5 text-white/35">No sources in this channel yet.</p>}</div>
      </aside>

      <main className="min-w-0 px-5 py-8 sm:px-8">
        <div className="mb-7 flex items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-[#9ba2ae]"><span className="h-2 w-2 rounded-full bg-[#24c1b0]" /> Community feed</div><div className="flex flex-wrap items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-2xl ${channelTint(activeChannel?.kind ?? "all")}`}><ChannelIcon kind={activeChannel?.kind ?? "all"} className="h-5 w-5" /></span><h1 className="text-3xl font-semibold tracking-[-.045em]">{activeLabel}</h1></div><p className="mt-3 text-sm text-[#8a929f]">{activeDescription} {sourceCount ? `${sourceCount} active source${sourceCount === 1 ? "" : "s"} · newest first` : ""}</p></div><button type="button" onClick={() => activeGroup ? refreshGroup.mutate({ id: activeGroup }) : refreshAllFeeds.mutate()} disabled={refreshAllFeeds.isPending || refreshGroup.isPending} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#e1e4ea] bg-white px-3.5 py-2 text-xs font-semibold text-[#68707d] transition hover:border-[#635bff] hover:text-[#635bff] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refreshAllFeeds.isPending || refreshGroup.isPending ? "animate-spin" : ""}`} /> Refresh</button></div>
        <div className="mb-6 rounded-[1.5rem] border border-[#e7e9ee] bg-white p-4 shadow-[0_8px_25px_rgba(24,31,45,.03)]"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-semibold"><Megaphone className="h-4 w-4 text-[#635bff]" /> {activeChannel?.kind === "youtube" ? "Channel roll call" : activeChannel?.kind === "reddit" ? "Community roll call" : "Source roll call"}</div><span className="rounded-full bg-[#f3f2ff] px-2.5 py-1 text-xs font-semibold text-[#635bff]">{categoryFeeds.length} joined</span></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{categoryFeeds.map((feed) => <div key={feed.id} className="flex min-w-[140px] items-center gap-2 rounded-xl bg-[#f7f8fa] px-3 py-2"><img src={favicon(feed.faviconUrl)} alt="" className="h-6 w-6 rounded-lg" onError={(event) => { event.currentTarget.src = favicon(null); }} /><span className="truncate text-xs font-semibold text-[#596270]">{feed.customTitle || feed.title}</span></div>)}{!categoryFeeds.length && <span className="text-sm text-[#8a929f]">Add a feed to populate this private channel.</span>}</div></div>
        {visibleArticles.length === 0 ? <div className="rounded-[1.5rem] border border-dashed border-[#d9dde5] bg-white/50 p-12 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#eeedff] text-[#635bff]"><Layers3 className="h-6 w-6" /></div><h2 className="mt-5 text-xl font-semibold">No stories in this channel yet</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#8a929f]">Add a matching source or choose another community channel to continue reading.</p><button type="button" onClick={() => setShowAdd(true)} className="mt-6 rounded-full bg-[#14161a] px-5 py-2.5 text-sm font-semibold text-white">Add source</button></div> : <div className="space-y-4">{visibleArticles.map((article) => { const feed = feeds.find((item) => item.id === article.feedId); return <article key={article.id} className="group overflow-hidden rounded-[1.35rem] border border-[#e7e9ee] bg-white shadow-[0_8px_25px_rgba(24,31,45,.03)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(24,31,45,.08)]"><div className="p-5 sm:p-6"><div className="mb-4 flex items-center gap-3"><img src={favicon(feed?.faviconUrl ?? null)} alt="" className="h-8 w-8 rounded-xl" onError={(event) => { event.currentTarget.src = favicon(null); }} /><div className="min-w-0"><div className="truncate text-xs font-semibold text-[#555e6b]">{feed?.customTitle || feed?.title || "RSS source"}</div><div className="mt-0.5 text-xs text-[#a0a7b2]">{formatDate(article.publishedAt)}</div></div><button type="button" aria-label="Bookmark story" className="ml-auto rounded-lg p-2 text-[#b2b8c2] transition hover:bg-[#f4f5f8] hover:text-[#635bff]"><Bookmark className="h-4 w-4" /></button><button type="button" aria-label="More story options" className="rounded-lg p-2 text-[#b2b8c2] transition hover:bg-[#f4f5f8] hover:text-[#635bff]"><MoreHorizontal className="h-4 w-4" /></button></div><a href={article.link} target="_blank" rel="noreferrer" className="block"><h2 className="text-xl font-semibold leading-snug tracking-[-.025em] transition group-hover:text-[#635bff]">{article.title}</h2>{article.description && <p className="mt-3 text-sm leading-6 text-[#68707d]">{article.description}</p>}{article.thumbnailUrl && <img src={article.thumbnailUrl} alt="" className="mt-5 max-h-72 w-full rounded-2xl object-cover" loading="lazy" />}</a>{article.videoUrl && <div className="mt-5 overflow-hidden rounded-2xl bg-black"><FeedVideo url={article.videoUrl} mimeType={article.videoMimeType} poster={article.thumbnailUrl} className="max-h-96 w-full" /><div className="flex items-center gap-2 px-4 py-3 text-xs text-white/70"><Video className="h-3.5 w-3.5" /> Inline video from this feed</div></div>}<div className="mt-5 flex items-center justify-between border-t border-[#f0f1f4] pt-4"><span className="text-xs font-medium text-[#a0a7b2]">Open original story</span><ArrowUpRight className="h-4 w-4 text-[#a0a7b2] transition group-hover:text-[#635bff]" /></div></div></article>; })}</div>}
      </main>

      <aside className="hidden border-l border-[#e6e8ed] px-5 py-8 xl:block"><div className="rounded-[1.5rem] bg-[#14161a] p-5 text-white"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-white/50"><Sparkles className="h-3.5 w-3.5 text-[#ffcc82]" /> Signal notes</div><p className="mt-5 text-lg font-semibold leading-7">Each source domain has its own space.</p><p className="mt-3 text-sm leading-6 text-white/55">Switch between YouTube, Reddit, CNN, New York Times, and other source domains without losing your private library.</p></div><div className="mt-6 rounded-[1.5rem] border border-[#e5e8ed] bg-white p-5"><div className="flex items-center justify-between"><span className="text-sm font-semibold">Your community</span><Settings2 className="h-4 w-4 text-[#a0a7b2]" /></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-[#f5f6f8] p-3"><div className="text-2xl font-semibold">{feeds.length}</div><div className="mt-1 text-xs text-[#8a929f]">Sources</div></div><div className="rounded-2xl bg-[#f5f6f8] p-3"><div className="text-2xl font-semibold">{groups.length}</div><div className="mt-1 text-xs text-[#8a929f]">Collections</div></div></div></div><div className="mt-6 rounded-[1.5rem] border border-[#e5e8ed] bg-white p-5"><div className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9ba2ae]">Channel mix</div><div className="mt-4 space-y-3">{sourceChannels.slice(1).map((channel) => <button key={channel.key} type="button" onClick={() => selectCategory(channel.key)} className="flex w-full items-center gap-3 text-left"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#f4f5f8] text-[#635bff]"><ChannelIcon kind={channel.kind} className="h-4 w-4" /></span><span className="flex-1 truncate text-sm font-medium text-[#657080]">{channel.shortLabel}</span><span className="text-xs font-semibold text-[#a0a8b5]">{channel.feedIds.length}</span></button>)}</div></div></aside>
    </div>

    <div className="fixed right-4 top-[160px] z-30 flex flex-col overflow-hidden rounded-2xl border border-[#e1e4ea] bg-white/95 shadow-[0_12px_30px_rgba(24,31,45,.12)] backdrop-blur sm:right-6" aria-label="Feed controls"><button type="button" onClick={() => refreshAllFeeds.mutate()} disabled={refreshAllFeeds.isPending || feeds.length === 0} title="Refresh all feeds" aria-label="Refresh all feeds" className="grid h-11 w-11 place-items-center text-[#68707d] transition hover:bg-[#f5f4ff] hover:text-[#635bff] disabled:cursor-not-allowed disabled:opacity-45"><RefreshCw className={`h-4 w-4 ${refreshAllFeeds.isPending ? "animate-spin" : ""}`} /></button><span className="mx-2 h-px bg-[#eceef2]" /><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} title="Scroll to top of feed" aria-label="Scroll to top of feed" className="grid h-11 w-11 place-items-center text-[#68707d] transition hover:bg-[#f5f4ff] hover:text-[#635bff]"><ChevronDown className="h-5 w-5 -rotate-180" /></button></div>

    {showShorts && <div role="dialog" aria-modal="true" aria-label="Video Shorts" className="fixed inset-0 z-50 bg-[#0b0b0f] text-white"><div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent px-5 py-5 sm:px-8"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-white/55"><Video className="h-3.5 w-3.5 text-[#8f88ff]" /> Signalflow shorts</div><h2 className="mt-1 text-xl font-semibold">Video-only feed</h2></div><div className="flex items-center gap-2"><button type="button" onClick={toggleShortsSound} aria-label={shortsSoundEnabled ? "Mute Shorts" : "Turn on Shorts sound"} aria-pressed={shortsSoundEnabled} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/12 px-3 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"><span className="grid h-5 w-5 place-items-center">{shortsSoundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</span><span className="hidden sm:inline">{shortsSoundEnabled ? "Sound on" : "Sound off"}</span></button><button type="button" onClick={() => setShowShorts(false)} aria-label="Close Shorts" className="grid h-10 w-10 place-items-center rounded-full bg-white/12 text-white backdrop-blur transition hover:bg-white/20"><X className="h-5 w-5" /></button></div></div><div ref={shortViewportRef} className="h-[100dvh] snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{videoArticles.length ? videoArticles.map((article) => { const feed = feeds.find((item) => item.id === article.feedId); const active = activeShortId === article.id; const shouldLoadMedia = loadedShortIds.includes(article.id); return <article ref={(node) => { if (node) shortCardRefs.current.set(article.id, node); else shortCardRefs.current.delete(article.id); }} data-short-id={article.id} data-short-active={active ? "true" : "false"} data-short-media-state={shouldLoadMedia ? "loaded" : "deferred"} key={article.id} className="relative flex min-h-[100dvh] snap-start [scroll-snap-stop:always] items-center justify-center border-b border-white/10 bg-[#0b0b0f] px-3 pb-20 pt-24 sm:px-8"><div className="relative h-[min(78dvh,760px)] w-full max-w-[440px] shrink-0 overflow-hidden rounded-[2rem] bg-black shadow-[0_22px_80px_rgba(0,0,0,.45)]">{shouldLoadMedia ? <FeedVideo url={article.videoUrl} mimeType={article.videoMimeType} poster={article.thumbnailUrl} muted={!shortsSoundEnabled} preload="auto" videoRef={(node) => { if (node) shortVideoRefs.current.set(article.id, node); else shortVideoRefs.current.delete(article.id); }} iframeRef={(node) => { if (node) shortEmbedRefs.current.set(article.id, node); else shortEmbedRefs.current.delete(article.id); }} autoPlay={active} className="absolute inset-0 h-full w-full border-0 object-contain" /> : <div aria-label="Video queued for loading" className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_40%,rgba(99,91,255,.28),transparent_42%),#111117]"><Video className="h-8 w-8 text-white/35" /></div>}<div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/25 to-transparent px-5 pb-6 pt-24"><div className="flex items-center gap-2 text-xs font-semibold text-white/75"><img src={favicon(feed?.faviconUrl ?? null)} alt="" className="h-5 w-5 rounded-md" />{feed?.customTitle || feed?.title || "RSS source"}</div><h3 className="mt-2 line-clamp-2 text-lg font-semibold leading-snug">{article.title}</h3><a href={article.link} target="_blank" rel="noreferrer" className="pointer-events-auto mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white/80 hover:text-white">Open original <ArrowUpRight className="h-3.5 w-3.5" /></a></div></div></article>; }) : <div className="grid min-h-[100dvh] place-items-center p-6 text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-[#a49fff]"><Video className="h-7 w-7" /></div><h3 className="mt-6 text-2xl font-semibold">No videos in your feed yet</h3><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/60">When a saved RSS source includes a playable video, it will appear here as a vertical Short.</p><button type="button" onClick={() => { setShowShorts(false); setShowAdd(true); }} className="mt-7 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#14161a]">Add a video source</button></div></div>}</div></div>}
    {showSourceManager && <SourceManager feeds={managedFeeds.data ?? []} groups={groups} selectedFeedId={managedFeedId} articles={managedFeedArticles.data ?? []} isLoadingArticles={managedFeedArticles.isLoading} onClose={() => { setShowSourceManager(false); setManagedFeedId(null); }} onOpenFeed={setManagedFeedId} onOpenGroup={(groupId) => { setShowSourceManager(false); setManagedFeedId(null); setActiveGroup(groupId); setActiveCategory("all"); }} onCreateGroup={() => { setShowSourceManager(false); setManagedFeedId(null); setShowGroupBuilder(true); }} onBack={() => setManagedFeedId(null)} onSetEnabled={(feed) => setFeedEnabled.mutate({ id: feed.id, isEnabled: !feed.isEnabled })} onRemove={(feed) => { if (window.confirm(`Permanently remove ${feed.customTitle || feed.title} and its saved stories?`)) removeFeed.mutate({ id: feed.id }); }} pendingFeedId={setFeedEnabled.isPending || removeFeed.isPending ? managedFeedId : null} />}
    {showGroupBuilder && <GroupBuilder feeds={feeds} name={groupName} selectedFeedIds={selectedGroupFeedIds} isPending={createGroupWithFeeds.isPending} onNameChange={setGroupName} onToggleFeed={(feedId) => setSelectedGroupFeedIds((ids) => ids.includes(feedId) ? ids.filter((id) => id !== feedId) : [...ids, feedId])} onCreate={() => createGroupWithFeeds.mutate({ name: groupName, feedIds: selectedGroupFeedIds })} onClose={() => { setShowGroupBuilder(false); setGroupName(""); setSelectedGroupFeedIds([]); }} />}
    {showAdd && <div className="fixed inset-0 z-50 grid place-items-center bg-[#14161a]/30 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Add a source</h2><p className="mt-1 text-sm text-[#8a929f]">Paste a YouTube channel, Reddit community, RSS, or Atom URL.</p></div><button type="button" onClick={() => setShowAdd(false)} aria-label="Close add source" className="rounded-full p-2 text-[#8a929f] hover:bg-[#f5f6f8]"><X className="h-4 w-4" /></button></div><label className="mt-7 block text-xs font-semibold uppercase tracking-wider text-[#8a929f]">Feed URL<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/feed.xml" className="mt-2 w-full rounded-xl border border-[#e1e4ea] px-4 py-3 text-sm outline-none transition focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10" /></label><label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-[#8a929f]">Custom title <span className="font-normal normal-case">(optional)</span><input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="My favorite source" className="mt-2 w-full rounded-xl border border-[#e1e4ea] px-4 py-3 text-sm outline-none transition focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10" /></label><button type="button" disabled={!url || addFeed.isPending} onClick={() => addFeed.mutate({ url, customTitle: customTitle || undefined })} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#635bff] py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{addFeed.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Fetch and add source</button></div></div>}
    {showGroups && <div className="fixed inset-0 z-50 grid place-items-center bg-[#14161a]/30 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">New collection</h2><p className="mt-1 text-sm text-[#8a929f]">Create a focused corner of your signal.</p></div><button type="button" onClick={() => setShowGroups(false)} aria-label="Close collection dialog" className="rounded-full p-2 text-[#8a929f] hover:bg-[#f5f6f8]"><X className="h-4 w-4" /></button></div><input value={groupName} onChange={(event) => setGroupName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && groupName && createGroup.mutate({ name: groupName })} autoFocus placeholder="Design, Tech, Inspiration..." className="mt-7 w-full rounded-xl border border-[#e1e4ea] px-4 py-3 text-sm outline-none focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10" /><button type="button" disabled={!groupName || createGroup.isPending} onClick={() => createGroup.mutate({ name: groupName })} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#14161a] py-3 text-sm font-semibold text-white disabled:opacity-50">Create collection</button></div></div>}
    {showAssign && <div className="fixed inset-0 z-50 grid place-items-center bg-[#14161a]/30 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Shape collection</h2><p className="mt-1 text-sm text-[#8a929f]">Choose the sources that belong here.</p></div><button type="button" onClick={() => setShowAssign(null)} aria-label="Close collection settings" className="rounded-full p-2 text-[#8a929f] hover:bg-[#f5f6f8]"><X className="h-4 w-4" /></button></div><div className="mt-6 space-y-2">{feeds.map((feed) => { const checked = assignment.data?.includes(feed.id); return <button type="button" key={feed.id} onClick={() => setAssignment.mutate({ groupId: showAssign, feedId: feed.id, assigned: !checked })} className="flex w-full items-center gap-3 rounded-xl border border-[#eceef2] p-3 text-left transition hover:border-[#635bff]/40"><img src={favicon(feed.faviconUrl)} alt="" className="h-7 w-7 rounded-lg" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{feed.customTitle || feed.title}</span><span className={`grid h-5 w-5 place-items-center rounded-md border ${checked ? "border-[#635bff] bg-[#635bff] text-white" : "border-[#d8dce4]"}`}>{checked && <Check className="h-3.5 w-3.5" />}</span></button>; })}</div>{groups.find((group) => group.id === showAssign) && <div className="mt-6 flex gap-2"><button type="button" onClick={() => { const current = groups.find((group) => group.id === showAssign); const name = prompt("Rename collection", current?.name); if (name) renameGroup.mutate({ id: showAssign, name }); }} className="flex-1 rounded-xl border border-[#e1e4ea] py-3 text-xs font-semibold text-[#68707d]">Rename</button><button type="button" onClick={() => deleteGroup.mutate({ id: showAssign })} aria-label="Delete collection" className="rounded-xl border border-[#ffd9d9] px-4 py-3 text-xs font-semibold text-[#d55b5b]"><Trash2 className="h-4 w-4" /></button></div>}</div></div>}
  </div>;
}
