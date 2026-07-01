import type { Json, Scenario } from '../engine/types'

/**
 * Customer support refund agent. Three content variants:
 *  0 — $312.50 damaged item: approval gate, one Stripe 429 retry, success
 *  1 — $89.00 late delivery: under the $200 gate threshold, gate skipped
 *  2 — $1,240.00 bulk order flagged by policy checks: gate; if approved the
 *      Stripe refund keeps failing (disputed charge lock) and the run fails
 */

const TICKETS = [
  {
    label: 'Refund request — order #SHP-10482 · $312.50',
    ticket: 'ZD-48213',
    customer: { name: 'Maren Voss', email: 'maren.voss@fastmail.com', ltv: 1840, orders: 11 },
    order: {
      id: '#SHP-10482',
      total: 312.5,
      items: [{ sku: 'ESP-PRO-2', title: 'Espresso Machine Pro', qty: 1, price: 312.5 }],
      placed_at: '2026-06-24T09:12:44Z',
      shipped_via: 'DHL Express',
    },
    complaint:
      'Package arrived with the machine housing cracked and the portafilter snapped in half. I need this refunded, not replaced — I already bought a different one locally.',
    amount: 312.5,
    reason: 'damaged_in_transit',
  },
  {
    label: 'Refund request — order #SHP-10516 · $89.00',
    ticket: 'ZD-48377',
    customer: { name: 'Jonah Petit', email: 'j.petit@proton.me', ltv: 240, orders: 2 },
    order: {
      id: '#SHP-10516',
      total: 89.0,
      items: [{ sku: 'GRD-BURR-1', title: 'Burr Grinder Compact', qty: 1, price: 89.0 }],
      placed_at: '2026-06-27T18:03:10Z',
      shipped_via: 'UPS Ground',
    },
    complaint:
      'Ordered with 2-day shipping for a birthday gift, it showed up nine days later. The occasion is gone. I would like my money back.',
    amount: 89.0,
    reason: 'late_delivery',
  },
  {
    label: 'Refund request — order #SHP-10230 · $1,240.00',
    ticket: 'ZD-47902',
    customer: { name: 'R. Okafor (Beanhouse LLC)', email: 'ops@beanhouse.coffee', ltv: 6120, orders: 4 },
    order: {
      id: '#SHP-10230',
      total: 1240.0,
      items: [{ sku: 'ESP-PRO-2', title: 'Espresso Machine Pro', qty: 4, price: 310.0 }],
      placed_at: '2026-06-12T11:40:02Z',
      shipped_via: 'Freight',
    },
    complaint:
      'All four units pull inconsistent shots, we suspect a bad production batch. We want a full refund on the order, we are switching suppliers.',
    amount: 1240.0,
    reason: 'quality_dispute',
  },
] as const

const REASONER_TEXTS = [
  `Order #SHP-10482 qualifies for a full refund under policy §4.2 (carrier damage). The DHL scan history shows a "package damaged" exception at the Leipzig hub, which independently corroborates the customer's photos. Customer LTV is $1,840 across 11 orders with zero prior refunds — no abuse signal. Replacement was explicitly declined, so the correct resolution is a full refund of $312.50 to the original payment method plus a shipping-fee reversal. Because the amount exceeds the $200 auto-approval ceiling, this requires human sign-off before execution.`,
  `Order #SHP-10516 arrived 7 days past the paid 2-day SLA — a clear §3.1 service failure. The paid shipping tier obligates us to refund at minimum the shipping fee; given the missed occasion and the low order value, the goodwill matrix recommends a full refund of $89.00. Amount is under the $200 auto-approval ceiling, so no human gate is required. Recommend issuing to original payment method and flagging the UPS lane for SLA review.`,
  `Order #SHP-10230 is a $1,240 B2B quality dispute across 4 units of ESP-PRO-2. Policy checks flagged two risk signals: a prior refund on this account in the last 90 days and a batch-level dispute already open for SKU ESP-PRO-2. §6.4 requires human review for batch-defect claims above $500 because a unilateral refund here concedes the batch defect for all open disputes. Recommending full refund contingent on reviewer approval, with RMA pickup of all four units and escalation of batch QA-2611 to engineering.`,
]

const REPLY_TEXTS = [
  `Hi Maren, I'm really sorry your espresso machine arrived damaged — that's on us and our carrier. I've issued a full refund of $312.50 to your original payment method; you should see it within 3–5 business days. No need to ship the damaged unit back. As a small apology, I've also reversed the shipping fee. Thank you for giving us the details and photos so quickly.`,
  `Hi Jonah, you're completely right — nine days on a 2-day shipping promise isn't acceptable, especially for a gift. I've refunded the full $89.00 to your original payment method (3–5 business days). I'm also flagging this delivery lane to our logistics team so it doesn't happen again. I'm sorry we missed the occasion.`,
  `Hello, thank you for the detailed report on the four ESP-PRO-2 units. We've processed the full $1,240.00 refund and scheduled a freight pickup for the affected machines. Our QA team is opening an investigation into the production batch, and we'd value a short call to capture your shot-consistency data. A specialist will reach out within one business day.`,
]

