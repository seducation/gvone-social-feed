import { describe, expect, it, vi } from "vitest";
import { pauseEmbeddedShort, playEmbeddedShort, setEmbeddedShortMuted, syncShortPlayback } from "./shortsPlayback";

describe("syncShortPlayback", () => {
  it("plays only the active Short and pauses every off-screen video", () => {
    const first = { muted: false, play: vi.fn(), pause: vi.fn() };
    const second = { muted: false, play: vi.fn(), pause: vi.fn() };

    syncShortPlayback(new Map([[1, first], [2, second]]), 2);

    expect(first.pause).toHaveBeenCalledTimes(1);
    expect(first.play).not.toHaveBeenCalled();
    expect(second.pause).not.toHaveBeenCalled();
    expect(second.play).toHaveBeenCalledTimes(1);
    expect(second.muted).toBe(true);
  });

  it("pauses every video when the Shorts view is closed", () => {
    const first = { muted: false, play: vi.fn(), pause: vi.fn() };
    const second = { muted: false, play: vi.fn(), pause: vi.fn() };

    syncShortPlayback(new Map([[1, first], [2, second]]), null);

    expect(first.pause).toHaveBeenCalledTimes(1);
    expect(second.pause).toHaveBeenCalledTimes(1);
  });

  it("keeps sound on for the newly active native Short after the reader unmutes one video", () => {
    const first = { muted: true, play: vi.fn(), pause: vi.fn() };
    const second = { muted: true, play: vi.fn(), pause: vi.fn() };

    syncShortPlayback(new Map([[1, first], [2, second]]), 2, { soundEnabled: true });

    expect(first.pause).toHaveBeenCalledTimes(1);
    expect(second.play).toHaveBeenCalledTimes(1);
    expect(second.muted).toBe(false);
  });

  it("sends a pause command to an off-screen embedded player", () => {
    const postMessage = vi.fn();
    pauseEmbeddedShort({ contentWindow: { postMessage } } as unknown as HTMLIFrameElement);

    expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ event: "command", func: "pauseVideo", args: "" }), "*");
  });

  it("starts and unmutes an embedded Short when sound is enabled", () => {
    const postMessage = vi.fn();
    const iframe = { contentWindow: { postMessage } } as unknown as HTMLIFrameElement;

    playEmbeddedShort(iframe);
    setEmbeddedShortMuted(iframe, false);

    expect(postMessage).toHaveBeenNthCalledWith(1, JSON.stringify({ event: "command", func: "playVideo", args: "" }), "*");
    expect(postMessage).toHaveBeenNthCalledWith(2, JSON.stringify({ event: "command", func: "unMute", args: "" }), "*");
  });
});
