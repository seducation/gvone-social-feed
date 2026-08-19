export type ShortVideoPlayer = {
  muted: boolean;
  pause: () => void;
  play: () => Promise<void> | void;
};

export type ShortPlaybackOptions = {
  soundEnabled?: boolean;
};

export function syncShortPlayback(players: Map<number, ShortVideoPlayer>, activeId: number | null, { soundEnabled = false }: ShortPlaybackOptions = {}) {
  for (const [id, player] of Array.from(players.entries())) {
    if (id !== activeId) {
      player.pause();
      continue;
    }
    player.muted = !soundEnabled;
    Promise.resolve(player.play()).catch(() => undefined);
  }
}

function sendEmbeddedShortCommand(iframe: HTMLIFrameElement | undefined, func: "mute" | "unMute" | "pauseVideo" | "playVideo") {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: "" }), "*");
}

export function pauseEmbeddedShort(iframe: HTMLIFrameElement | undefined) {
  sendEmbeddedShortCommand(iframe, "pauseVideo");
}

export function playEmbeddedShort(iframe: HTMLIFrameElement | undefined) {
  sendEmbeddedShortCommand(iframe, "playVideo");
}

export function setEmbeddedShortMuted(iframe: HTMLIFrameElement | undefined, muted: boolean) {
  sendEmbeddedShortCommand(iframe, muted ? "mute" : "unMute");
}
