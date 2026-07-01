import type { Json, Scenario } from '../engine/types'

/**
 * Sales-ops lead enrichment agent. Webflow demo-request form → CRM dedup →
 * parallel enrichment (company / person / news) → research summary → scoring
 * → outreach gate or nurture. Three content variants:
 *  0 — Series-A fintech CTO (Kernwave): score 88, outreach drafted, gate reached
 *  1 — student on a gmail address: score 31, gate + outreach skipped, nurture path
 *  2 — enterprise VP RevOps (Meridian Freight): score 74; news.search hits one
 *      503 upstream timeout, retries, then the gate is reached
 */

const LEADS = [
  {
    ref: 'LD-7284',
    label: 'Lead captured — Priya Raghavan · kernwave.io',
    submissionId: 'sub_66c1f2a94d0e',
    submittedAt: '2026-07-01T08:42:17Z',
    person: { first: 'Priya', last: 'Raghavan', email: 'priya@kernwave.io', title: 'Co-founder & CTO' },
    company: { name: 'Kernwave', domain: 'kernwave.io' },
    form: {
      company: 'Kernwave',
      teamSize: '11-50',
      message:
        'We close books across 3 entities and it currently takes 9 days. Interested in daily reconciliation — can we see a demo this week?',
    },
    newsQuery: 'Kernwave fintech',
    score: 88,
    band: 'hot',
    outreach: {
      subject: 'Daily close across 3 entities — Kernwave × Ledgerlane',
      sequence: 'founder-fast-track',
    },
    contactId: 'ct_90211',
    enrichedAt: '2026-07-01T08:43:02Z',
  },
  {
    ref: 'LD-7291',
    label: 'Lead captured — Tyler Brooks · gmail.com',
    submissionId: 'sub_66c204b17f3a',
    submittedAt: '2026-06-30T23:18:44Z',
    person: { first: 'Tyler', last: 'Brooks', email: 'tylerbrooks04@gmail.com', title: 'Student (ASU)' },
    company: { name: 'Arizona State University', domain: 'gmail.com' },
    form: {
      company: 'Arizona State University',
      teamSize: '1',
      message:
        'Hi! I am building a capstone project on payment reconciliation for my information systems degree. Do you offer a free student tier?',
    },
    newsQuery: 'Tyler Brooks Arizona State University',
    score: 31,
    band: 'cold',
    outreach: { subject: '', sequence: '' },
    contactId: 'ct_90227',
    enrichedAt: '2026-06-30T23:19:31Z',
  },
  {
    ref: 'LD-7302',
    label: 'Lead captured — Dana Whitfield · meridianfreight.com',
    submissionId: 'sub_66c33e8c2b91',
    submittedAt: '2026-07-01T14:06:02Z',
    person: {
      first: 'Dana',
      last: 'Whitfield',
      email: 'dana.whitfield@meridianfreight.com',
      title: 'VP, Revenue Operations',
    },
    company: { name: 'Meridian Freight', domain: 'meridianfreight.com' },
    form: {
      company: 'Meridian Freight',
      teamSize: '1000+',
      message:
        'We bill brokerage, LTL and warehousing out of three separate systems. Evaluating reconciliation platforms as part of a stack consolidation.',
    },
    newsQuery: 'Meridian Freight',
    score: 74,
    band: 'warm',
    outreach: {
      subject: 'Reconciliation during Meridian’s brokerage stack consolidation',
      sequence: 'enterprise-freight-play',
    },
    contactId: 'ct_88412',
    enrichedAt: '2026-07-01T14:06:58Z',
  },
] as const

const DEDUP_RESULTS: readonly Json[] = [
  { total: 0, contacts: [], searched: ['email:priya@kernwave.io', 'domain:kernwave.io'] },
  { total: 0, contacts: [], searched: ['email:tylerbrooks04@gmail.com'] },
  {
    total: 1,
    contacts: [
      {
        id: 'ct_88412',
        email: 'dana.whitfield@meridianfreight.com',
        owner: null,
        last_activity_at: '2025-04-22T15:10:00Z',
        lists: [],
        open_opportunities: 0,
      },
    ],
    searched: ['email:dana.whitfield@meridianfreight.com', 'domain:meridianfreight.com'],
  },
]

