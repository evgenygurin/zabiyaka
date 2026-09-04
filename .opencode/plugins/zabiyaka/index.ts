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
      const reply = await deps.generate({
        category: assessment.category,
        aggression: state.get(),
        messages: context.messages(),
      })
      if (reply) await deps.publish(reply)
    },
    aggression: () => state.get(),
  }
}

type OpenCodeTextPart = { type: "text"; text: string }

type OpenCodeMessage = {
  role: "user" | "assistant"
  parts: OpenCodeTextPart[]
}

function textParts(parts: unknown[]): string {
  return parts
    .map((part) => part as unknown)
    .filter((part): part is OpenCodeTextPart => {
      if (typeof part !== "object" || part === null) return false
      const value = part as Record<string, unknown>
      return value.type === "text" && typeof value.text === "string"
    })
    .map((part) => part.text)
    .join("\n")
    .trim()
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
  if (previous.some((item) => item.role === "assistant" && /\[забияка\]/i.test(item.content))) {
    if (/(ты|тебе|твой|your|you)/i.test(text)) return { category: "continuation", confidence: 0.75 }
  }
  if (/(нет|неправда|не согласен|согласен|ошибаешься|wrong|no|disagree)/i.test(text)) {
    return { category: "conflict", confidence: 0.75 }
  }
  return { category: "ordinary", confidence: 0.7 }
}

export const createZabiyakaPlugin = async (input: PluginInput, options?: Record<string, unknown>): Promise<Hooks> => {
  const config = parseConfig(options)
  const runtimes = new Map<string, ReturnType<typeof createZabiyakaRuntime>>()
  const internalTurns = new Set<string>()

  const runtimeFor = (sessionID: string) => {
    const existing = runtimes.get(sessionID)
    if (existing) return existing
    const runtime = createZabiyakaRuntime({
      classify: async (messages) => semanticFromUserMessage(messages[messages.length - 1]!, messages.slice(0, -1)),
      generate: async ({ category, aggression, messages }) => {
        const prompt = buildGenerationPrompt({ category, aggression, messages })
        internalTurns.add(sessionID)
        const body: Record<string, unknown> = { parts: [{ type: "text", text: prompt }], noReply: false }
        if (config.model?.includes("/")) {
          const [providerID, modelID] = config.model.split("/", 2)
          body.model = { providerID, modelID }
        }
        try {
          const response = await input.client.session.prompt({ path: { id: sessionID }, body: body as never })
          return textParts((response.data as { parts?: unknown[] }).parts ?? []) || null
        } finally {
          internalTurns.delete(sessionID)
        }
      },
      random: Math.random,
      publish: async (reply) => {
        const body = { parts: [{ type: "text", text: `[Забияка] ${reply}` }] }
        await input.client.session.prompt({ path: { id: sessionID }, body: body as never })
      },
    })
    runtimes.set(sessionID, runtime)
    return runtime
  }

  return {
    "chat.message": async ({ sessionID, messageID }, output) => {
      const current = toConversationMessage({ role: "user", parts: output.parts as unknown as OpenCodeTextPart[] })
      if (!current || current.content.startsWith("[Забияка]")) return
      await runtimeFor(sessionID).handle({ ...current, timestamp: Number(messageID ?? Date.now()) })
    },
  }
}

const plugin: Plugin = async (input, options) => createZabiyakaPlugin(input, options)
export default plugin
