import type { Json, Scenario } from '../engine/types'

/**
 * SRE incident-triage agent. Three content variants:
 *  0 — SEV1 checkout-api p95 latency: bad deploy d4e91c2 22 min before the
 *      alert exhausts the pgbouncer pool; status-page gate reached
 *  1 — SEV3 background-jobs queue lag: nightly export batch grew 3.2x, no
 *      customer impact → jira ticket only, gate and sev1 nodes skipped
 *  2 — SEV1 payments-webhook 5xx spike: loki 429s once then succeeds;
 *      evidence split between a signing-secret rotation and a Stripe
 *      upstream incident; gate reached, statuspage succeeds on approval
 */

const INCIDENTS = [
  {
    label: 'P1 alert — p95 latency > 2s on checkout-api',
    incref: 'INC-2607',
    service: 'checkout-api',
    channel: 'inc-2607-checkout',
    component: 'Checkout',
    severity: 'critical',
    fired_at: '2026-07-02T14:54:31Z',
    dedup: 'chk-latency-p95-prod',
    normalized: {
      service: 'checkout-api',
      env: 'prod',
      metric: 'http_p95_latency_seconds',
      comparator: '>',
      threshold: 2.0,
      observed: 3.42,
      window: '5m',
      fingerprint: 'chk-latency-p95-prod',
      runbook: 'runbooks/checkout-latency.md',
    },
    logql: '{service="checkout-api", env="prod"} |= "error" | json | line_format "{{.msg}}"',
    logs: {
      total_hits: 1847,
      range: '15m',
      top_lines: [
        { line: 'pgbouncer: no more connections allowed (max_client_conn)', count: 1514 },
        { line: 'context deadline exceeded acquiring db connection', count: 291 },
        { line: 'checkout session save failed: pool timeout', count: 42 },
      ],
    },
    promql:
      'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="checkout-api"}[5m])) by (le))',
    metrics: {
      value: 3.42,
      unit: 's',
      baseline: 0.31,
      series: [
        { labels: { service: 'checkout-api', quantile: '0.95' }, value: 3.42 },
        { labels: { expr: 'pg_pool_active_connections / pg_pool_max_connections' }, value: 1.0 },
        { labels: { expr: 'sum(rate(http_requests_total{service="checkout-api"}[5m]))' }, value: 948 },
      ],
    },
    deploys: [
      {
        service: 'checkout-api',
        sha: 'd4e91c2',
        title: 'perf: shrink pgbouncer client pool 60 → 20',
        deployed_at: '2026-07-02T14:32:08Z',
        by: 'l.tanaka',
      },
      {
        service: 'checkout-api',
        sha: 'b7a3f19',
        title: 'fix: currency rounding on gift cards',
        deployed_at: '2026-07-02T08:11:26Z',
        by: 'a.moreau',
      },
      {
        service: 'cart-svc',
        sha: '91c0de4',
        title: 'chore: bump grpc client to 1.62',
        deployed_at: '2026-07-02T05:47:53Z',
        by: 'deploy-bot',
      },
    ],
    rcaPromptTokens: 2840,
    escalationPolicy: 'EP-CHECKOUT-PRIMARY',
    oncall: 'priya.natarajan',
    statusMessage:
      'We are investigating elevated latency on checkout. Some customers may experience slow page loads or timeouts when completing purchases. Payments already captured are not affected.',
  },
  {
    label: 'P3 alert — queue lag > 15m on background-jobs',
    incref: 'INC-2609',
    service: 'background-jobs',
    channel: 'inc-2609-background-jobs',
    component: 'Background processing',
    severity: 'warning',
    fired_at: '2026-07-02T02:29:04Z',
    dedup: 'bgjobs-queue-lag-reports',
    normalized: {
      service: 'background-jobs',
      env: 'prod',
      metric: 'sidekiq_queue_latency_seconds',
      comparator: '>',
      threshold: 900,
      observed: 1140,
      window: '30m',
      fingerprint: 'bgjobs-queue-lag-reports',
      runbook: 'runbooks/queue-lag.md',
    },
    logql: '{service="background-jobs", env="prod"} | json | level="warn"',
    logs: {
      total_hits: 214,
      range: '30m',
      top_lines: [
        { line: 'job exceeded soft timeout (report-export)', count: 178 },
        { line: 'retrying job after lock contention (report-export)', count: 36 },
      ],
    },
    promql: 'max_over_time(sidekiq_queue_latency_seconds{queue="reports"}[30m])',
    metrics: {
      value: 1140,
      unit: 's',
      baseline: 45,
      series: [
        { labels: { queue: 'reports' }, value: 1140 },
        { labels: { expr: 'sum(rate(sidekiq_jobs_processed_total[5m])) * 60' }, value: 62 },
        { labels: { expr: 'sidekiq_queue_depth{queue="reports"}' }, value: 8940 },
      ],
    },
    deploys: [
      {
        service: 'api-gateway',
        sha: '77d2c05',
        title: 'feat: per-tenant rate limits',
        deployed_at: '2026-07-01T21:40:12Z',
        by: 'deploy-bot',
      },
      {
        service: 'report-svc',
        sha: '3aa81fe',
        title: 'fix: csv header encoding',
        deployed_at: '2026-07-01T09:14:37Z',
        by: 'm.silva',
      },
      {
        service: 'background-jobs',
        sha: 'f8c22ba',
        title: 'chore: sidekiq 7.3 upgrade',
        deployed_at: '2026-06-30T13:02:44Z',
        by: 'k.osei',
      },
    ],
    rcaPromptTokens: 2260,
    escalationPolicy: 'EP-PLATFORM-PRIMARY',
    oncall: 'k.osei',
    statusMessage: '',
  },
  {
    label: 'P1 alert — 5xx rate > 5% on payments-webhook',
    incref: 'INC-2611',
    service: 'payments-webhook',
    channel: 'inc-2611-payments',
    component: 'Payments',
    severity: 'critical',
    fired_at: '2026-07-02T10:22:47Z',
    dedup: 'payments-webhook-5xx-ratio',
    normalized: {
      service: 'payments-webhook',
      env: 'prod',
      metric: 'http_5xx_ratio',
      comparator: '>',
      threshold: 0.05,
      observed: 0.083,
      window: '5m',
      fingerprint: 'payments-webhook-5xx-ratio',
      runbook: 'runbooks/payments-webhook-errors.md',
    },
    logql: '{service="payments-webhook", env="prod"} | json | status >= 500',
    logs: {
      total_hits: 3908,
      range: '10m',
      top_lines: [
        { line: 'upstream connect timeout to api.stripe.com after 10000ms', count: 2741 },
        { line: 'webhook signature verification failed: no matching signing secret', count: 1092 },
        { line: 'circuit breaker open: stripe-events', count: 75 },
      ],
    },
    promql:
      'sum(rate(http_requests_total{service="payments-webhook",code=~"5.."}[5m])) / sum(rate(http_requests_total{service="payments-webhook"}[5m]))',
    metrics: {
      value: 0.083,
      unit: 'ratio',
      baseline: 0.002,
      series: [
        { labels: { service: 'payments-webhook', code: '5xx' }, value: 0.083 },
        { labels: { expr: 'stripe_client_connect_timeouts_total rate[5m]' }, value: 4.6 },
        { labels: { expr: 'webhook_signature_failures_total rate[5m]' }, value: 1.8 },
      ],
    },
    deploys: [
      {
        service: 'payments-webhook',
        sha: 'a19f7c3',
        title: 'config: rotate Stripe webhook signing secret',
        deployed_at: '2026-07-02T09:41:12Z',
        by: 'sec-rotation-bot',
      },
      {
        service: 'edge-proxy',
        sha: '5b96aa0',
        title: 'chore: tls cert renewal',
        deployed_at: '2026-07-02T07:05:29Z',
        by: 'deploy-bot',
      },
      {
        service: 'payments-webhook',
        sha: 'c8d0f21',
        title: 'feat: idempotency keys on event ingest',
        deployed_at: '2026-07-01T16:20:55Z',
        by: 'd.eriksen',
      },
    ],
    rcaPromptTokens: 3120,
    escalationPolicy: 'EP-PAYMENTS-PRIMARY',
    oncall: 'd.eriksen',
    statusMessage:
      'We are investigating an elevated error rate affecting payment confirmations. Card charges may succeed while confirmation is delayed; no duplicate charges will occur. Updates every 15 minutes.',
  },
] as const