export const refundScenario: Scenario = {
  id: 'refund',
  name: 'Refund agent',
  tagline: 'Customer support · Zendesk → Stripe',
  variants: 3,
  nodes: [
    { id: 't_ticket', kind: 'trigger', label: 'Ticket received', sub: 'zendesk · webhook' },
    { id: 'n_classify', kind: 'llm', label: 'Intent classifier', sub: 'claude-haiku-4-5' },
    { id: 'n_route', kind: 'router', label: 'Refund route', sub: 'intent == refund' },
    { id: 'n_order', kind: 'tool', label: 'Fetch order', sub: 'shopify.orders.get' },
    { id: 'n_customer', kind: 'tool', label: 'Customer lookup', sub: 'crm.contacts.find' },
    { id: 'n_checks', kind: 'guardrail', label: 'Policy checks', sub: 'fraud · window · history' },
    { id: 'n_reason', kind: 'llm', label: 'Refund reasoner', sub: 'claude-sonnet-5' },
    { id: 'n_calc', kind: 'tool', label: 'Compute refund', sub: 'billing.refunds.quote' },
    { id: 'n_gate', kind: 'approval', label: 'Human approval', sub: 'amount > $200' },
    { id: 'n_stripe', kind: 'tool', label: 'Issue refund', sub: 'stripe.refunds.create' },
    { id: 'n_reply', kind: 'llm', label: 'Draft reply', sub: 'claude-sonnet-5' },
    { id: 'n_send', kind: 'tool', label: 'Send email', sub: 'postmark.messages.send' },
    { id: 'n_done', kind: 'output', label: 'Resolved', sub: 'ticket closed' },
  ],
  edges: [
    { id: 'e1', source: 't_ticket', target: 'n_classify' },
    { id: 'e2', source: 'n_classify', target: 'n_route' },
    { id: 'e3', source: 'n_route', target: 'n_order', label: 'refund' },
    { id: 'e4', source: 'n_route', target: 'n_customer', label: 'refund' },
    { id: 'e5', source: 'n_order', target: 'n_checks' },
    { id: 'e6', source: 'n_customer', target: 'n_checks' },
    { id: 'e7', source: 'n_checks', target: 'n_reason' },
    { id: 'e8', source: 'n_reason', target: 'n_calc' },
    { id: 'e9', source: 'n_calc', target: 'n_gate' },
    { id: 'e10', source: 'n_gate', target: 'n_stripe' },
    { id: 'e11', source: 'n_stripe', target: 'n_reply' },
    { id: 'e12', source: 'n_reply', target: 'n_send' },
    { id: 'e13', source: 'n_send', target: 'n_done' },
  ],

  script(b, { rng, variant }) {
    const T = TICKETS[variant]

    b.trigger('t_ticket', {
      label: T.label,
      payload: {
        ticket_id: T.ticket,
        channel: 'email',
        subject: T.label,
        body: T.complaint,
        requester: T.customer.email,
      },
    })

    b.llm('n_classify', {
      model: 'claude-haiku-4-5',
      promptTokens: 610,
      firstTokenMs: rng.int(380, 700),
      text: `{"intent":"refund","order_ref":"${T.order.id}","sentiment":"${variant === 1 ? 'frustrated' : 'negative'}","urgency":"${variant === 2 ? 'high' : 'normal'}","reason_hint":"${T.reason}"}`,
      output: { intent: 'refund', order_ref: T.order.id, reason_hint: T.reason },
    })

    b.router('n_route', { decision: 'refund path' })

    b.parallel([
      () =>
        b.tool('n_order', {
          tool: 'shopify.orders.get',
          args: { order_id: T.order.id, expand: ['line_items', 'fulfillments'] },
          ms: rng.int(320, 520),
          result: T.order as unknown as Json,
        }),
      () =>
        b.tool('n_customer', {
          tool: 'crm.contacts.find',
          args: { email: T.customer.email },
          ms: rng.int(240, 430),
          result: {
            name: T.customer.name,
            lifetime_value: T.customer.ltv,
            orders: T.customer.orders,
            refunds_90d: variant === 2 ? 1 : 0,
            segment: variant === 2 ? 'b2b' : 'retail',
          },
        }),
    ])

    b.guardrail('n_checks', {
      checks: [
        { name: 'fraud score < 0.35', pass: true },
        { name: 'inside 30-day window', pass: true },
        { name: 'no prior refunds / 90d', pass: variant !== 2 },
        ...(variant === 2 ? [{ name: 'no open batch dispute', pass: false }] : []),
      ],
    })

    b.llm('n_reason', {
      model: 'claude-sonnet-5',
      promptTokens: 2240,
      text: REASONER_TEXTS[variant],
      output: {
        resolution: 'full_refund',
        amount: T.amount,
        requires_approval: T.amount > 200,
      },
    })

    b.tool('n_calc', {
      tool: 'billing.refunds.quote',
      args: { order_id: T.order.id, type: 'full', reason: T.reason },
      ms: rng.int(180, 320),
      result: {
        amount: T.amount,
        currency: 'USD',
        method: 'original_payment',
        fees_reversed: variant === 0,
        tax_adjustment: Number((T.amount * 0.0825).toFixed(2)),
      },
    })

    // ---- human gate: only for amounts above the auto-approval ceiling
    let approvedAmount: number = T.amount
    if (T.amount > 200) {
      const gate = b.approval('n_gate', {
        gate: `refund-${T.ticket}`,
        title: `Approve $${T.amount.toFixed(2)} refund`,
        reason:
          variant === 2
            ? 'Amount exceeds $200 ceiling and policy checks flagged: prior refund in 90d, open batch dispute on SKU ESP-PRO-2.'
            : 'Amount exceeds the $200 auto-approval ceiling.',
        current: {
          ticket: { id: T.ticket, status: 'open', assignee: 'agent:refund-bot' },
          refund: null,
          customer_notice: null,
        },
        proposed: {
          ticket: { id: T.ticket, status: 'pending_refund', assignee: 'agent:refund-bot' },
          refund: {
            order_id: T.order.id,
            amount: T.amount,
            currency: 'USD',
            method: 'original_payment',
            reason: T.reason,
            fees_reversed: variant === 0,
          },
          customer_notice: 'email',
        },
      })

      if (gate.decision === 'rejected') {
        b.skip('n_stripe', 'gate rejected')
        b.skip('n_reply', 'gate rejected')
        b.skip('n_send', 'gate rejected')
        b.fail('refund rejected by reviewer', 'rejected')
      }
      const editedRefund = (gate.finalState as { refund?: { amount?: number } })?.refund
      if (typeof editedRefund?.amount === 'number') approvedAmount = editedRefund.amount
    } else {
      b.skip('n_gate', 'auto-approved · under $200 ceiling')
    }

    // ---- execute refund
    const stripeOk = b.tool('n_stripe', {
      tool: 'stripe.refunds.create',
      args: {
        charge: `ch_3PkQ${T.ticket.slice(-4)}xK2`,
        amount: Math.round(approvedAmount * 100),
        currency: 'usd',
        reason: 'requested_by_customer',
        metadata: { ticket: T.ticket, order: T.order.id },
      },
      ms: rng.int(420, 760),
      failures:
        variant === 0
          ? { count: 1, reason: '429 rate_limited — retry-after 2s', result: { error: { code: 'rate_limited' } } }
          : variant === 2
            ? {
                count: 3,
                reason: 'charge_disputed — refund locked while dispute is open',
                result: { error: { code: 'charge_disputed', doc: 'stripe.com/docs/disputes' } },
              }
            : undefined,
      result: {
        id: `re_3Pk${T.ticket.slice(-4)}Qb`,
        status: 'succeeded',
        amount: Math.round(approvedAmount * 100),
        currency: 'usd',
        balance_transaction: 'txn_1PkQqX2eZvKYlo2C',
      },
    })

    if (!stripeOk) {
      b.skip('n_reply', 'refund not issued')
      b.skip('n_send', 'refund not issued')
      b.fail('stripe refund failed after 3 attempts — charge is disputed')
    }

    b.llm('n_reply', {
      model: 'claude-sonnet-5',
      promptTokens: 1180,
      text: REPLY_TEXTS[variant],
      output: { to: T.customer.email, subject: `Re: ${T.label}` },
    })

    b.tool('n_send', {
      tool: 'postmark.messages.send',
      args: { to: T.customer.email, template: 'refund-confirmation', stream: 'outbound' },
      ms: rng.int(260, 440),
      result: { message_id: `pm_${T.ticket.toLowerCase()}`, status: 'sent' },
    })

    b.output('n_done', {
      label: `Resolved — $${approvedAmount.toFixed(2)} refunded`,
      payload: { ticket: T.ticket, resolution: 'refunded', amount: approvedAmount },
    })
  },
}
