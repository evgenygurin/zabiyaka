import { describe, expect, it, vi } from "vitest"
import { classifyConversation } from "../.opencode/plugins/zabiyaka/semantics.js"

describe("classifyConversation", () => {
  it("accepts a valid model result", async () => {
    const invoke = vi.fn().mockResolvedValue({ category: "conflict", confidence: 0.9 })
    await expect(classifyConversation([], invoke)).resolves.toEqual({ category: "conflict", confidence: 0.9 })
  })

  it("returns null for malformed model output", async () => {
    const invoke = vi.fn().mockResolvedValue({ category: "unknown", confidence: 2 })
    await expect(classifyConversation([], invoke)).resolves.toBeNull()
  })

  it("returns null when the model invocation fails", async () => {
    const invoke = vi.fn().mockRejectedValue(new Error("model unavailable"))
    await expect(classifyConversation([], invoke)).resolves.toBeNull()
  })
})
