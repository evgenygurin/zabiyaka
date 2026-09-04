import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG, parseConfig } from "../.opencode/plugins/zabiyaka/config.js"

describe("config", () => {
  it("defaults to the current session model", () => {
    expect(DEFAULT_CONFIG).toEqual({})
  })

  it("accepts a provider/model override", () => {
    expect(parseConfig({ model: "openai/gpt-5" })).toEqual({ model: "openai/gpt-5" })
  })

  it("ignores malformed overrides", () => {
    expect(parseConfig({ model: 42 })).toEqual({})
    expect(parseConfig(null)).toEqual({})
  })
})
