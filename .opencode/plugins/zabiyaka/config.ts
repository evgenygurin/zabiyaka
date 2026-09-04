export type ZabiyakaConfig = {
  model?: string
}

export const DEFAULT_CONFIG: ZabiyakaConfig = {}

export function parseConfig(value: unknown): ZabiyakaConfig {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_CONFIG }
  const model = (value as Record<string, unknown>).model
  return typeof model === "string" && model.length > 0 ? { model } : { ...DEFAULT_CONFIG }
}
