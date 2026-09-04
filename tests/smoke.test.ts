import { describe, expect, it } from "vitest"
import { createZabiyakaPlugin } from "../.opencode/plugins/zabiyaka/index.js"

describe("Zabiyaka plugin", () => {
  it("exports a plugin initializer", () => {
    expect(typeof createZabiyakaPlugin).toBe("function")
  })
})
