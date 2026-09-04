import type { ConversationMessage } from "./context.js"

export const SEMANTIC_CATEGORIES = [
  "conflict",
  "continuation",
  "provocation",
  "ordinary",
  "apology",
] as const

export type SemanticCategory = (typeof SEMANTIC_CATEGORIES)[number]

export type SemanticAssessment = {
  category: SemanticCategory
  confidence: number
}

export type SemanticClassifier = (
  messages: readonly ConversationMessage[],
) => Promise<SemanticAssessment | null>

export function validateSemanticAssessment(value: unknown): SemanticAssessment | null {
  if (!isRecord(value)) return null
  if (!isSemanticCategory(value.category)) return null
  if (typeof value.confidence !== "number" || !Number.isFinite(value.confidence)) return null
  if (value.confidence < 0 || value.confidence > 1) return null
  return { category: value.category, confidence: value.confidence }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isSemanticCategory(value: unknown): value is SemanticCategory {
  return typeof value === "string" && (SEMANTIC_CATEGORIES as readonly string[]).includes(value)
}
