import type { SemanticAssessment } from "./semantics.js"

export function interventionProbability(aggression: number): number {
  const clamped = Math.min(100, Math.max(0, aggression))
  return 0.02 + 0.23 * clamped / 100
}

export function shouldIntervene(
  assessment: SemanticAssessment,
  aggression: number,
  random: number,
): boolean {
  if (!Number.isFinite(random) || random < 0 || random >= 1) return false
  if (assessment.confidence < 0.6) return false
  if (assessment.category === "apology") return false
  return random < interventionProbability(aggression)
}