const COMPANY_RESULTS: readonly Json[] = [
  {
    matched: true,
    name: 'Kernwave',
    legal_name: 'Kernwave B.V.',
    domain: 'kernwave.io',
    category: {
      sector: 'Financial Services',
      industry: 'Fintech',
      sub_industry: 'Treasury & Payments Infrastructure',
    },
    metrics: {
      employees: 42,
      employees_range: '11-50',
      estimated_annual_revenue: '$1M-$10M',
      raised_usd: 12000000,
    },
    funding: {
      stage: 'series_a',
      last_round: { amount_usd: 12000000, announced_on: '2026-03-18', lead_investor: 'Elderline Ventures' },
    },
    tech: ['aws', 'kubernetes', 'stripe', 'segment', 'datadog'],
    geo: { city: 'Amsterdam', country: 'NL' },
    linkedin: { handle: 'company/kernwave' },
    founded_year: 2023,
  },
  { matched: false, domain: 'gmail.com', reason: 'freemail_domain', suggestion: null },
  {
    matched: true,
    name: 'Meridian Freight',
    legal_name: 'Meridian Freight Systems, Inc.',
    domain: 'meridianfreight.com',
    category: { sector: 'Industrials', industry: 'Logistics & Supply Chain', sub_industry: 'Freight Brokerage' },
    metrics: {
      employees: 3400,
      employees_range: '1K-5K',
      estimated_annual_revenue: '$500M-$1B',
      raised_usd: null,
    },
    funding: { stage: 'private_equity', last_round: null },
    tech: ['salesforce', 'netsuite', 'workato', 'snowflake'],
    geo: { city: 'Columbus', state: 'OH', country: 'US' },
    linkedin: { handle: 'company/meridian-freight' },
    founded_year: 1998,
  },
]

const PERSON_RESULTS: readonly Json[] = [
  {
    matched: true,
    full_name: 'Priya Raghavan',
    title: 'Co-founder & CTO',
    seniority: 'executive',
    role: 'engineering',
    geo: { city: 'Amsterdam', country: 'NL' },
    linkedin: { handle: 'in/priya-raghavan-kw' },
    employment: { company: 'Kernwave', title: 'Co-founder & CTO', start_date: '2023-05' },
    email_verified: true,
    confidence: 0.97,
  },
  {
    matched: true,
    full_name: 'Tyler Brooks',
    title: null,
    seniority: null,
    role: null,
    geo: { city: 'Tempe', state: 'AZ', country: 'US' },
    linkedin: { handle: 'in/tyler-brooks-asu' },
    employment: null,
    education: { school: 'Arizona State University', degree: 'BS Information Systems', end_year: 2027 },
    email_verified: true,
    confidence: 0.41,
  },
  {
    matched: true,
    full_name: 'Dana Whitfield',
    title: 'VP, Revenue Operations',
    seniority: 'vp',
    role: 'operations',
    geo: { city: 'Columbus', state: 'OH', country: 'US' },
    linkedin: { handle: 'in/danawhitfield' },
    employment: { company: 'Meridian Freight', title: 'VP, Revenue Operations', start_date: '2022-08' },
    email_verified: true,
    confidence: 0.93,
  },
]

