import { describe, expect, it } from "vitest"
import { createZabiyakaPlugin } from "../.opencode/plugins/zabiyaka/index.js"

describe("OpenCode hooks", () => {
  it("tracks a user message without creating a session turn", async () => {
    const input = { client: {}, project: { id: "project-1" } } as never
    const hooks = await createZabiyakaPlugin(input)
    expect(hooks["chat.message"]).toBeTypeOf("function")
    await hooks["chat.message"]!({ sessionID: "session-42", messageID: "msg-1" }, {
      message: {} as never,
      parts: [{ type: "text", text: "Прости" }] as never,
    })
  })

  it("injects Zabiyaka instructions after observing the current user message", async () => {
    const input = { client: {}, project: { id: "project-1" } } as never
    const hooks = await createZabiyakaPlugin(input)
    await hooks["chat.message"]!({ sessionID: "session-42", messageID: "msg-1" }, {
      message: {} as never,
      parts: [{ type: "text", text: "Прости" }] as never,
    })
    const output = { system: [] as string[] }
    await hooks["experimental.chat.system.transform"]!({ sessionID: "session-42", model: {} as never }, output)
    expect(output.system.length).toBeGreaterThan(0)
    expect(output.system.join("\n")).toContain("Zabiyaka behavior instruction")
  })
})
