// @vitest-environment jsdom
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as shortsPlayback from "@/lib/shortsPlayback";

const globalStyles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: vi.fn() });

let shortObserverCallback: IntersectionObserverCallback | undefined;

function installShortsObserver() {
  class ShortsObserver {
    constructor(callback: IntersectionObserverCallback) { shortObserverCallback = callback; }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0.6, 0.8];
  }
  Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, value: ShortsObserver });
}

const mocks = vi.hoisted(() => ({
  refreshAllMutate: vi.fn(),
  setSourceTabOrderMutate: vi.fn(),
  createGroupWithFeedsMutate: vi.fn(),
  setEnabledMutate: vi.fn(),
  refetchManagedFeeds: vi.fn().mockResolvedValue(undefined),
  toastSuccess: vi.fn(),
  invalidateDashboard: vi.fn().mockResolvedValue(undefined),
  invalidateArticles: vi.fn().mockResolvedValue(undefined),
  invalidateGroupArticles: vi.fn().mockResolvedValue(undefined),
  refetchSourceTabOrder: vi.fn().mockResolvedValue(undefined),
  invalidateProviderCommunities: vi.fn().mockResolvedValue(undefined),
  invalidateProviderCommunity: vi.fn().mockResolvedValue(undefined),
  sourceTabOrder: [] as string[],
  refreshAllOptions: undefined as { onSuccess?: (data: { attempted: number; refreshed: number }) => Promise<void> } | undefined,
  dashboardData: {
    feeds: [
      { id: 7, title: "NASA", customTitle: null, faviconUrl: null, url: "https://m.youtube.com/@NASA" },
      { id: 8, title: "Technology", customTitle: null, faviconUrl: null, url: "https://www.reddit.com/r/technology/.rss" },
      { id: 9, title: "CNN World", customTitle: null, faviconUrl: null, url: "https://rss.cnn.com/rss/edition_world.rss" },
    ],
    groups: [] as Array<{ id: number; name: string }>,
  },
  managedFeeds: [
    { id: 7, title: "NASA", customTitle: null, faviconUrl: null, url: "https://m.youtube.com/@NASA", description: "NASA video updates", lastFetchedAt: new Date("2026-08-19T08:00:00Z"), isEnabled: true },
    { id: 8, title: "Technology", customTitle: null, faviconUrl: null, url: "https://www.reddit.com/r/technology/.rss", description: null, lastFetchedAt: new Date("2026-08-19T07:00:00Z"), isEnabled: false },
    { id: 9, title: "CNN World", customTitle: null, faviconUrl: null, url: "https://rss.cnn.com/rss/edition_world.rss", description: null, lastFetchedAt: new Date("2026-08-19T06:00:00Z"), isEnabled: true },
  ],
  allArticles: [
    { id: 1, feedId: 7, title: "NASA update", link: "https://example.com/nasa", description: null, publishedAt: new Date("2026-08-19T08:00:00Z"), thumbnailUrl: null, videoUrl: "https://cdn.example.com/nasa.mp4" },
    { id: 2, feedId: 8, title: "Reddit update", link: "https://example.com/reddit", description: null, publishedAt: new Date("2026-08-19T07:00:00Z"), thumbnailUrl: null, videoUrl: null },
    { id: 3, feedId: 9, title: "CNN update", link: "https://example.com/cnn", description: null, publishedAt: new Date("2026-08-19T06:00:00Z"), thumbnailUrl: null, videoUrl: null },
  ],
  providerCommunities: [
    { id: 1, providerHostname: "youtube.com", createdAt: new Date(), updatedAt: new Date() },
    { id: 2, providerHostname: "reddit.com", createdAt: new Date(), updatedAt: new Date() },
  ],
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, loading: false, logout: vi.fn() }) }));
vi.mock("@/lib/feedError", () => ({ feedErrorMessage: (error: Error) => error.message }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ dashboard: { invalidate: mocks.invalidateDashboard }, feed: { articles: { invalidate: mocks.invalidateArticles } }, group: { articles: { invalidate: mocks.invalidateGroupArticles } }, providerCommunity: { list: { invalidate: mocks.invalidateProviderCommunities }, get: { invalidate: mocks.invalidateProviderCommunity } } }),
    dashboard: { useQuery: () => ({ isLoading: false, data: mocks.dashboardData }) },
    sourceTabs: {
      order: { useQuery: () => ({ data: mocks.sourceTabOrder, refetch: mocks.refetchSourceTabOrder }) },
      setOrder: { useMutation: () => ({ mutate: mocks.setSourceTabOrderMutate, isPending: false }) },
    },
    feed: {
      articles: { useQuery: () => ({ data: mocks.allArticles }) },
      list: { useQuery: () => ({ data: mocks.managedFeeds, refetch: mocks.refetchManagedFeeds }) },
      sourceArticles: { useQuery: () => ({ data: mocks.allArticles.filter((article) => article.feedId === 7), isLoading: false }) },
      add: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      refresh: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      refreshAll: { useMutation: (options: typeof mocks.refreshAllOptions) => { mocks.refreshAllOptions = options; return { mutate: mocks.refreshAllMutate, isPending: false }; } },
      setEnabled: { useMutation: () => ({ mutate: mocks.setEnabledMutate, isPending: false }) },
      remove: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    group: {
      articles: { useQuery: (input: { id: number }) => ({ data: input.id === 44 ? [mocks.allArticles[0], mocks.allArticles[2]] : [] }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      createWithFeeds: { useMutation: () => ({ mutate: mocks.createGroupWithFeedsMutate, isPending: false }) },
      refresh: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      rename: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    assignment: { list: { useQuery: () => ({ data: [] }) }, set: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
    providerCommunity: { list: { useQuery: () => ({ data: mocks.providerCommunities }) }, createPost: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
  },
}));

import Home from "./Home";

describe("dashboard reload refresh controls", () => {
  afterEach(() => {
    cleanup();
    mocks.refreshAllMutate.mockClear();
    mocks.setSourceTabOrderMutate.mockClear();
    mocks.createGroupWithFeedsMutate.mockClear();
    mocks.setEnabledMutate.mockClear();
    mocks.refetchManagedFeeds.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.invalidateDashboard.mockClear();
    mocks.invalidateArticles.mockClear();
    mocks.invalidateGroupArticles.mockClear();
    mocks.refetchSourceTabOrder.mockClear();
    mocks.sourceTabOrder.splice(0);
    mocks.refreshAllOptions = undefined;
    mocks.dashboardData.groups.splice(0);
    shortObserverCallback = undefined;
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    localStorage.removeItem("signalflow-shorts-sound");
  });

  it("refreshes saved feeds once after dashboard load and exposes feedback controls", async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", { configurable: true, value: scrollTo });
    render(<Home />);

    await waitFor(() => expect(mocks.refreshAllMutate).toHaveBeenCalledTimes(1));
    expect((screen.getByRole("button", { name: "Refresh all feeds" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Scroll to top of feed" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });

    await mocks.refreshAllOptions?.onSuccess?.({ attempted: 2, refreshed: 2 });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Updated 2 of 2 sources");
    expect(mocks.invalidateDashboard).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateArticles).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateGroupArticles).toHaveBeenCalledTimes(1);
  });

  it("opens a source community channel and shows only its matching RSS stories", async () => {
    render(<Home />);

    expect(screen.getByText("NASA update")).toBeTruthy();
    expect(screen.getByText("Reddit update")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show YouTube channels" }));

    await waitFor(() => expect(screen.getByText("NASA update")).toBeTruthy());
    expect(screen.queryByText("Reddit update")).toBeNull();
    expect(screen.getByText("Channel roll call")).toBeTruthy();
  });

  it("shows the gvone brand in the reader header and Shorts overlay", () => {
    render(<Home />);

    expect(screen.getByText("gvone")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open profile" }).getAttribute("href")).toBe("/profile");
    fireEvent.click(screen.getByRole("button", { name: "Open Shorts" }));
    expect(screen.getByText("gvone shorts")).toBeTruthy();
  });

  it("creates a dedicated CNN domain channel rather than merging it into a generic website tab", async () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Show CNN" }));

    await waitFor(() => expect(screen.getByText("CNN update")).toBeTruthy());
    expect(screen.queryByText("NASA update")).toBeNull();
    expect(screen.queryByText("Reddit update")).toBeNull();
    expect(screen.getByText(/Stories from your saved CNN feeds/)).toBeTruthy();
  });

  it("places Shorts before All in the scrolling tabs and keeps Manage at the source bar’s far right", () => {
    render(<Home />);

    const sourceBar = document.querySelector("[data-source-bar]");
    expect(sourceBar).toBeTruthy();
    const all = within(sourceBar as HTMLElement).getByRole("button", { name: /Show All/ });
    const shorts = within(sourceBar as HTMLElement).getByRole("button", { name: "Open Shorts" });
    const manage = within(sourceBar as HTMLElement).getByRole("button", { name: "Manage RSS sources" });
    expect(shorts.compareDocumentPosition(all) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(all.compareDocumentPosition(manage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(shorts.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(shorts);
    expect(shorts.getAttribute("aria-pressed")).toBe("true");
  });

  it("exposes drag-and-keyboard ordering only for editable source tabs while preserving fixed controls", () => {
    render(<Home />);

    const sourceBar = document.querySelector("[data-source-bar]") as HTMLElement;
    const all = within(sourceBar).getByRole("button", { name: /Show All/ });
    const shorts = within(sourceBar).getByRole("button", { name: "Open Shorts" });
    const manage = within(sourceBar).getByRole("button", { name: "Manage RSS sources" });
    const youtube = within(sourceBar).getByRole("button", { name: "Show YouTube channels" });

    expect(all.draggable).toBe(false);
    expect(shorts.draggable).toBe(false);
    expect(manage.draggable).toBe(false);
    expect(youtube.draggable).toBe(true);
    expect(youtube.getAttribute("aria-keyshortcuts")).toBe("Alt+ArrowLeft Alt+ArrowRight");
  });

  it("opens the separate source manager from the header and lets a reader open or disable a private RSS source", async () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Manage RSS sources" }));
    const manager = screen.getByRole("dialog", { name: "Manage RSS sources" });

    expect(within(manager).getAllByText("Manage RSS sources").length).toBeGreaterThan(0);
    expect(within(manager).getByText("Disabled")).toBeTruthy();
    fireEvent.click(within(manager).getByRole("button", { name: "Open NASA feed" }));
    await waitFor(() => expect(within(manager).getByText("All saved stories")).toBeTruthy());
    expect(within(manager).getByText("NASA update")).toBeTruthy();
    fireEvent.click(within(manager).getByRole("button", { name: "All sources" }));
    fireEvent.click(within(manager).getByRole("button", { name: "Disable NASA" }));

    expect(mocks.setEnabledMutate).toHaveBeenCalledWith({ id: 7, isEnabled: false });
  });

  it("lists a category group in the source manager and opens its merged selected-source feed", async () => {
    mocks.dashboardData.groups.push({ id: 44, name: "Science desk" });
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Manage RSS sources" }));
    const manager = screen.getByRole("dialog", { name: "Manage RSS sources" });
    fireEvent.click(within(manager).getByRole("button", { name: "Open Science desk group feed" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Manage RSS sources" })).toBeNull());
    expect(screen.getAllByText("Science desk").length).toBeGreaterThan(0);
    expect(screen.getByText("NASA update")).toBeTruthy();
    expect(screen.getByText("CNN update")).toBeTruthy();
    expect(screen.queryByText("Reddit update")).toBeNull();
  });

  it("creates a category group from multiple user-selected RSS sources", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Create collection" }));
    const builder = screen.getByRole("dialog", { name: "Create category group" });
    fireEvent.change(within(builder).getByPlaceholderText("Space, Tech, Markets..."), { target: { value: "Science desk" } });
    fireEvent.click(within(builder).getByRole("button", { name: "Select NASA" }));
    fireEvent.click(within(builder).getByRole("button", { name: "Select CNN World" }));
    fireEvent.click(within(builder).getByRole("button", { name: "Create combined feed" }));

    expect(mocks.createGroupWithFeedsMutate).toHaveBeenCalledWith({ name: "Science desk", feedIds: [7, 9] });
  });

  it("opens a vertical Shorts dialog containing only playable RSS video stories", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Open Shorts" }));
    const dialog = screen.getByRole("dialog", { name: "Video Shorts" });

    expect(within(dialog).getByText("Video-only feed")).toBeTruthy();
    expect(within(dialog).getByText("NASA update")).toBeTruthy();
    expect(within(dialog).queryByText("Reddit update")).toBeNull();
    expect(dialog.querySelectorAll("video")).toHaveLength(1);
    expect(dialog.querySelector(".snap-y")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close Shorts" }));
    expect(screen.queryByRole("dialog", { name: "Video Shorts" })).toBeNull();
  });

  it("keeps each Short in its own stable tile and mutes native short videos", () => {
    mocks.allArticles.push({ id: 4, feedId: 7, title: "NASA archive clip", link: "https://example.com/archive-video", description: null, publishedAt: new Date("2026-08-18T08:00:00Z"), thumbnailUrl: null, videoUrl: "https://cdn.example.com/archive.mp4" });
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Open Shorts" }));
    const dialog = screen.getByRole("dialog", { name: "Video Shorts" });

    expect(dialog.querySelectorAll("[data-short-id]")).toHaveLength(2);
    expect(dialog.querySelectorAll("video")).toHaveLength(2);
    expect(Array.from(dialog.querySelectorAll("video")).every((video) => video.muted)).toBe(true);
    expect(Array.from(dialog.querySelectorAll("video")).every((video) => video.className.includes("absolute inset-0"))).toBe(true);
    mocks.allArticles.pop();
  });

  it("switches playback to the newly visible Short and pauses the video that scrolled away", async () => {
    mocks.allArticles.push({ id: 4, feedId: 7, title: "NASA archive clip", link: "https://example.com/archive-video", description: null, publishedAt: new Date("2026-08-18T08:00:00Z"), thumbnailUrl: null, videoUrl: "https://cdn.example.com/archive.mp4" });
    installShortsObserver();
    const play = vi.mocked(HTMLMediaElement.prototype.play);
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Open Shorts" }));
    await waitFor(() => expect(shortObserverCallback).toBeTypeOf("function"));
    const dialog = screen.getByRole("dialog", { name: "Video Shorts" });
    const cards = Array.from(dialog.querySelectorAll<HTMLElement>("[data-short-id]"));
    const videos = Array.from(dialog.querySelectorAll("video"));
    play.mockClear();
    pause.mockClear();

    act(() => shortObserverCallback?.([{ target: cards[1], isIntersecting: true, intersectionRatio: 0.9 } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));

    await waitFor(() => expect(pause.mock.instances).toContain(videos[0]));
    expect(play.mock.instances).toContain(videos[1]);
    mocks.allArticles.pop();
  });

  it("preserves a reader-unmuted native Shorts preference as scrolling activates the next video", async () => {
    mocks.allArticles.push({ id: 4, feedId: 7, title: "NASA archive clip", link: "https://example.com/archive-video", description: null, publishedAt: new Date("2026-08-18T08:00:00Z"), thumbnailUrl: null, videoUrl: "https://cdn.example.com/archive.mp4" });
    installShortsObserver();
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Open Shorts" }));
    await waitFor(() => expect(shortObserverCallback).toBeTypeOf("function"));
    const dialog = screen.getByRole("dialog", { name: "Video Shorts" });
    const cards = Array.from(dialog.querySelectorAll<HTMLElement>("[data-short-id]"));
    const videos = Array.from(dialog.querySelectorAll("video"));
    videos[0].muted = false;
    fireEvent.volumeChange(videos[0]);

    await waitFor(() => expect(localStorage.getItem("signalflow-shorts-sound")).toBe("on"));
    act(() => shortObserverCallback?.([{ target: cards[1], isIntersecting: true, intersectionRatio: 0.7 } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));

    await waitFor(() => expect(videos[1].muted).toBe(false));
    mocks.allArticles.pop();
  });

  it("lets the reader enable Shorts sound once and preloads the following native video", async () => {
    mocks.allArticles.push({ id: 4, feedId: 7, title: "NASA archive clip", link: "https://example.com/archive-video", description: null, publishedAt: new Date("2026-08-18T08:00:00Z"), thumbnailUrl: null, videoUrl: "https://cdn.example.com/archive.mp4" });
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Open Shorts" }));
    const dialog = screen.getByRole("dialog", { name: "Video Shorts" });
    const videos = Array.from(dialog.querySelectorAll("video"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn on Shorts sound" }));

    await waitFor(() => expect(localStorage.getItem("signalflow-shorts-sound")).toBe("on"));
    expect(videos[0].muted).toBe(false);
    expect(videos[1].getAttribute("preload")).toBe("auto");
    expect(within(dialog).getByRole("button", { name: "Mute Shorts" }).getAttribute("aria-pressed")).toBe("true");
    mocks.allArticles.pop();
  });

  it("defers distant Shorts media so the full video feed does not load at once", async () => {
    mocks.allArticles.push(
      { id: 4, feedId: 7, title: "NASA archive clip", link: "https://example.com/archive-video", description: null, publishedAt: new Date("2026-08-18T08:00:00Z"), thumbnailUrl: null, videoUrl: "https://cdn.example.com/archive.mp4" },
      { id: 5, feedId: 7, title: "NASA distant clip", link: "https://example.com/distant-video", description: null, publishedAt: new Date("2026-08-17T08:00:00Z"), thumbnailUrl: null, videoUrl: "https://cdn.example.com/distant.mp4" },
    );
    installShortsObserver();
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Open Shorts" }));
    await waitFor(() => expect(shortObserverCallback).toBeTypeOf("function"));
    const dialog = screen.getByRole("dialog", { name: "Video Shorts" });
    const cards = Array.from(dialog.querySelectorAll<HTMLElement>("[data-short-id]"));

    await waitFor(() => expect(dialog.querySelectorAll("video")).toHaveLength(2));
    expect(cards[2].dataset.shortMediaState).toBe("deferred");
    expect(within(cards[2]).getByLabelText("Video queued for loading")).toBeTruthy();
    act(() => shortObserverCallback?.([{ target: cards[1], isIntersecting: true, intersectionRatio: 0.7 } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));

    await waitFor(() => expect(cards[2].dataset.shortMediaState).toBe("loaded"));
    expect(dialog.querySelectorAll("video")).toHaveLength(3);
    mocks.allArticles.pop();
    mocks.allArticles.pop();
  });

  it("keeps embedded YouTube Shorts in a stable tile and sends an off-screen pause command", async () => {
    const first = mocks.allArticles[0] as { videoUrl: string | null; videoMimeType?: string | null };
    const originalUrl = first.videoUrl;
    const originalMimeType = first.videoMimeType;
    first.videoUrl = "https://www.youtube.com/embed/example";
    first.videoMimeType = "text/html";
    mocks.allArticles.push({ id: 4, feedId: 7, title: "NASA archive clip", link: "https://example.com/archive-video", description: null, publishedAt: new Date("2026-08-18T08:00:00Z"), thumbnailUrl: null, videoUrl: "https://cdn.example.com/archive.mp4" });
    installShortsObserver();
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Open Shorts" }));
    await waitFor(() => expect(shortObserverCallback).toBeTypeOf("function"));
    const dialog = screen.getByRole("dialog", { name: "Video Shorts" });
    const cards = Array.from(dialog.querySelectorAll<HTMLElement>("[data-short-id]"));
    const frame = dialog.querySelector<HTMLIFrameElement>('iframe[title="Embedded feed video"]')!;
    const pauseEmbeddedShort = vi.spyOn(shortsPlayback, "pauseEmbeddedShort");

    expect(frame.className).toContain("absolute inset-0");
    expect(frame.src).toContain("enablejsapi=1");
    act(() => shortObserverCallback?.([{ target: cards[1], isIntersecting: true, intersectionRatio: 0.9 } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));

    await waitFor(() => expect(cards[0].dataset.shortActive).toBe("false"));
    expect(cards[1].dataset.shortActive).toBe("true");
    expect(pauseEmbeddedShort).toHaveBeenCalledWith(frame);
    pauseEmbeddedShort.mockRestore();
    mocks.allArticles.pop();
    first.videoUrl = originalUrl;
    first.videoMimeType = originalMimeType;
  });

  it("renders an embedded YouTube feed card on a protected widescreen player surface", () => {
    const article = mocks.allArticles[0] as { videoUrl: string | null; videoMimeType?: string | null };
    const originalUrl = article.videoUrl;
    const originalMimeType = article.videoMimeType;
    article.videoUrl = "https://www.youtube.com/embed/example";
    article.videoMimeType = "text/html";

    const { container } = render(<Home />);
    const frame = container.querySelector<HTMLIFrameElement>('main article iframe[title="Embedded feed video"]');

    expect(frame).toBeTruthy();
    expect(frame?.className).toContain("w-full");
    expect(globalStyles).toContain('main article iframe[title="Embedded feed video"]');
    expect(globalStyles).toContain("aspect-ratio: 16 / 9;");
    article.videoUrl = originalUrl;
    article.videoMimeType = originalMimeType;
  });

  it("renders an embedded YouTube Shorts original link above its title in the protected metadata stack", () => {
    const article = mocks.allArticles[0] as { videoUrl: string | null; videoMimeType?: string | null };
    const originalUrl = article.videoUrl;
    const originalMimeType = article.videoMimeType;
    article.videoUrl = "https://www.youtube.com/embed/example";
    article.videoMimeType = "text/html";
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Open Shorts" }));
    const dialog = screen.getByRole("dialog", { name: "Video Shorts" });
    const caption = within(dialog).getByText("NASA update").closest("div");
    const originalLink = within(dialog).getByRole("link", { name: /Open original/i });

    expect(within(dialog).getByTitle("Embedded feed video")).toBeTruthy();
    expect(caption?.className).toContain("absolute");
    expect(caption?.className).toContain("bottom-0");
    expect(originalLink.getAttribute("href")).toBe("https://example.com/nasa");
    expect(within(dialog).getByText("NASA update")).toBeTruthy();
    expect(globalStyles).toContain("article[data-short-id] > div > div:last-child");
    expect(globalStyles).toContain("bottom: 4.75rem;");
    expect(globalStyles).toContain("article[data-short-id] > div > div:last-child a");
    expect(globalStyles).toContain("order: 1;");
    expect(globalStyles).toContain("article[data-short-id] > div > div:last-child h3");
    expect(globalStyles).toContain("order: 2;");
    article.videoUrl = originalUrl;
    article.videoMimeType = originalMimeType;
  });

  it("remembers a YouTube player unmute action for the Shorts sound control", async () => {
    const first = mocks.allArticles[0] as { videoUrl: string | null; videoMimeType?: string | null };
    const originalUrl = first.videoUrl;
    const originalMimeType = first.videoMimeType;
    first.videoUrl = "https://www.youtube.com/embed/example";
    first.videoMimeType = "text/html";
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Open Shorts" }));
    const dialog = screen.getByRole("dialog", { name: "Video Shorts" });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Turn on Shorts sound" })).toBeTruthy());
    window.dispatchEvent(new MessageEvent("message", { origin: "https://www.youtube.com", data: JSON.stringify({ event: "infoDelivery", info: { muted: false } }) }));

    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Mute Shorts" }).getAttribute("aria-pressed")).toBe("true"));
    await waitFor(() => expect(localStorage.getItem("signalflow-shorts-sound")).toBe("on"));
    first.videoUrl = originalUrl;
    first.videoMimeType = originalMimeType;
  });

  it("starts a YouTube Short with sound when the reader has already enabled the saved preference", async () => {
    const first = mocks.allArticles[0] as { videoUrl: string | null; videoMimeType?: string | null };
    const originalUrl = first.videoUrl;
    const originalMimeType = first.videoMimeType;
    first.videoUrl = "https://www.youtube.com/embed/example";
    first.videoMimeType = "text/html";
    localStorage.setItem("signalflow-shorts-sound", "on");
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Open Shorts" }));
    const dialog = screen.getByRole("dialog", { name: "Video Shorts" });
    const frame = await within(dialog).findByTitle("Embedded feed video");

    expect((frame as HTMLIFrameElement).src).toContain("mute=0");
    expect(within(dialog).getByRole("button", { name: "Mute Shorts" }).getAttribute("aria-pressed")).toBe("true");
    first.videoUrl = originalUrl;
    first.videoMimeType = originalMimeType;
  });

  it("shows the Shorts empty state when the library has no playable video", () => {
    const originalVideos = mocks.allArticles.map((article) => article.videoUrl);
    mocks.allArticles.forEach((article) => { article.videoUrl = null; });
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Open Shorts" }));
    const dialog = screen.getByRole("dialog", { name: "Video Shorts" });

    expect(within(dialog).getByText("No videos in your feed yet")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Add a video source" })).toBeTruthy();
    expect(dialog.querySelectorAll("video")).toHaveLength(0);
    mocks.allArticles.forEach((article, index) => { article.videoUrl = originalVideos[index]; });
  });

  it("renders embeddable feed media in the article stream", () => {
    const article = mocks.allArticles[0] as { videoUrl: string | null; videoMimeType?: string | null };
    const originalUrl = article.videoUrl;
    const originalMimeType = article.videoMimeType;
    article.videoUrl = "https://www.youtube.com/embed/example";
    article.videoMimeType = "text/html";

    const { container } = render(<Home />);

    expect(container.querySelector('iframe[title="Embedded feed video"]')).toBeTruthy();
    article.videoUrl = originalUrl;
    article.videoMimeType = originalMimeType;
  });

  it("compacts the sticky source bar after the reader scrolls down the feed", async () => {
    render(<Home />);
    const sourceBar = screen.getByLabelText("Source category tabs").closest("[data-source-bar]") as HTMLElement;

    expect(sourceBar.dataset.compact).toBe("false");
    expect(within(sourceBar).getByText("Shorts")).toBeTruthy();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 128 });
    fireEvent.scroll(window);

    await waitFor(() => expect(sourceBar.dataset.compact).toBe("true"));
    expect(sourceBar.className).toContain("py-1.5");
    expect(within(sourceBar).queryByText("Shorts")).toBeNull();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  it("keeps the source tabs horizontally scrollable and selectable on a narrow screen", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    render(<Home />);

    expect(screen.getByLabelText("Source category tabs").className).toContain("overflow-x-auto");
    const redditTab = screen.getByRole("button", { name: "Show Reddit communities" });
    expect(redditTab.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(redditTab);

    await waitFor(() => expect(redditTab.getAttribute("aria-pressed")).toBe("true"));
    expect(screen.getByText("Reddit update")).toBeTruthy();
    expect(screen.queryByText("NASA update")).toBeNull();
  });

  it("opens the provider-community composer from the source-bar plus icon", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Create community post" }));

    const composer = screen.getByRole("dialog", { name: "Create community post" });
    expect(within(composer).getByRole("option", { name: "youtube.com" })).toBeTruthy();
    expect(within(composer).getByRole("option", { name: "reddit.com" })).toBeTruthy();
    expect(within(composer).getByPlaceholderText("Title")).toBeTruthy();
  });
});