const NEWS_RESULTS: readonly Json[] = [
  {
    query: 'Kernwave fintech',
    window_days: 180,
    total: 3,
    articles: [
      {
        title: 'Kernwave raises $12M Series A led by Elderline Ventures to bring treasury APIs to US startups',
        source: 'TechCrunch',
        url: 'https://techcrunch.com/2026/03/18/kernwave-series-a/',
        published_at: '2026-03-18T13:05:00Z',
      },
      {
        title: 'Kernwave launches real-time FX netting for multi-entity startups',
        source: 'Finextra',
        url: 'https://www.finextra.com/newsarticle/kernwave-fx-netting',
        published_at: '2026-05-27T09:30:00Z',
      },
      {
        title: 'The new treasury stack: 12 startups CFOs are watching',
        source: 'Fintech Brainfood',
        url: 'https://fintechbrainfood.com/new-treasury-stack-2026',
        published_at: '2026-06-14T16:00:00Z',
      },
    ],
  },
  { query: 'Tyler Brooks Arizona State University', window_days: 180, total: 0, articles: [] },
  {
    query: 'Meridian Freight',
    window_days: 180,
    total: 2,
    articles: [
      {
        title: 'Meridian Freight to consolidate brokerage tech stack after Q1 margin squeeze',
        source: 'Supply Chain Dive',
        url: 'https://www.supplychaindive.com/news/meridian-freight-tech-consolidation/',
        published_at: '2026-06-11T11:20:00Z',
      },
      {
        title: 'Meridian Freight names Carla Jimenez as chief revenue officer',
        source: 'FreightWaves',
        url: 'https://www.freightwaves.com/news/meridian-freight-cro-jimenez',
        published_at: '2026-05-04T14:45:00Z',
      },
    ],
  },
]

const SUMMARY_TEXTS = [
  `Kernwave is a 42-person Amsterdam fintech building treasury and FX-netting APIs for multi-entity startups. They closed a $12M Series A led by Elderline Ventures on 18 March — 105 days ago — explicitly to fund US expansion, which typically triggers new billing and reconciliation tooling. Priya Raghavan is co-founder & CTO and the economic buyer for infrastructure; she submitted the demo form herself, noting that close currently takes 9 days across 3 entities. Detected stack (Stripe, Segment, AWS) overlaps our native integrations. No existing CRM record, no open opportunities. Strong ICP fit — right stage, right buyer, live trigger event. Recommend fast-track outreach referencing the US expansion.`,
  `Tyler Brooks submitted the demo form from a personal Gmail address with 'Arizona State University' in the company field. Company enrichment returned no match (freemail domain); person enrichment resolved a public LinkedIn profile listing him as a BS Information Systems student graduating 2027, at 0.41 confidence. News search returned zero relevant articles. The form message asks whether Ledgerlane offers a free student tier for a capstone project on payment reconciliation. There is no budget authority, no company entity, and no trigger event, so this is not a sales opportunity today — though capstone users occasionally convert after graduation. Recommend the education nurture track rather than rep outreach.`,
  `Meridian Freight is a 3,400-employee logistics enterprise (est. revenue $500M–$1B) running brokerage, LTL and warehousing units on separate billing systems — exactly the pain the form message describes. Supply Chain Dive reported on 11 June that the company is consolidating its brokerage tech stack after a Q1 margin squeeze, and a new CRO (Carla Jimenez) joined in May; both are classic re-platforming triggers. Dana Whitfield is VP of Revenue Operations — a strong champion profile, though procurement will require security review and multi-threading to the CFO. A stale CRM record exists (last touch April 2025) with no open opportunities. Solid fit with a long cycle; recommend outreach tied to the consolidation initiative.`,
]

const SCORER_TEXTS = [
  `{"score":88,"band":"hot","threshold":70,"signals":{"funding_days_ago":105,"buyer_title":"cto","icp_stage":"series_a","intent":"demo_request","stack_overlap":["stripe","segment"]},"route":"outreach"}`,
  `{"score":31,"band":"cold","threshold":70,"signals":{"freemail_domain":true,"buyer_title":null,"icp_stage":null,"intent":"student_project","stack_overlap":[]},"route":"nurture"}`,
  `{"score":74,"band":"warm","threshold":70,"signals":{"trigger_event":"tech_stack_consolidation","buyer_title":"vp_revops","icp_stage":"enterprise","intent":"demo_request","stale_crm_record":true},"route":"outreach"}`,
]

