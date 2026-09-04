import { describe, expect, it } from "vitest"
import { validateSemanticAssessment, type SemanticCategory } from "../.opencode/plugins/zabiyaka/semantics.js"

describe("semantic assessment", () => {
  it("accepts each of the five categories", () => {
    const categories: SemanticCategory[] = ["conflict", "continuation", "provocation", "ordinary", "apology"]
    for (const category of categories) {
      expect(validateSemanticAssessment({ category, confidence: 0.5 })).toEqual({ category, confidence: 0.5 })
    }
  })

  it("rejects unknown categories", () => {
    expect(validateSemanticAssessment({ category: "insult", confidence: 0.9 })).toBeNull()
  })

  it("rejects confidence outside 0..1", () => {
    expect(validateSemanticAssessment({ category: "ordinary", confidence: 2 })).toBeNull()
    expect(validateSemanticAssessment({ category: "ordinary", confidence: -0.1 })).toBeNull()
  })

  it("rejects malformed output", () => {
    expect(validateSemanticAssessment(null)).toBeNull()
    expect(validateSemanticAssessment("conflict")).toBeNull()
    expect(validateSemanticAssessment({ category: "ordinary" })).toBeNull()
  })
})
