// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as shortsPlayback from "@/lib/shortsPlayback";

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
  toastSuccess: vi.fn(),
  invalidateDashboard: vi.fn().mockResolvedValue(undefined),
  invalidateArticles: vi.fn().mockResolvedValue(undefined),
  invalidateGroupArticles: vi.fn().mockResolvedValue(undefined),
  refreshAllOptions: undefined as { onSuccess?: (data: { attempted: number; refreshed: number }) => Promise<void> } | undefined,
  dashboardData: {
    feeds: [
      { id: 7, title: "NASA", customTitle: null, faviconUrl: null, url: "https://m.youtube.com/@NASA" },
      { id: 8, title: "Technology", customTitle: null, faviconUrl: null, url: "https://www.reddit.com/r/technology/.rss" },
      { id: 9, title: "CNN World", customTitle: null, faviconUrl: null, url: "https://rss.cnn.com/rss/edition_world.rss" },
    ],
    groups: [],
  },
  allArticles: [
    { id: 1, feedId: 7, title: "NASA update", link: "https://example.com/nasa", description: null, publishedAt: new Date("2026-08-19T08:00:00Z"), thumbnailUrl: null, videoUrl: "https://cdn.example.com/nasa.mp4" },
    { id: 2, feedId: 8, title: "Reddit update", link: "https://example.com/reddit", description: null, publishedAt: new Date("2026-08-19T07:00:00Z"), thumbnailUrl: null, videoUrl: null },
    { id: 3, feedId: 9, title: "CNN update", link: "https://example.com/cnn", description: null, publishedAt: new Date("2026-08-19T06:00:00Z"), thumbnailUrl: null, videoUrl: null },
  ],
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, loading: false, logout: vi.fn() }) }));
vi.mock("@/lib/feedError", () => ({ feedErrorMessage: (error: Error) => error.message }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ dashboard: { invalidate: mocks.invalidateDashboard }, feed: { articles: { invalidate: mocks.invalidateArticles } }, group: { articles: { invalidate: mocks.invalidateGroupArticles } } }),
    dashboard: { useQuery: () => ({ isLoading: false, data: mocks.dashboardData }) },
    feed: {
      articles: { useQuery: () => ({ data: mocks.allArticles }) },
      add: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      refresh: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      refreshAll: { useMutation: (options: typeof mocks.refreshAllOptions) => { mocks.refreshAllOptions = options; return { mutate: mocks.refreshAllMutate, isPending: false }; } },
      remove: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    group: {
      articles: { useQuery: () => ({ data: [] }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      refresh: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      rename: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    assignment: { list: { useQuery: () => ({ data: [] }) }, set: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
  },
}));

import Home from "./Home";

describe("dashboard reload refresh controls", () => {
  afterEach(() => {
    cleanup();
    mocks.refreshAllMutate.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.invalidateDashboard.mockClear();
    mocks.invalidateArticles.mockClear();
    mocks.invalidateGroupArticles.mockClear();
    mocks.refreshAllOptions = undefined;
    shortObserverCallback = undefined;
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
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

  it("creates a dedicated CNN domain channel rather than merging it into a generic website tab", async () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Show CNN" }));

    await waitFor(() => expect(screen.getByText("CNN update")).toBeTruthy());
    expect(screen.queryByText("NASA update")).toBeNull();
    expect(screen.queryByText("Reddit update")).toBeNull();
    expect(screen.getByText(/Stories from your saved CNN feeds/)).toBeTruthy();
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
});
