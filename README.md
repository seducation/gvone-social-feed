

## Production RSS refresh job

Signalflow has an active production background refresh job that runs every 30 minutes in UTC. It calls the authenticated callback `POST /api/scheduled/refresh-rss`, which refreshes all saved feeds and stores normalized articles for each owner.

| Property | Value |
|---|---|
| Job name | `refresh-rss-every-30-minutes` |
| Task UID | `MfdXLrB9XDTWU3vgSdDwQ5` |
| Cron expression | `0 */30 * * * *` |
| Callback | `POST /api/scheduled/refresh-rss` |
| Status | Enabled |
| Published domain | `https://rssgroupfeed-jaelvwfd.manus.space` |

To inspect the job, run `manus-heartbeat list`. To review recent executions, run `manus-heartbeat logs --task-uid MfdXLrB9XDTWU3vgSdDwQ5`. The job can be paused, resumed, updated, or deleted using the same task UID with the corresponding `manus-heartbeat` command.

## Feed import service errors

When an upstream feed or the application gateway returns a plain-text `502`, `503`, or `504` response, the importer does not expose a JSON parsing exception. The server normalizes feed-add failures to: **“The feed service is temporarily unavailable. Please try again in a moment.”** The client transport also converts non-JSON gateway responses into a tRPC-compatible JSON error, so the dashboard’s feed-add mutation surfaces the normalized message through its toast error state. Direct parser failures such as private feeds, ordinary web pages, and malformed XML retain their specific diagnostics.
