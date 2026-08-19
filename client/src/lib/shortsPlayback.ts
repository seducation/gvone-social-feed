export type ShortVideoPlayer = {
  muted: boolean;
  pause: () => void;
  play: () => Promise<void> | void;
};

export function syncShortPlayback(players: Map<number, ShortVideoPlayer>, activeId: number | null) {
  for (const [id, player] of Array.from(players.entries())) {
    if (id !== activeId) {
      player.pause();
      continue;
    }
    player.muted = true;
    Promise.resolve(player.play()).catch(() => undefined);
  }
}

export function pauseEmbeddedShort(iframe: HTMLIFrameElement | undefined) {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: "" }), "*");
}
