import { describe, expect, it, vi } from "vitest"
import { toConversationMessage } from "../.opencode/plugins/zabiyaka/index.js"

describe("OpenCode adapter", () => {
  it("extracts user text", () => {
    expect(toConversationMessage({ role: "user", parts: [{ type: "text", text: "hello" }] }))
      .toMatchObject({ role: "user", content: "hello" })
  })

  it("extracts assistant text", () => {
    expect(toConversationMessage({ role: "assistant", parts: [{ type: "text", text: "answer" }] }))
      .toMatchObject({ role: "assistant", content: "answer" })
  })

  it("ignores empty content", () => {
    expect(toConversationMessage({ role: "user", parts: [{ type: "text", text: "   " }] })).toBeNull()
  })

  it("accepts multiple text parts", () => {
    expect(toConversationMessage({ role: "user", parts: [
      { type: "text", text: "hello" },
      { type: "text", text: "world" },
    ] })).toMatchObject({ content: "hello\nworld" })
  })

  it("supports the runtime generation dependency independently", async () => {
    const generate = vi.fn().mockResolvedValue("Ладно, мир.")
    expect(await generate("Прости меня")).toBe("Ладно, мир.")
    expect(generate).toHaveBeenCalledWith("Прости меня")
  })
})
