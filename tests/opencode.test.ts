import { describe, expect, it } from "vitest"
import { toConversationMessage } from "../.opencode/plugins/zabiyaka/opencode.js"

describe("OpenCode message adapter", () => {
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
})
