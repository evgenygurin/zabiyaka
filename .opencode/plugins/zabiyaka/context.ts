export type ConversationMessage = {
  role: "user" | "assistant"
  content: string
  timestamp: number
}

const MAX_MESSAGES = 20

export class ConversationContext {
  private readonly buffer: ConversationMessage[] = []

  add(message: ConversationMessage): void {
    this.buffer.push(message)
    if (this.buffer.length > MAX_MESSAGES) {
      this.buffer.shift()
    }
  }

  messages(): ConversationMessage[] {
    return [...this.buffer]
  }

  clear(): void {
    this.buffer.length = 0
  }
}
