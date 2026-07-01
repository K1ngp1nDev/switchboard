import type { ApprovalDecision } from '../engine/types'

/**
 * Pre-baked run history shown in the executions panel. Everything is
 * regenerated deterministically from (scenario, seed, variant, decisions) at
 * startup — no run data is stored, only these recipes.
 */
export interface RunRecipe {
  id: string
  scenarioId: string
  seed: number
  variant: number
  decisions: ApprovalDecision[]
  /** minutes before "now", for the fake timestamps */
  agoMin: number
}

export const RUN_HISTORY: RunRecipe[] = [
  // ---- refund agent
  { id: 'r-4821', scenarioId: 'refund', seed: 101, variant: 0, agoMin: 26,
    decisions: [{ gateId: 'refund-ZD-48213', decision: 'approved', actor: 'd.moreau' }] },
  { id: 'r-4837', scenarioId: 'refund', seed: 102, variant: 1, agoMin: 84, decisions: [] },
  { id: 'r-4790', scenarioId: 'refund', seed: 103, variant: 2, agoMin: 189,
    decisions: [{ gateId: 'refund-ZD-47902', decision: 'approved', actor: 'you' }] },
  { id: 'r-4855', scenarioId: 'refund', seed: 104, variant: 0, agoMin: 7, decisions: [] }, // waiting
  { id: 'r-4762', scenarioId: 'refund', seed: 105, variant: 2, agoMin: 301,
    decisions: [{ gateId: 'refund-ZD-47902', decision: 'rejected', actor: 'k.tanaka' }] },

  // ---- lead enrichment
  { id: 'l-7284', scenarioId: 'lead-enrichment', seed: 201, variant: 0, agoMin: 12,
    decisions: [{ gateId: 'outreach-LD-7284', decision: 'approved', actor: 'you' }] },
  { id: 'l-7291', scenarioId: 'lead-enrichment', seed: 202, variant: 1, agoMin: 58, decisions: [] },
  { id: 'l-7302', scenarioId: 'lead-enrichment', seed: 203, variant: 2, agoMin: 41, decisions: [] }, // waiting
  { id: 'l-7269', scenarioId: 'lead-enrichment', seed: 204, variant: 0, agoMin: 133,
    decisions: [{ gateId: 'outreach-LD-7284', decision: 'rejected', actor: 's.ibarra' }] },

  // ---- incident triage
  { id: 'i-2607', scenarioId: 'incident-triage', seed: 301, variant: 0, agoMin: 18,
    decisions: [{ gateId: 'statuspage-INC-2607', decision: 'approved', actor: 'oncall:primary' }] },
  { id: 'i-2601', scenarioId: 'incident-triage', seed: 302, variant: 1, agoMin: 96, decisions: [] },
  { id: 'i-2604', scenarioId: 'incident-triage', seed: 303, variant: 2, agoMin: 44, decisions: [] }, // waiting
]

/**
 * NOTE: gate ids inside decisions must match what scenario scripts emit for
 * the given variant. The startup code drops decisions that never matched a
 * gate (harmless), so a mismatch degrades to a 'waiting' run, never a crash.
 */