const RCA_TEXTS = [
  `The evidence converges on the 14:32 UTC deploy of checkout-api, sha d4e91c2 ("perf: shrink pgbouncer client pool 60 → 20"), 22 minutes before the alert fired. Loki returns 1,847 error lines in the last 15m and 1,514 of them are the same line: "pgbouncer: no more connections allowed (max_client_conn)". Metrics agree: pg_pool_active_connections / pg_pool_max_connections has been pinned at 1.00 since 14:33, and p95 latency stepped from its 0.31s baseline to 3.42s in the same minute — a step change, not a drift, which rules out organic traffic (request rate is flat at ~948 rps). The two older deploys, b7a3f19 and 91c0de4, predate the inflection by 6+ hours and touch unrelated paths. Conclusion: connection-pool exhaustion introduced by d4e91c2. Recommended action: roll back d4e91c2 immediately; latency should recover within one pool-recycle interval (~90s). This is customer-facing checkout degradation — treat as SEV1.`,
  `The lag is real but bounded. max_over_time(sidekiq_queue_latency_seconds{queue="reports"}[30m]) peaked at 1,140s against a 45s baseline, yet throughput is unchanged at ~62 jobs/min and queue depth (8,940) is draining — workers are healthy, the backlog is demand-driven. Loki shows only 214 warn lines in 30m, 178 of them "job exceeded soft timeout (report-export)", and zero error-level lines; no 5xx anywhere in the stack. Deploy history clears the code path: the last background-jobs deploy (f8c22ba, sidekiq 7.3 upgrade) shipped two days ago and the queue was flat until 02:10 UTC today — exactly when the nightly report-export batch started, 3.2x larger than yesterday after the Northwind enterprise onboarding added ~40k report rows. No customer-facing surface is affected and SLO burn is negligible. Conclusion: capacity lag, not a fault. File a ticket to shard the reports queue and raise worker concurrency from 8 to 16. Severity: SEV3.`,
  `The evidence splits two ways. Loki shows 3,908 5xx lines on payments-webhook in 10m, clustering into two distinct failures: 2,741 × "upstream connect timeout to api.stripe.com after 10000ms" and 1,092 × "webhook signature verification failed: no matching signing secret". The signature failures began at 09:41 UTC — exactly when config change a19f7c3 ("rotate Stripe webhook signing secret") landed, 41 minutes before the alert — so that share is self-inflicted. The connect timeouts, however, predate the rotation by ~6 minutes, and Stripe's status feed has reported "elevated API errors" since 09:35, which points upstream. The blended error ratio is 8.3% against a 0.2% baseline, so customers are seeing failed payment confirmations either way. I cannot attribute this to a single cause: roll back a19f7c3 to eliminate the self-inflicted 28%, and track the Stripe incident for the remaining 72%. Customer-facing payment impact — treat as SEV1.`,
]

