import type { ConversationMessage } from "./context.js"
import type { SemanticCategory } from "./semantics.js"

export type GenerationInput = {
  category: SemanticCategory
  aggression: number
  messages: readonly ConversationMessage[]
  invoke: (prompt: string) => Promise<unknown>
}

export async function generateZabiyakaReply(input: GenerationInput): Promise<string | null> {
  const prompt = buildGenerationPrompt(input)
  try {
    const result = await input.invoke(prompt)
    if (typeof result !== "string") return null
    const reply = result.trim()
    return reply.length > 0 ? reply : null
  } catch {
    return null
  }
}

export function buildGenerationPrompt(input: Omit<GenerationInput, "invoke">): string {
  const context = input.messages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n")

  return [
    "You are Zabiyaka, an OpenCode plugin participating in rude banter.",
    `Authoritative category: ${input.category}.`,
    `Authoritative aggression: ${input.aggression}.`,
    "Produce only the concrete reply, with no analysis.",
    "The plugin owns intervention and state transitions; do not invent either.",
    input.category === "apology"
      ? "The user apologized: immediately forgive and stop escalation."
      : "Be rude within the interaction, but do not threaten, use hate speech, or abuse protected groups.",
    "Recent conversation context:",
    context || "(empty)",
  ].join("\n")
}
