import type { NodeKind, Scenario } from '../engine/types'
import { refundScenario } from './refund'
import { leadEnrichmentScenario } from './leadEnrichment'
import { incidentTriageScenario } from './incidentTriage'

export const SCENARIOS: Scenario[] = [refundScenario, leadEnrichmentScenario, incidentTriageScenario]

export function getScenario(id: string): Scenario {
  const s = SCENARIOS.find((s) => s.id === id)
  if (!s) throw new Error(`unknown scenario: ${id}`)
  return s
}

export function nodeKindLookup(scenario: Scenario): (id: string) => NodeKind {
  const map = new Map(scenario.nodes.map((n) => [n.id, n.kind]))
  return (id) => map.get(id) ?? 'tool'
}

export function nodeLabelLookup(scenario: Scenario): (id: string) => string {
  const map = new Map(scenario.nodes.map((n) => [n.id, n.label]))
  return (id) => map.get(id) ?? id
}
