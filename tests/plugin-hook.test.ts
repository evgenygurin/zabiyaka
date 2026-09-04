import { describe, expect, it, vi } from "vitest"
import { createZabiyakaPlugin } from "../.opencode/plugins/zabiyaka/index.js"

describe("OpenCode hook", () => {
  it("uses the incoming session id for an intervention turn", async () => {
    const prompt = vi.fn(async () => ({ data: { parts: [{ type: "text", text: "отвечаю" }] } }))
    const input = { client: { session: { prompt } }, project: { id: "project-1" } } as never
    const hooks = await createZabiyakaPlugin(input)

    await hooks["chat.message"]!({ sessionID: "session-42", messageID: "1" }, {
      message: {} as never,
      parts: [{ type: "text", text: "Прости" }] as never,
    })

    expect(prompt).toHaveBeenCalledTimes(1)
    expect(prompt).toHaveBeenCalledWith(expect.objectContaining({ path: { id: "session-42" } }))
  })

  it("does not create a second turn from the Zabiyaka response", async () => {
    const prompt = vi.fn(async () => ({ data: { parts: [{ type: "text", text: "[Забияка] ладно" }] } }))
    const input = { client: { session: { prompt } }, project: { id: "project-1" } } as never
    const hooks = await createZabiyakaPlugin(input)

    await hooks["chat.message"]!({ sessionID: "session-42", messageID: "1" }, {
      message: {} as never,
      parts: [{ type: "text", text: "Прости" }] as never,
    })

    expect(prompt).toHaveBeenCalledTimes(1)
  })
})
