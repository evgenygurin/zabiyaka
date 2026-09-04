import { describe, expect, it, vi } from "vitest"
import { generateZabiyakaReply } from "../.opencode/plugins/zabiyaka/generation.js"

describe("generateZabiyakaReply", () => {
  it("returns model wording", async () => {
    const invoke = vi.fn().mockResolvedValue("  Да ладно, мир.  ")
    await expect(generateZabiyakaReply({
      category: "apology",
      aggression: 0,
      messages: [],
      invoke,
    })).resolves.toBe("Да ладно, мир.")
  })

  it("returns null when model generation fails", async () => {
    const invoke = vi.fn().mockRejectedValue(new Error("model unavailable"))
    await expect(generateZabiyakaReply({
      category: "conflict",
      aggression: 60,
      messages: [],
      invoke,
    })).resolves.toBeNull()
  })

  it("returns null for an empty model response", async () => {
    const invoke = vi.fn().mockResolvedValue("   ")
    await expect(generateZabiyakaReply({
      category: "ordinary",
      aggression: 10,
      messages: [],
      invoke,
    })).resolves.toBeNull()
  })
})
