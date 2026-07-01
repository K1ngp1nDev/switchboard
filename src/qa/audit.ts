import { simulate } from '../engine/builder'
import { mulberry32 } from '../engine/prng'
import { getScenario, SCENARIOS } from '../scenarios'
import { RUN_HISTORY } from '../store/history'

/**
 * Self-audit callable from QA tooling (window.__switchboard.audit()).
 * Verifies the core determinism promise: same (scenario, seed, variant,
 * decisions) ⇒ byte-identical event log.
 */
export function audit() {
  let identical = 0
  const statuses: Record<string, number> = {}

  for (const r of RUN_HISTORY) {
    const a = simulate(getScenario(r.scenarioId), r.seed, r.variant, r.decisions, mulberry32)
    const b = simulate(getScenario(r.scenarioId), r.seed, r.variant, r.decisions, mulberry32)
    if (JSON.stringify(a.events) === JSON.stringify(b.events)) identical += 1
    statuses[a.status] = (statuses[a.status] ?? 0) + 1
  }

  // every scenario × variant must terminate (no infinite scripts, no throws)
  let variantRuns = 0
  for (const sc of SCENARIOS) {
    for (let v = 0; v < sc.variants; v++) {
      const sim = simulate(sc, 777 + v, v, [], mulberry32)
      if (sim.events.length > 0 && sim.duration > 0) variantRuns += 1
    }
  }

  return {
    historyRuns: RUN_HISTORY.length,
    deterministic: identical === RUN_HISTORY.length,
    statuses,
    variantRuns,
    expectedVariantRuns: SCENARIOS.reduce((n, s) => n + s.variants, 0),
  }
}
