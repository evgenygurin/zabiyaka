import type { Plugin, Hooks, PluginInput } from "@opencode-ai/plugin"
import type { ConversationMessage } from "./context.js"
import { ConversationContext } from "./context.js"
import { classifyConversation, type SemanticAssessment, type SemanticInvoker } from "./semantics.js"
import { AggressionState } from "./state.js"
import { shouldIntervene } from "./intervention.js"
import { generateZabiyakaReply } from "./generation.js"
import { DEFAULT_CONFIG, parseConfig, type ZabiyakaConfig } from "./config.js"
import { buildOpenCodeHooks } from "./opencode.js"

type RuntimeDependencies = {
  classify: SemanticInvoker
  generate: typeof generateZabiyakaReply
  random: () => number
  publish: (reply: string) => Promise<void>
}

export function createZabiyakaRuntime(deps: RuntimeDependencies) {
  const context = new ConversationContext()
  const state = new AggressionState()

  return {
    async handle(message: ConversationMessage): Promise<void> {
      context.add(message)
      const assessment = await classifyConversation(context.messages(), deps.classify)
      if (!assessment) return
      state.apply(assessment)
      const mustForgive = assessment.category === "apology"
      if (!mustForgive && !shouldIntervene(assessment, state.get(), deps.random())) {
        return
      }

      const reply = await deps.generate({
        category: assessment.category,
        aggression: state.get(),
        messages: context.messages(),
        invoke: async (prompt) => prompt,
      })
      if (reply) await deps.publish(reply)
    },
    aggression: () => state.get(),
  }
}

export const createZabiyakaPlugin = async (input: PluginInput, options?: Record<string, unknown>): Promise<Hooks> => {
  const config: ZabiyakaConfig = parseConfig({ ...DEFAULT_CONFIG, ...(options ?? {}) })
  return buildOpenCodeHooks(input, config)
}

const zabiyakaPlugin: Plugin = async (input: PluginInput, options) => createZabiyakaPlugin(input, options)

export default zabiyakaPlugin
