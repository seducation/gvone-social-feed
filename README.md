

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
