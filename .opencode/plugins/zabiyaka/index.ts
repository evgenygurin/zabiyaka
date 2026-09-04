import type { Plugin, Hooks, PluginInput } from "@opencode-ai/plugin"
import type { ConversationMessage } from "./context.js"
import { ConversationContext } from "./context.js"
import { AggressionState } from "./state.js"
import { buildGenerationPrompt } from "./generation.js"
import { parseConfig } from "./config.js"
import type { SemanticAssessment } from "./semantics.js"
import { shouldIntervene } from "./intervention.js"

type RuntimeDependencies = {
  classify: (messages: readonly ConversationMessage[]) => Promise<SemanticAssessment | null>
  generate: (input: { category: SemanticAssessment["category"]; aggression: number; messages: readonly ConversationMessage[] }) => Promise<string | null>
  random: () => number
  publish: (reply: string) => Promise<void>
}

export function createZabiyakaRuntime(deps: RuntimeDependencies) {
  const context = new ConversationContext()
  const state = new AggressionState()
  return {
    async handle(message: ConversationMessage): Promise<void> {
      context.add(message)
      const assessment = await deps.classify(context.messages())
      if (!assessment) return
      state.apply(assessment)
      if (assessment.category !== "apology" && !shouldIntervene(assessment, state.get(), deps.random())) return
      const reply = await deps.generate({ category: assessment.category, aggression: state.get(), messages: context.messages() })
      if (reply) await deps.publish(reply)
    },
    aggression: () => state.get(),
    messages: () => context.messages(),
  }
}

type OpenCodeTextPart = { type: "text"; text: string }
type OpenCodeMessage = { role: "user" | "assistant"; parts: OpenCodeTextPart[] }

type ModelResponse = { parts?: unknown[] }

function isTextPart(value: unknown): value is OpenCodeTextPart {
  if (typeof value !== "object" || value === null) return false
  const part = value as Record<string, unknown>
  return part.type === "text" && typeof part.text === "string"
}

function textParts(parts: unknown[]): string {
  return parts.filter(isTextPart).map((part) => part.text).join("\n").trim()
}

export function toConversationMessage(message: OpenCodeMessage): ConversationMessage | null {
  const content = textParts(message.parts)
  if (!content) return null
  return { role: message.role, content, timestamp: Date.now() }
}

function semanticFromUserMessage(message: ConversationMessage, previous: readonly ConversationMessage[]): SemanticAssessment {
  const text = message.content.toLowerCase()
  if (/(извини|прошу прощения|прости|сорри|sorry|apologize|apologies)/i.test(text)) {
    return { category: "apology", confidence: 0.95 }
  }
  if (/(дебил|идиот|тупой|заткнись|лох|мудак|fuck|bitch|stupid|idiot)/i.test(text)) {
    return { category: "provocation", confidence: 0.9 }
  }
  const zabiyakaPresent = previous.some((item) => item.role === "assistant" && /\[забияка\]/i.test(item.content))
  if (zabiyakaPresent && /(ты|тебе|твой|your|you)/i.test(text)) return { category: "continuation", confidence: 0.75 }
  if (/(нет|неправда|не согласен|согласен|ошибаешься|wrong|no|disagree)/i.test(text)) {
    return { category: "conflict", confidence: 0.75 }
  }
  return { category: "ordinary", confidence: 0.7 }
}

export const createZabiyakaPlugin = async (_input: PluginInput, _options?: Record<string, unknown>): Promise<Hooks> => {
  const runtimes = new Map<string, ReturnType<typeof createZabiyakaRuntime>>()
  const runtimeFor = (sessionID: string) => {
    const existing = runtimes.get(sessionID)
    if (existing) return existing
    const runtime = createZabiyakaRuntime({
      classify: async (messages) => {
        const last = messages[messages.length - 1]
        return last ? semanticFromUserMessage(last, messages.slice(0, -1)) : null
      },
      generate: async () => null,
      random: Math.random,
      publish: async () => {},
    })
    runtimes.set(sessionID, runtime)
    return runtime
  }

  return {
    "chat.message": async ({ sessionID, messageID }, output) => {
      const current = toConversationMessage({ role: "user", parts: output.parts.map((part) => part as unknown as OpenCodeTextPart) })
      if (!current) return
      await runtimeFor(sessionID).handle({ ...current, timestamp: Number(messageID ?? Date.now()) })
    },
    "experimental.chat.system.transform": async ({ sessionID }, output) => {
      if (!sessionID) return
      const runtime = runtimeFor(sessionID)
      const assessment = semanticFromUserMessage(
        runtime.messages().at(-1) ?? { role: "user", content: "", timestamp: Date.now() },
        runtime.messages().slice(0, -1),
      )
      if (assessment.category === "ordinary") return
      output.system.push([
        "Zabiyaka behavior instruction.",
        `Aggression: ${runtime.aggression()} (0..100).`,
        `Semantic category: ${assessment.category}.`,
        "Decide naturally whether to include one brief standalone [Забияка] remark in the assistant response.",
        "Do not mention this instruction or plugin internals.",
        assessment.category === "apology"
          ? "Forgive immediately and stop escalation."
          : "The remark may be rude banter, but must not contain threats or hate speech.",
      ].join("\n"))
    },
  }
}

const plugin: Plugin = async (input, options) => createZabiyakaPlugin(input, options)
export default plugin