const POSTMORTEM_TEXTS = [
  `INC-2607 (SEV1, checkout-api): deploy d4e91c2 shrank the pgbouncer client pool from 60 to 20 at 14:32 UTC; the pool saturated within a minute and p95 latency rose from 0.31s to 3.42s. Detection to page: 4 minutes. Mitigation: rollback of d4e91c2. Follow-ups: pool-saturation alert at 85%, require load-test evidence on pool-sizing changes, document the rollback runbook in #eng-checkout.`,
  `INC-2609 (SEV3, background-jobs): reports queue lag peaked at 19 minutes after the nightly report-export batch grew 3.2x following the Northwind onboarding. No customer-facing impact; workers healthy throughout (62 jobs/min). Ticket OPS-4142 filed to shard the reports queue and raise worker concurrency from 8 to 16. Follow-up: forecast queue depth from tenant row counts ahead of large onboardings.`,
  `INC-2611 (SEV1, payments-webhook): compound failure — signing-secret rotation a19f7c3 broke signature verification (1,092 rejects) while a concurrent Stripe API incident drove 2,741 connect timeouts; blended 8.3% error rate. Mitigations: a19f7c3 rolled back, Stripe incident tracked in war room #inc-2611-payments. Follow-ups: dual-secret grace window for rotations, upstream-status probe in alert annotations, retry-queue drain runbook.`,
]

