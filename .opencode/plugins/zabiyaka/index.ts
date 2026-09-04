import type { Plugin, Hooks, PluginInput } from "@opencode-ai/plugin"
import type { ConversationMessage } from "./context.js"
import { ConversationContext } from "./context.js"
import { AggressionState } from "./state.js"
import { buildGenerationPrompt } from "./generation.js"
import { parseConfig, type ZabiyakaConfig } from "./config.js"
import type { SemanticAssessment } from "./semantics.js"
import { shouldIntervene } from "./intervention.js"

type RuntimeDependencies = {
  classify: (messages: readonly ConversationMessage[]) => Promise<unknown>
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
      const assessment = await deps.classify(context.messages()) as SemanticAssessment | null
      if (!assessment) return
      state.apply(assessment)
      if (assessment.category !== "apology" && !shouldIntervene(assessment, state.get(), deps.random())) return
      const reply = await deps.generate({ category: assessment.category, aggression: state.get(), messages: context.messages() })
      if (reply) await deps.publish(reply)
    },
    aggression: () => state.get(),
  }
}

type ModelCaller = (sessionID: string, prompt: string) => Promise<string | null>

type Runtime = {
  context: ConversationContext
  state: AggressionState
  lastMessageId?: string
  pending: string | null
}

function classify(message: ConversationMessage, previous: readonly ConversationMessage[]): SemanticAssessment {
  const text = message.content.toLowerCase()
  if (/(извини|прошу прощения|прости|сорри|sorry|apologize|apologies)/i.test(text)) {
    return { category: "apology", confidence: 0.95 }
  }
  if (/(дебил|идиот|тупой|заткнись|лох|мудак|fuck|bitch|stupid|idiot)/i.test(text)) {
    return { category: "provocation", confidence: 0.9 }
  }
  const priorZabiyaka = previous.some((item) => item.role === "assistant" && /\[забияка\]/i.test(item.content))
  if (priorZabiyaka && /(ты|тебе|твой|your|you)/i.test(text)) {
    return { category: "continuation", confidence: 0.75 }
  }
  if (/(нет|неправда|не согласен|согласен|ошибаешься|wrong|no|disagree)/i.test(text)) {
    return { category: "conflict", confidence: 0.75 }
  }
  return { category: "ordinary", confidence: 0.7 }
}

export function createSessionRuntime(
  generate: ModelCaller,
  config: ZabiyakaConfig,
  random = Math.random,
) {
  const sessions = new Map<string, Runtime>()
  const runtimeFor = (sessionID: string): Runtime => {
    const existing = sessions.get(sessionID)
    if (existing) return existing
    const runtime: Runtime = {
      context: new ConversationContext(),
      state: new AggressionState(),
      pending: null,
    }
    sessions.set(sessionID, runtime)
    return runtime
  }

  return {
    async observe(sessionID: string, message: ConversationMessage, messageID?: string): Promise<void> {
      const runtime = runtimeFor(sessionID)
      if (messageID) {
        if (runtime.lastMessageId === messageID) return
        runtime.lastMessageId = messageID
      }
      const previous = runtime.context.messages()
      runtime.context.add(message)
      const assessment = classify(message, previous)
      runtime.state.apply(assessment)
      if (assessment.category !== "apology" && !shouldIntervene(assessment, runtime.state.get(), random())) return
      const prompt = buildGenerationPrompt({
        category: assessment.category,
        aggression: runtime.state.get(),
        messages: runtime.context.messages(),
      })
      const result = await generate(sessionID, prompt)
      runtime.pending = result?.trim() || null
    },
    consume(sessionID: string): string | null {
      const runtime = runtimeFor(sessionID)
      const result = runtime.pending
      runtime.pending = null
      return result
    },
    aggression(sessionID: string): number {
      return runtimeFor(sessionID).state.get()
    },
  }
}

export const createZabiyakaPlugin = async (input: PluginInput, options?: Record<string, unknown>): Promise<Hooks> => {
  const config = parseConfig(options)
  const runtime = createSessionRuntime(async (prompt) => {
    const body: Record<string, unknown> = { parts: [{ type: "text", text: prompt }] }
    if (config.model?.includes("/")) {
      const [providerID, modelID] = config.model.split("/", 2)
      body.model = { providerID, modelID }
    }
    const response = await input.client.session.prompt({
      path: { id: input.project.id },
      body: body as never,
    })
    const data = response.data as { parts?: unknown[] }
    const text = (data.parts ?? [])
      .filter((part): part is { type: "text"; text: string } =>
        typeof part === "object" && part !== null &&
        (part as Record<string, unknown>).type === "text" &&
        typeof (part as Record<string, unknown>).text === "string")
      .map((part) => part.text)
      .join("\n")
      .trim()
    return text || null
  }, config)

  return {
    "chat.message": async ({ sessionID, messageID }, output) => {
      const message = {
        role: "user" as const,
        content: output.parts
          .map((part) => part as unknown)
          .filter((part): part is { type: "text"; text: string } =>
            typeof part === "object" && part !== null &&
            (part as Record<string, unknown>).type === "text" &&
            typeof (part as Record<string, unknown>).text === "string")
          .map((part) => part.text)
          .join("\n")
          .trim(),
        timestamp: Date.now(),
      }
      if (message.content) await runtime.observe(sessionID, message, messageID)
    },
  }
}

const plugin: Plugin = async (input, options) => createZabiyakaPlugin(input, options)
export default plugin
