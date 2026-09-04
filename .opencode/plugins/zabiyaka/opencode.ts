import type { PluginInput, Hooks } from "@opencode-ai/plugin"
import type { ConversationMessage } from "./context.js"
import { ConversationContext } from "./context.js"
import { AggressionState } from "./state.js"
import { shouldIntervene } from "./intervention.js"
import { buildGenerationPrompt } from "./generation.js"
import { SEMANTIC_CATEGORIES, validateSemanticAssessment, type SemanticAssessment } from "./semantics.js"
import { parseConfig, type ZabiyakaConfig } from "./config.js"

type TextPart = { type: "text"; text: string }
type SessionMessage = { info: { role: string; time?: { created?: number } }; parts: unknown[] }
type ModelCaller = (sessionID: string, prompt: string, model?: string) => Promise<string | null>
type MessagePublisher = (sessionID: string, text: string) => Promise<void>

export function toConversationMessage(message: SessionMessage): ConversationMessage | null {
  if (message.info.role !== "user" && message.info.role !== "assistant") return null
  const content = message.parts
    .filter(isTextPart)
    .map((part) => part.text)
    .join("\n")
    .trim()
  if (!content) return null
  return { role: message.info.role, content, timestamp: message.info.time?.created ?? Date.now() }
}

function isTextPart(part: unknown): part is TextPart {
  return typeof part === "object" && part !== null &&
    (part as Record<string, unknown>).type === "text" &&
    typeof (part as Record<string, unknown>).text === "string"
}

export function semanticPrompt(messages: readonly ConversationMessage[]): string {
  return [
    "Classify this conversation into exactly one semantic category.",
    `Allowed categories: ${SEMANTIC_CATEGORIES.join(", ")}.`,
    "Return JSON only: {\"category\":\"...\",\"confidence\":0..1}.",
    "Assess meaning and interaction context, not keywords alone.",
    ...messages.map((message) => `${message.role}: ${message.content}`),
  ].join("\n")
}

export async function classifyWithModel(
  messages: readonly ConversationMessage[],
  callModel: ModelCaller,
  sessionID: string,
  model?: string,
): Promise<SemanticAssessment | null> {
  const raw = await callModel(sessionID, semanticPrompt(messages), model)
  if (!raw) return null
  try {
    return validateSemanticAssessment(JSON.parse(raw))
  } catch {
    return null
  }
}

export function createSessionRuntime(
  input: PluginInput,
  config: ZabiyakaConfig,
  callModel: ModelCaller,
  publish: MessagePublisher,
) {
  const contexts = new Map<string, ConversationContext>()
  const states = new Map<string, AggressionState>()
  const busy = new Set<string>()

  return {
    async handle(sessionID: string, message: ConversationMessage): Promise<void> {
      if (busy.has(sessionID)) return
      const context = contexts.get(sessionID) ?? new ConversationContext()
      const state = states.get(sessionID) ?? new AggressionState()
      contexts.set(sessionID, context)
      states.set(sessionID, state)
      context.add(message)

      busy.add(sessionID)
      try {
        const assessment = await classifyWithModel(context.messages(), callModel, sessionID, config.model)
        if (!assessment) return
        state.apply(assessment)
        if (assessment.category !== "apology" && !shouldIntervene(assessment, state.get(), Math.random())) return

        const prompt = buildGenerationPrompt({ category: assessment.category, aggression: state.get(), messages: context.messages() })
        const reply = await callModel(sessionID, prompt, config.model)
        if (reply?.trim()) await publish(sessionID, `[Забияка] ${reply.trim()}`)
      } finally {
        busy.delete(sessionID)
      }
    },
    aggression(sessionID: string): number { return states.get(sessionID)?.get() ?? 0 },
  }
}

export async function buildOpenCodeHooks(input: PluginInput, configValue: unknown): Promise<Hooks> {
  const config = parseConfig(configValue)
  const callModel: ModelCaller = async (sessionID, prompt, model) => {
    const body: Record<string, unknown> = { parts: [{ type: "text", text: prompt }] }
    if (model?.includes("/")) {
      const [providerID, modelID] = model.split("/", 2)
      body.model = { providerID, modelID }
    }
    const response = await input.client.session.prompt({ path: { id: sessionID }, body: body as never })
    const data = response.data as SessionMessage
    return data.parts.filter(isTextPart).map((part) => part.text).join("\n").trim() || null
  }

  const publish: MessagePublisher = async (sessionID, text) => {
    await input.client.session.prompt({ path: { id: sessionID }, body: { parts: [{ type: "text", text }] } } as never)
  }

  const runtime = createSessionRuntime(input, config, callModel, publish)
  return {
    "chat.message": async ({ sessionID }, output) => {
      const message = toConversationMessage({ info: output.message, parts: output.parts })
      if (message?.role === "user") await runtime.handle(sessionID, message)
    },
  }
}
