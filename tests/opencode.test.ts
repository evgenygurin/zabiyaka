import { describe, expect, it, vi } from "vitest"
import { createSessionRuntime, toConversationMessage } from "../.opencode/plugins/zabiyaka/opencode.js"

describe("OpenCode integration", () => {
  it("extracts user text", () => {
    expect(toConversationMessage({ info: { role: "user", time: { created: 10 } }, parts: [{ type: "text", text: "hello" }] }))
      .toEqual({ role: "user", content: "hello", timestamp: 10 })
  })

  it("extracts assistant text", () => {
    expect(toConversationMessage({ info: { role: "assistant", time: { created: 20 } }, parts: [{ type: "text", text: "answer" }] }))
      .toEqual({ role: "assistant", content: "answer", timestamp: 20 })
  })

  it("ignores non-conversational messages", () => {
    expect(toConversationMessage({ info: { role: "tool" }, parts: [{ type: "text", text: "tool output" }] })).toBeNull()
  })

  it("detects apology and resets aggression before generation", async () => {
    const generate = vi.fn().mockResolvedValue("Ладно, мир.")
    const runtime = createSessionRuntime(generate, {})
    await runtime.observe("s1", { role: "user", content: "Прости меня", timestamp: 1 }, "m1")
    await Promise.resolve()
    expect(runtime.aggression("s1")).toBe(0)
    expect(runtime.consume("s1")).toBe("Ладно, мир.")
  })

  it("keeps generation injectable and gates ordinary intervention", async () => {
    const generate = vi.fn().mockResolvedValue("неважно")
    const runtime = createSessionRuntime(generate, {}, () => 0.99)
    await runtime.observe("s1", { role: "user", content: "Обычный вопрос", timestamp: 1 }, "m1")
    expect(generate).not.toHaveBeenCalled()
  })
})
