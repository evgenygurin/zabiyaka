import { describe, expect, it, vi } from "vitest"
import { createZabiyakaPlugin } from "../.opencode/plugins/zabiyaka/index.js"

describe("OpenCode hook", () => {
  it("registers chat.message without private OpenCode APIs", async () => {
    const prompts: Array<{ sessionID: string; body: unknown }> = []
    const input = {
      project: { id: "project-1" },
      client: {
        session: {
          prompt: vi.fn(async (options: { path: { id: string }; body: unknown }) => {
            prompts.push({ sessionID: options.path.id, body: options.body })
            return { data: { parts: [{ type: "text", text: "[Забияка] ну наконец-то" }] } }
          }),
        },
      },
    } as never

    const hooks = await createZabiyakaPlugin(input)
    expect(hooks["chat.message"]).toBeTypeOf("function")
    await hooks["chat.message"]!({ sessionID: "session-42", messageID: "msg-1" }, {
      message: {} as never,
      parts: [{ type: "text", text: "Прости" }] as never,
    })
    expect(prompts).toHaveLength(1)
    expect(prompts[0]?.sessionID).toBe("session-42")
  })
})