const DRAFT_TEXTS = [
  `Hi Priya — congrats on the $12M Series A with Elderline Ventures in March. Expanding treasury APIs into the US usually means a second entity, a second Stripe account, and a month-end close that quietly balloons. You mentioned close already takes 9 days across 3 entities — that's exactly where Ledgerlane lands hardest: we sit on top of Stripe and Segment (both already in your stack) and reconcile every entity to the ledger daily. Comparable Series-A fintechs like Alloa cut close from 8 days to 2 in their first month. Open to 20 minutes on Thursday? — Sam`,
  ``,
  `Hi Dana — saw the Supply Chain Dive piece on Meridian consolidating its brokerage tech stack after the Q1 margin squeeze. When brokerage, LTL and warehousing bill out of three separate systems, RevOps usually ends up owning a spreadsheet-shaped reconciliation problem nobody budgeted for. Ledgerlane unifies invoice-to-ledger reconciliation across billing systems without replacing them — Harbrook Logistics (3,000+ employees) went live in 6 weeks and recovered $1.1M in unbilled accessorials in the first quarter. With a new CRO onboarding, would a 25-minute walkthrough of our freight playbook be useful next week? — Sam`,
]

export const leadEnrichmentScenario: Scenario = {
  id: 'lead-enrichment',
  name: 'Lead enrichment',
  tagline: 'Sales ops · webhook → CRM',
  variants: 3,
  nodes: [
    { id: 't_lead', kind: 'trigger', label: 'Lead captured', sub: 'webflow · form webhook' },
    { id: 'n_dedup', kind: 'tool', label: 'Dedup check', sub: 'crm.contacts.search' },
    { id: 'n_route_new', kind: 'router', label: 'New vs existing', sub: 'match in CRM?' },
    { id: 'n_company', kind: 'tool', label: 'Company enrichment', sub: 'enrich.company' },
    { id: 'n_person', kind: 'tool', label: 'Person enrichment', sub: 'enrich.person' },
    { id: 'n_news', kind: 'tool', label: 'News scan', sub: 'news.search' },
    { id: 'n_summary', kind: 'llm', label: 'Research summarizer', sub: 'claude-sonnet-5' },
    { id: 'n_score', kind: 'llm', label: 'Lead scorer', sub: 'claude-haiku-4-5' },
    { id: 'n_route_score', kind: 'router', label: 'Score gate', sub: 'score >= 70' },
    { id: 'n_draft', kind: 'llm', label: 'Draft outreach', sub: 'claude-sonnet-5' },
    { id: 'n_gate', kind: 'approval', label: 'Send outreach', sub: 'human review' },
    { id: 'n_enroll', kind: 'tool', label: 'Enroll in sequence', sub: 'outreach.sequences.enroll' },
    { id: 'n_nurture', kind: 'tool', label: 'Add to nurture', sub: 'crm.lists.add' },
    { id: 'n_update', kind: 'tool', label: 'Sync CRM', sub: 'crm.contacts.update' },
    { id: 'n_done', kind: 'output', label: 'Lead processed', sub: 'record synced' },
  ],
  edges: [
    { id: 'e1', source: 't_lead', target: 'n_dedup' },
    { id: 'e2', source: 'n_dedup', target: 'n_route_new' },
    { id: 'e3', source: 'n_route_new', target: 'n_company', label: 'enrich' },
    { id: 'e4', source: 'n_route_new', target: 'n_person', label: 'enrich' },
    { id: 'e5', source: 'n_route_new', target: 'n_news', label: 'enrich' },
    { id: 'e6', source: 'n_company', target: 'n_summary' },
    { id: 'e7', source: 'n_person', target: 'n_summary' },
    { id: 'e8', source: 'n_news', target: 'n_summary' },
    { id: 'e9', source: 'n_summary', target: 'n_score' },
    { id: 'e10', source: 'n_score', target: 'n_route_score' },
    { id: 'e11', source: 'n_route_score', target: 'n_draft', label: 'score ≥ 70' },
    { id: 'e12', source: 'n_draft', target: 'n_gate' },
    { id: 'e13', source: 'n_gate', target: 'n_enroll' },
    { id: 'e14', source: 'n_enroll', target: 'n_update' },
    { id: 'e15', source: 'n_route_score', target: 'n_nurture', label: 'score < 70' },
    { id: 'e16', source: 'n_nurture', target: 'n_update' },
    { id: 'e17', source: 'n_update', target: 'n_done' },
  ],

  script(b, { rng, variant }) {
    const L = LEADS[variant]
    const highScore = L.score >= 70

    b.trigger('t_lead', {
      label: L.label,
      payload: {
        site: 'ledgerlane.com',
        form: 'Demo Request',
        submission_id: L.submissionId,
        submitted_at: L.submittedAt,
        data: {
          name: `${L.person.first} ${L.person.last}`,
          email: L.person.email,
          company: L.form.company,
          team_size: L.form.teamSize,
          message: L.form.message,
        },
      },
    })

    b.tool('n_dedup', {
      tool: 'crm.contacts.search',
      args: { email: L.person.email, domain: L.company.domain, match: ['email', 'domain'] },
      ms: rng.int(210, 390),
      result: DEDUP_RESULTS[variant],
    })

    b.router('n_route_new', {
      decision: variant === 2 ? 'existing · stale (14 mo) — re-enrich' : 'new lead — enrich',
    })

    b.parallel([
      () =>
        b.tool('n_company', {
          tool: 'enrich.company',
          args: { domain: L.company.domain, include: ['funding', 'tech', 'metrics'] },
          ms: rng.int(480, 920),
          result: COMPANY_RESULTS[variant],
        }),
      () =>
        b.tool('n_person', {
          tool: 'enrich.person',
          args: { email: L.person.email, given_name: L.person.first, family_name: L.person.last },
          ms: rng.int(420, 810),
          result: PERSON_RESULTS[variant],
        }),
      () =>
        b.tool('n_news', {
          tool: 'news.search',
          args: { query: L.newsQuery, window: '180d', limit: 5, lang: 'en' },
          ms: rng.int(620, 1150),
          failures:
            variant === 2
              ? {
                  count: 1,
                  reason: '503 upstream timeout',
                  result: {
                    error: { status: 503, code: 'upstream_timeout', message: 'newsapi gateway timed out after 10000ms' },
                  },
                }
              : undefined,
          result: NEWS_RESULTS[variant],
        }),
    ])

    b.llm('n_summary', {
      model: 'claude-sonnet-5',
      promptTokens: 2180,
      text: SUMMARY_TEXTS[variant],
      output: {
        lead_ref: L.ref,
        company: L.company.name,
        icp_fit: variant === 1 ? 'poor' : 'strong',
        trigger_event: variant === 0 ? 'series_a_us_expansion' : variant === 2 ? 'tech_stack_consolidation' : null,
      },
    })

    b.llm('n_score', {
      model: 'claude-haiku-4-5',
      promptTokens: 1440,
      firstTokenMs: rng.int(300, 620),
      text: SCORER_TEXTS[variant],
      output: { score: L.score, band: L.band, route: highScore ? 'outreach' : 'nurture' },
    })

    b.router('n_route_score', {
      decision: highScore ? `score ${L.score} ≥ 70 — outreach` : `score ${L.score} < 70 — nurture`,
    })

    let finalSequence: string | null = null
    let finalList: string | null = null

    if (highScore) {
      b.skip('n_nurture', 'score ≥ 70 — outreach path')

      b.llm('n_draft', {
        model: 'claude-sonnet-5',
        promptTokens: 1690,
        text: DRAFT_TEXTS[variant],
        output: {
          channel: 'email',
          to: L.person.email,
          subject: L.outreach.subject,
          sequence: L.outreach.sequence,
        },
      })

      const gate = b.approval('n_gate', {
        gate: `outreach-${L.ref}`,
        title: `Send outreach to ${L.person.first} ${L.person.last} (${L.company.name})`,
        reason:
          variant === 2
            ? `Lead scored ${L.score} (threshold 70). Contact has a stale CRM record (last touch 2025-04-22) that will be reassigned to rep:sam.aldous.`
            : `Lead scored ${L.score} (threshold 70). First-touch outreach from a rep mailbox requires human review before sequence enrollment.`,
        current: {
          crm: {
            contact: L.person.email,
            record: variant === 2 ? 'existing · stale' : 'not_created',
            owner: null,
            status: 'unrouted',
          },
          outreach: null,
        },
        proposed: {
          crm: { contact: L.person.email, record: 'upsert', owner: 'rep:sam.aldous', status: 'working' },
          outreach: {
            channel: 'email',
            subject: L.outreach.subject,
            body_preview: DRAFT_TEXTS[variant].slice(0, 92) + '…',
            sequence: L.outreach.sequence,
          },
        },
      })

      if (gate.decision === 'rejected') {
        b.skip('n_enroll', 'gate rejected')
        b.skip('n_update', 'gate rejected')
        b.fail('outreach rejected by reviewer', 'rejected')
      }

      let subject: string = L.outreach.subject
      let sequence: string = L.outreach.sequence
      const editedOutreach = (gate.finalState as { outreach?: { subject?: string; sequence?: string } })?.outreach
      if (typeof editedOutreach?.subject === 'string') subject = editedOutreach.subject
      if (typeof editedOutreach?.sequence === 'string') sequence = editedOutreach.sequence
      finalSequence = sequence

      b.tool('n_enroll', {
        tool: 'outreach.sequences.enroll',
        args: {
          contact: L.person.email,
          sequence,
          mailbox: 'sam.aldous@ledgerlane.com',
          first_touch: { channel: 'email', subject },
        },
        ms: rng.int(340, 620),
        result: {
          enrollment_id: `enr_${L.ref.toLowerCase()}`,
          sequence,
          state: 'active',
          steps: 5,
          first_step: { channel: 'email', scheduled_at: variant === 2 ? '2026-07-02T13:00:00Z' : '2026-07-01T15:30:00Z' },
        },
      })
    } else {
      b.skip('n_draft', 'score < 70 — nurture path')
      b.skip('n_gate', 'score < 70 — gate not required')
      b.skip('n_enroll', 'score < 70 — nurture path')
      finalList = 'edu-nurture-q3'

      b.tool('n_nurture', {
        tool: 'crm.lists.add',
        args: { contact: L.person.email, list: 'edu-nurture-q3', source: 'lead-scorer' },
        ms: rng.int(240, 460),
        result: { list_id: 'lst_5d18ac', list: 'edu-nurture-q3', members: 1843, added: true },
      })
    }

    b.tool('n_update', {
      tool: 'crm.contacts.update',
      args: {
        email: L.person.email,
        upsert: true,
        fields: {
          lead_score: L.score,
          score_band: L.band,
          lifecycle_stage: highScore ? 'sales_qualified' : 'nurture',
          company: L.form.company,
          title: L.person.title,
          source: 'webflow:demo-request',
          enriched_at: L.enrichedAt,
          owner: highScore ? 'rep:sam.aldous' : null,
        },
      },
      ms: rng.int(280, 520),
      result: { id: L.contactId, created: variant !== 2, updated: true, fields_written: 8 },
    })

    b.output('n_done', {
      label: `Lead processed — ${L.person.first} ${L.person.last} · score ${L.score}`,
      payload: {
        ref: L.ref,
        contact_id: L.contactId,
        score: L.score,
        route: highScore ? 'outreach' : 'nurture',
        sequence: finalSequence,
        nurture_list: finalList,
      },
    })
  },
}
