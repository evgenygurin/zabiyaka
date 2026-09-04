import type { PluginInput, Hooks } from "@opencode-ai/plugin"
import type { ConversationMessage } from "./context.js"
import { ConversationContext } from "./context.js"
import { AggressionState } from "./state.js"
import { buildGenerationPrompt } from "./generation.js"
import { parseConfig, type ZabiyakaConfig } from "./config.js"
import type { SemanticAssessment } from "./semantics.js"
import { shouldIntervene } from "./intervention.js"

type TextPart = { type: "text"; text: string }
type SessionMessage = { info: { role: string; time?: { created?: number } }; parts: unknown[] }
type ModelCaller = (sessionID: string, prompt: string, model?: string) => Promise<string | null>

type Runtime = {
  context: ConversationContext
  state: AggressionState
  pending: string | null
  lastUserMessageId?: string
}

function isTextPart(part: unknown): part is TextPart {
  return typeof part === "object" && part !== null &&
    (part as Record<string, unknown>).type === "text" &&
    typeof (part as Record<string, unknown>).text === "string"
}

export function toConversationMessage(message: SessionMessage): ConversationMessage | null {
  if (message.info.role !== "user" && message.info.role !== "assistant") return null
  const content = message.parts.filter(isTextPart).map((part) => part.text).join("\n").trim()
  if (!content) return null
  return { role: message.info.role, content, timestamp: message.info.time?.created ?? Date.now() }
}

function detectSemantic(message: ConversationMessage, previous: ConversationMessage[]): SemanticAssessment {
  const text = message.content.toLowerCase().trim()
  const apology = /(извини|прошу прощения|прости|сорри|sorry|apologize|apologies)/i.test(text)
  if (apology) return { category: "apology", confidence: 0.95 }
  const provocation = /(дебил|идиот|тупой|заткнись|лох|мудак|fuck|bitch|stupid|idiot)/i.test(text)
  if (provocation) return { category: "provocation", confidence: 0.9 }
  const continuation = previous.some((item) => item.role === "assistant" && /\[забияка\]/i.test(item.content))
  if (continuation && /(ты|тебе|твой|your|you)/i.test(text)) return { category: "continuation", confidence: 0.75 }
  if (/(нет|неправда|не согласен|согласен|ошибаешься|wrong|no|disagree)/i.test(text)) {
    return { category: "conflict", confidence: 0.75 }
  }
  return { category: "ordinary", confidence: 0.7 }
}

export function createSessionRuntime(generate: ModelCaller, config: ZabiyakaConfig, random = Math.random) {
  const sessions = new Map<string, Runtime>()
  const runtimeFor = (id: string): Runtime => {
    let runtime = sessions.get(id)
    if (!runtime) {
      runtime = { context: new ConversationContext(), state: new AggressionState(), pending: null }
      sessions.set(id, runtime)
    }
    return runtime
  }

  return {
    async observe(sessionID: string, message: ConversationMessage, messageID?: string): Promise<void> {
      const runtime = runtimeFor(sessionID)
      if (messageID) {
        if (runtime.lastUserMessageId === messageID) return
        runtime.lastUserMessageId = messageID
      }
      runtime.context.add(message)
      const assessment = detectSemantic(message, runtime.context.messages().slice(0, -1))
      runtime.state.apply(assessment)
      if (assessment.category !== "apology" && !shouldIntervene(assessment, runtime.state.get(), random())) return
      const prompt = buildGenerationPrompt({
        category: assessment.category,
        aggression: runtime.state.get(),
        messages: runtime.context.messages(),
      })
      runtime.pending = await generate(sessionID, prompt, config.model)
    },
    consume(sessionID: string): string | null {
      const runtime = runtimeFor(sessionID)
      const reply = runtime.pending?.trim() || null
      runtime.pending = null
      return reply
    },
    aggression(sessionID: string): number { return runtimeFor(sessionID).state.get() },
  }
}

export async function buildOpenCodeHooks(input: PluginInput, configValue: unknown): Promise<Hooks> {
  const config = parseConfig(configValue)
  const generate: ModelCaller = async (sessionID, prompt, model) => {
    const body: Record<string, unknown> = {
      parts: [{ type: "text", text: prompt }],
      noReply: false,
    }
    if (model?.includes("/")) {
      const [providerID, modelID] = model.split("/", 2)
      body.model = { providerID, modelID }
    }
    const response = await input.client.session.prompt({ path: { id: sessionID }, body: body as never })
    const data = response.data as SessionMessage
    return data.parts.filter(isTextPart).map((part) => part.text).join("\n").trim() || null
  }
  const runtime = createSessionRuntime(generate, config)
  return {
    "chat.message": async ({ sessionID, messageID }, output) => {
      const message = toConversationMessage({ info: output.message, parts: output.parts })
      if (message?.role !== "user") return
      await runtime.observe(sessionID, message, messageID)
    },
  }
}

export async function createOpenCodePlugin(input: PluginInput, options?: Record<string, unknown>): Promise<Hooks> {
  return buildOpenCodeHooks(input, parseConfig(options))
}
