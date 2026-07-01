import type { Json } from './types'

export interface DiffLine {
  path: string
  type: 'same' | 'added' | 'removed' | 'changed'
  before?: string
  after?: string
}

function fmt(v: Json | undefined): string {
  if (v === undefined) return ''
  if (typeof v === 'string') return `"${v}"`
  return JSON.stringify(v)
}

function isObj(v: Json | undefined): v is { [k: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Flattens two JSON trees into path-level diff lines for the approval modal.
 * Arrays are compared by index — fine for the small, shaped payloads gates
 * carry. Subtrees that differ in type collapse to one changed line.
 */
export function diffJson(before: Json | undefined, after: Json | undefined, path = ''): DiffLine[] {
  if (isObj(before) && isObj(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    return keys.flatMap((k) => diffJson(before[k], after[k], path ? `${path}.${k}` : k))
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const len = Math.max(before.length, after.length)
    const lines: DiffLine[] = []
    for (let i = 0; i < len; i++) {
      lines.push(...diffJson(before[i], after[i], `${path}[${i}]`))
    }
    return lines
  }

  const b = fmt(before)
  const a = fmt(after)
  if (before === undefined) return [{ path, type: 'added', after: a }]
  if (after === undefined) return [{ path, type: 'removed', before: b }]
  if (b === a) return [{ path, type: 'same', before: b, after: a }]
  return [{ path, type: 'changed', before: b, after: a }]
}
