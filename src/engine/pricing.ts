/**
 * Per-1M-token pricing used for the cost HUD. The numbers are a plausible
 * snapshot for the demo; the point is that every dollar figure on screen
 * reconciles exactly with the visible token counts.
 */
export const MODEL_PRICING: Record<string, { inPerM: number; outPerM: number }> = {
  'claude-sonnet-5': { inPerM: 3.0, outPerM: 15.0 },
  'claude-haiku-4-5': { inPerM: 1.0, outPerM: 5.0 },
  'gpt-5-mini': { inPerM: 0.6, outPerM: 2.4 },
}

export function llmCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = MODEL_PRICING[model] ?? { inPerM: 2, outPerM: 8 }
  return (tokensIn * p.inPerM + tokensOut * p.outPerM) / 1_000_000
}

/** rough-but-stable token estimate for canned text (~4 chars/token) */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4))
}
