# YouTube channel feed investigation

The provided NASA channel page `https://m.youtube.com/@NASA` resolves to the canonical channel URL and exposes channel ID `UCLA_DiR1FfKNvjuUpBHmylQ` in its canonical metadata. The legacy endpoint `https://www.youtube.com/feeds/videos.xml?channel_id=UCLA_DiR1FfKNvjuUpBHmylQ` currently returns HTTP 404 with `server: YouTube RSS Feeds server` and an HTML error body in this environment.

Current web research indicates that YouTube channel RSS endpoints can return intermittent or broad 404 failures, and the legacy endpoint is not reliable as the sole integration path. Relevant sources include [Google AI Developers Community](https://discuss.ai.google.dev/t/youtube-rss-feed-endpoint-returns-404-errors/113379), [n8n Community](https://community.n8n.io/t/youtube-rss-feed-endpoint-returns-404-errors/241692?tl=en), [RSS-Bridge issue #2113](https://github.com/RSS-Bridge/rss-bridge/issues/2113), and the [YouTube Data API channels documentation](https://developers.google.com/youtube/v3/docs/channels).

The implementation should therefore retain the legacy feed attempt, detect a 404 specifically for YouTube, and fall back to parsing the public channel page or a supported uploads source rather than treating the channel URL as a normal RSS feed.
