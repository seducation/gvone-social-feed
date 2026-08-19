import { describe, expect, it, vi } from "vitest";
import { pauseEmbeddedShort, syncShortPlayback } from "./shortsPlayback";

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

  it("sends a pause command to an off-screen embedded player", () => {
    const postMessage = vi.fn();
    pauseEmbeddedShort({ contentWindow: { postMessage } } as unknown as HTMLIFrameElement);

    expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ event: "command", func: "pauseVideo", args: "" }), "*");
  });
});
