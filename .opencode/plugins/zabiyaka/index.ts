import type { Plugin, Hooks } from "@opencode-ai/plugin"

export const createZabiyakaPlugin = async (): Promise<Hooks> => ({})

const zabiyakaPlugin: Plugin = async () => createZabiyakaPlugin()

export default zabiyakaPlugin
