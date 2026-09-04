import type { SemanticAssessment } from "./semantics.js"

const DELTAS = {
  conflict: 12,
  continuation: 8,
  provocation: 20,
  ordinary: -5,
} as const

const clampAggression = (value: number): number => Math.min(100, Math.max(0, value))

export class AggressionState {
  private aggression: number

  constructor(initial = 0) {
    this.aggression = clampAggression(initial)
  }

  get(): number {
    return this.aggression
  }

  apply(assessment: SemanticAssessment): void {
    if (assessment.category === "apology") {
      this.aggression = 0
      return
    }

    this.aggression = clampAggression(this.aggression + DELTAS[assessment.category])
  }

  reset(): void {
    this.aggression = 0
  }
}