export const incidentTriageScenario: Scenario = {
  id: 'incident-triage',
  name: 'Incident triage',
  tagline: 'SRE · PagerDuty → Slack',
  variants: 3,
  nodes: [
    { id: 't_alert', kind: 'trigger', label: 'Alert fired', sub: 'pagerduty · webhook' },
    { id: 'n_norm', kind: 'tool', label: 'Normalize alert', sub: 'alerts.parse' },
    { id: 'n_logs', kind: 'tool', label: 'Query logs', sub: 'logs.query' },
    { id: 'n_metrics', kind: 'tool', label: 'Query metrics', sub: 'metrics.query' },
    { id: 'n_deploys', kind: 'tool', label: 'Recent deploys', sub: 'deploys.recent' },
    { id: 'n_rca', kind: 'llm', label: 'Root-cause analyst', sub: 'claude-sonnet-5' },
    { id: 'n_sev', kind: 'guardrail', label: 'Severity policy', sub: 'impact · burn · blast radius' },
    { id: 'n_route', kind: 'router', label: 'Severity route', sub: 'sev1 vs sev3' },
    { id: 'n_page', kind: 'tool', label: 'Page on-call', sub: 'pagerduty.escalate' },
    { id: 'n_warroom', kind: 'tool', label: 'Create war room', sub: 'slack.channels.create' },
    { id: 'n_gate', kind: 'approval', label: 'Update public status page', sub: 'public comms' },
    { id: 'n_status', kind: 'tool', label: 'Post status incident', sub: 'statuspage.incidents.create' },
    { id: 'n_jira', kind: 'tool', label: 'File ticket', sub: 'jira.issues.create' },
    { id: 'n_pm', kind: 'llm', label: 'Postmortem draft', sub: 'claude-haiku-4-5' },
    { id: 'n_done', kind: 'output', label: 'Triage complete', sub: 'incident handed off' },
  ],
  edges: [
    { id: 'e1', source: 't_alert', target: 'n_norm' },
    { id: 'e2', source: 'n_norm', target: 'n_logs' },
    { id: 'e3', source: 'n_norm', target: 'n_metrics' },
    { id: 'e4', source: 'n_norm', target: 'n_deploys' },
    { id: 'e5', source: 'n_logs', target: 'n_rca' },
    { id: 'e6', source: 'n_metrics', target: 'n_rca' },
    { id: 'e7', source: 'n_deploys', target: 'n_rca' },
    { id: 'e8', source: 'n_rca', target: 'n_sev' },
    { id: 'e9', source: 'n_sev', target: 'n_route' },
    { id: 'e10', source: 'n_route', target: 'n_page', label: 'sev1' },
    { id: 'e11', source: 'n_route', target: 'n_warroom', label: 'sev1' },
    { id: 'e12', source: 'n_page', target: 'n_gate' },
    { id: 'e13', source: 'n_warroom', target: 'n_gate' },
    { id: 'e14', source: 'n_gate', target: 'n_status' },
    { id: 'e15', source: 'n_route', target: 'n_jira', label: 'sev3' },
    { id: 'e16', source: 'n_status', target: 'n_pm' },
    { id: 'e17', source: 'n_jira', target: 'n_pm' },
    { id: 'e18', source: 'n_pm', target: 'n_done' },
  ],

  script(b, { rng, variant }) {
    const I = INCIDENTS[variant]
    const sev1 = variant !== 1

    b.trigger('t_alert', {
      label: I.label,
      payload: {
        event_action: 'trigger',
        alert_id: `PD-${I.incref.slice(-4)}X`,
        summary: I.label.replace(/^P\d alert — /, ''),
        source: 'prometheus/alertmanager',
        severity: I.severity,
        dedup_key: I.dedup,
        fired_at: I.fired_at,
      },
    })

    b.tool('n_norm', {
      tool: 'alerts.parse',
      args: { dedup_key: I.dedup, source: 'pagerduty', schema: 'alert.v2' },
      ms: rng.int(140, 260),
      result: I.normalized as unknown as Json,
    })

    // ---- parallel evidence gathering
    b.parallel([
      () =>
        b.tool('n_logs', {
          tool: 'logs.query',
          args: { query: I.logql, range: I.logs.range, limit: 1000, direction: 'backward' },
          ms: rng.int(620, 1100),
          failures:
            variant === 2
              ? {
                  count: 1,
                  reason: '429 too many requests — loki query rate limit',
                  result: { error: { code: 429, message: 'too many requests', retry_after_s: 2 } },
                }
              : undefined,
          result: {
            total_hits: I.logs.total_hits,
            range: I.logs.range,
            top_lines: I.logs.top_lines as unknown as Json,
            sampled: false,
          },
        }),
      () =>
        b.tool('n_metrics', {
          tool: 'metrics.query',
          args: { query: I.promql, window: I.normalized.window, step: '30s' },
          ms: rng.int(340, 620),
          result: {
            value: I.metrics.value,
            unit: I.metrics.unit,
            baseline_7d: I.metrics.baseline,
            series: I.metrics.series as unknown as Json,
          },
        }),
      () =>
        b.tool('n_deploys', {
          tool: 'deploys.recent',
          args: { env: 'prod', window: '48h', limit: 3, related_to: I.service },
          ms: rng.int(220, 420),
          result: I.deploys as unknown as Json,
        }),
    ])

    b.llm('n_rca', {
      model: 'claude-sonnet-5',
      promptTokens: I.rcaPromptTokens,
      firstTokenMs: rng.int(900, 1600),
      text: RCA_TEXTS[variant],
      output: {
        severity: sev1 ? 'sev1' : 'sev3',
        suspected_cause:
          variant === 0
            ? 'connection-pool exhaustion — deploy d4e91c2'
            : variant === 1
              ? 'demand-driven queue lag — report-export batch 3.2x'
              : 'split: secret rotation a19f7c3 + Stripe upstream incident',
        confidence: variant === 2 ? 'split' : 'high',
        recommended_action:
          variant === 0
            ? 'rollback d4e91c2'
            : variant === 1
              ? 'shard reports queue, raise concurrency 8 → 16'
              : 'rollback a19f7c3, track Stripe incident',
      },
    })

    b.guardrail('n_sev', {
      checks: [
        { name: 'no customer-facing impact', pass: !sev1 },
        { name: 'error budget burn < 4x', pass: !sev1 },
        { name: 'single-service blast radius', pass: true },
        ...(variant === 2 ? [{ name: 'no concurrent upstream incident', pass: false }] : []),
      ],
    })

    b.router('n_route', { decision: sev1 ? 'sev1 · page + war room' : 'sev3 · ticket only' })

    if (sev1) {
      // ---- SEV1: page on-call and open a war room in parallel
      b.parallel([
        () =>
          b.tool('n_page', {
            tool: 'pagerduty.escalate',
            args: {
              incident_key: I.incref,
              escalation_policy: I.escalationPolicy,
              urgency: 'high',
              note: `auto-triage: ${I.normalized.metric} ${I.normalized.comparator} ${I.normalized.threshold}`,
            },
            ms: rng.int(380, 640),
            result: {
              status: 'triggered',
              assigned_to: I.oncall,
              escalation_level: 1,
              incident_url: `https://acme.pagerduty.com/incidents/${I.incref}`,
            },
          }),
        () =>
          b.tool('n_warroom', {
            tool: 'slack.channels.create',
            args: {
              name: I.channel,
              topic: `${I.incref} · ${I.service} · commander: ${I.oncall}`,
              invite: [I.oncall, 'sre-oncall-secondary', 'comms-duty'],
            },
            ms: rng.int(420, 700),
            result: { channel_id: `C09${I.incref.slice(-4)}KQ`, name: `#${I.channel}`, members_invited: 3 },
          }),
      ])

      // ---- human gate: public status page update
      const gate = b.approval('n_gate', {
        gate: `statuspage-${I.incref}`,
        title: `Update public status page — ${I.component}`,
        reason:
          variant === 2
            ? 'SEV1 with customer-facing payment impact; root cause is split between an internal config change and a Stripe upstream incident — public wording needs review.'
            : 'SEV1 with customer-facing checkout impact; status page changes are visible to all customers and require sign-off.',
        current: {
          statuspage: {
            component: I.component,
            status: 'operational',
            incident_message: null,
          },
        },
        proposed: {
          statuspage: {
            component: I.component,
            status: 'degraded_performance',
            incident_message: I.statusMessage,
          },
        },
      })

      if (gate.decision === 'rejected') {
        b.skip('n_status', 'gate rejected')
        b.skip('n_jira', 'sev1 path')
        b.skip('n_pm', 'gate rejected')
        b.fail('status page update rejected', 'rejected')
      }
      let statusMessage: string = I.statusMessage
      const edited = (gate.finalState as { statuspage?: { incident_message?: string } })?.statuspage
      if (typeof edited?.incident_message === 'string') statusMessage = edited.incident_message

      b.tool('n_status', {
        tool: 'statuspage.incidents.create',
        args: {
          component: I.component,
          component_status: 'degraded_performance',
          impact: 'major',
          name: `${I.component} — degraded performance`,
          body: statusMessage,
          notify_subscribers: true,
        },
        ms: rng.int(460, 780),
        result: {
          id: `sp_${I.incref.toLowerCase()}`,
          status: 'investigating',
          shortlink: `https://stspg.io/${I.incref.slice(-4).toLowerCase()}q`,
          subscribers_notified: 1284,
        },
      })

      b.skip('n_jira', 'sev1 · tracked via incident process')
    } else {
      // ---- SEV3: ticket only, no paging, no public comms
      b.skip('n_page', 'sev3 · paging not required')
      b.skip('n_warroom', 'sev3 · no war room')
      b.skip('n_gate', 'sev3 · status page unchanged')
      b.skip('n_status', 'sev3 · status page unchanged')

      b.tool('n_jira', {
        tool: 'jira.issues.create',
        args: {
          project: 'OPS',
          issue_type: 'Task',
          priority: 'Medium',
          summary: `Shard reports queue — lag hit 19m during nightly export (${I.incref})`,
          labels: ['incident-followup', 'sev3', I.service],
        },
        ms: rng.int(380, 620),
        result: {
          key: 'OPS-4142',
          url: 'https://acme.atlassian.net/browse/OPS-4142',
          status: 'To Do',
        },
      })
    }

    b.llm('n_pm', {
      model: 'claude-haiku-4-5',
      promptTokens: 1480,
      firstTokenMs: rng.int(420, 780),
      text: POSTMORTEM_TEXTS[variant],
      output: {
        incident: I.incref,
        severity: sev1 ? 'sev1' : 'sev3',
        doc: `postmortems/${I.incref.toLowerCase()}-${I.service}.md`,
      },
    })

    b.output('n_done', {
      label: sev1
        ? `Triage complete — ${I.incref} SEV1 declared`
        : `Triage complete — ${I.incref} SEV3, ticket filed`,
      payload: {
        incident: I.incref,
        service: I.service,
        severity: sev1 ? 'sev1' : 'sev3',
        war_room: sev1 ? `#${I.channel}` : null,
        ticket: sev1 ? null : 'OPS-4142',
      },
    })
  },
}
