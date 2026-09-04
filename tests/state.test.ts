import { describe, expect, it } from "vitest"
import { AggressionState } from "../.opencode/plugins/zabiyaka/state.js"
import type { SemanticCategory } from "../.opencode/plugins/zabiyaka/semantics.js"

const assessment = (category: SemanticCategory) => ({ category, confidence: 1 })

describe("AggressionState", () => {
  it("starts at zero", () => {
    expect(new AggressionState().get()).toBe(0)
  })

  it("escalates conflict", () => {
    const state = new AggressionState()
    state.apply(assessment("conflict"))
    expect(state.get()).toBe(12)
  })

  it("escalates provocation more strongly", () => {
    const state = new AggressionState()
    state.apply(assessment("provocation"))
    expect(state.get()).toBe(20)
  })

  it("never exceeds 100", () => {
    const state = new AggressionState(95)
    state.apply(assessment("provocation"))
    expect(state.get()).toBe(100)
  })

  it("de-escalates ordinary interaction", () => {
    const state = new AggressionState(20)
    state.apply(assessment("ordinary"))
    expect(state.get()).toBe(15)
  })

  it("never falls below zero", () => {
    const state = new AggressionState(2)
    state.apply(assessment("ordinary"))
    expect(state.get()).toBe(0)
  })

  it("forgives immediately on apology", () => {
    const state = new AggressionState(87)
    state.apply(assessment("apology"))
    expect(state.get()).toBe(0)
  })
})
