// Fictional incident written for the demo. No real company, people or data.
export const SAMPLE = `[13:52] deploy-bot: payments-api v2.41.0 deployed to prod (PR #1184 "move idempotency keys to redis cluster")
[14:03] pagerduty: ALERT firing: payments-api 5xx error rate 18% (threshold 2%)
[14:04] maya: ack, looking
[14:05] maya: checkout requests timing out, p99 latency 9.8s
[14:06] support-bot: 37 new support tickets in 5 min tagged "payment failed"
[14:07] dev: redis cluster CPU at 100% on shard 3, lots of KEYS calls in slowlog
[14:09] maya: the issue is the idempotency lookup in v2.41 uses KEYS idem:* to check duplicates, that's O(N) on a hot shard
[14:10] dev: rolling back payments-api to v2.40.2
[14:14] dev: rollback complete
[14:16] maya: error rate dropping, 4% now
[14:21] maya: back to normal, error rate 0.3%, latency p99 420ms
[14:22] sam: customers who retried during the window may have been double-charged? need to check
[14:35] sam: checked ledger: 0 duplicate captures, idempotency held at the DB constraint. 212 checkouts failed and were not charged
[14:40] maya: action item: add a lint rule banning KEYS in redis client code
[14:41] dev: follow up: load test idempotency path against a prod-sized keyspace before release
[14:42] sam: we should add a canary stage for payments-api so 5xx spikes stop a rollout automatically
[14:45] maya: resolved, closing the incident. postmortem owner: maya`;
