import { describe, expect, it, vi } from "vitest"
import { createZabiyakaRuntime } from "../.opencode/plugins/zabiyaka/index.js"

const message = (content: string, role: "user" | "assistant" = "user") => ({
  role,
  content,
  timestamp: Date.now(),
})

describe("Zabiyaka runtime", () => {
  it("runs ordinary -> conflict -> continuation -> apology flow", async () => {
    const classify = vi.fn()
      .mockResolvedValueOnce({ category: "ordinary", confidence: 1 })
      .mockResolvedValueOnce({ category: "conflict", confidence: 1 })
      .mockResolvedValueOnce({ category: "continuation", confidence: 1 })
      .mockResolvedValueOnce({ category: "apology", confidence: 1 })
    const generate = vi.fn().mockResolvedValue("Уладили.")
    const random = vi.fn().mockReturnValue(0)
    const publish = vi.fn().mockResolvedValue(undefined)

    const runtime = createZabiyakaRuntime({ classify, generate, random, publish })

    await runtime.handle(message("обычный разговор"))
    expect(runtime.aggression()).toBe(0)
    expect(publish).toHaveBeenCalledTimes(1)

    await runtime.handle(message("давай поспорим"))
    expect(runtime.aggression()).toBe(12)
    await runtime.handle(message("я продолжаю спор"))
    expect(runtime.aggression()).toBe(20)
    await runtime.handle(message("ладно, извини"))
    expect(runtime.aggression()).toBe(0)
    expect(generate).toHaveBeenCalledTimes(4)
    expect(publish).toHaveBeenCalledTimes(4)
  })

  it("does not mutate state when classification fails", async () => {
    const runtime = createZabiyakaRuntime({
      classify: vi.fn().mockResolvedValue(null),
      generate: vi.fn(),
      random: vi.fn().mockReturnValue(0),
      publish: vi.fn(),
    })

    await runtime.handle(message("сломалась классификация"))
    expect(runtime.aggression()).toBe(0)
  })
})
