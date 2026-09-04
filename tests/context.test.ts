import { describe, expect, it } from "vitest"
import { ConversationContext, type ConversationMessage } from "../.opencode/plugins/zabiyaka/context.js"

const message = (n: number, role: ConversationMessage["role"] = "user"): ConversationMessage => ({
  role,
  content: `message-${n}`,
  timestamp: n,
})

describe("ConversationContext", () => {
  it("starts empty", () => {
    expect(new ConversationContext().messages()).toEqual([])
  })

  it("stores user and assistant messages", () => {
    const context = new ConversationContext()
    context.add(message(1, "user"))
    context.add(message(2, "assistant"))
    expect(context.messages()).toEqual([message(1, "user"), message(2, "assistant")])
  })

  it("evicts the oldest message after 20 entries", () => {
    const context = new ConversationContext()
    for (let i = 1; i <= 21; i += 1) context.add(message(i))
    expect(context.messages()).toHaveLength(20)
    expect(context.messages()[0]?.content).toBe("message-2")
    expect(context.messages()[19]?.content).toBe("message-21")
  })

  it("can be cleared", () => {
    const context = new ConversationContext()
    context.add(message(1))
    context.clear()
    expect(context.messages()).toEqual([])
  })
})
