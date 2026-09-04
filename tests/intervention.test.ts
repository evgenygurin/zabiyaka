import { describe, expect, it } from "vitest"
import { interventionProbability, shouldIntervene } from "../.opencode/plugins/zabiyaka/intervention.js"

describe("intervention policy", () => {
  it("maps aggression 0 to 2%", () => expect(interventionProbability(0)).toBeCloseTo(0.02))
  it("maps aggression 50 to 13.5%", () => expect(interventionProbability(50)).toBeCloseTo(0.135))
  it("maps aggression 100 to 25%", () => expect(interventionProbability(100)).toBeCloseTo(0.25))

  it("forces silence when confidence is low", () => {
    expect(shouldIntervene({ category: "ordinary", confidence: 0.59 }, 100, 0)).toBe(false)
  })

  it("can force intervention with random 0", () => {
    expect(shouldIntervene({ category: "ordinary", confidence: 1 }, 100, 0)).toBe(true)
  })

  it("can force silence with a value above probability", () => {
    expect(shouldIntervene({ category: "ordinary", confidence: 1 }, 0, 0.02)).toBe(false)
  })

  it("never lets apology trigger a rude intervention", () => {
    expect(shouldIntervene({ category: "apology", confidence: 1 }, 100, 0)).toBe(false)
  })

  it("rejects invalid random values", () => {
    expect(shouldIntervene({ category: "ordinary", confidence: 1 }, 50, -0.1)).toBe(false)
    expect(shouldIntervene({ category: "ordinary", confidence: 1 }, 50, 1)).toBe(false)
  })
})
