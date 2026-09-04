# Забияка — Design Specification v1

**Date:** 2026-09-04  
**Status:** Design approved by user; implementation not started  
**Target:** OpenCode only

## 1. Purpose

Забияка — самостоятельный OpenCode plugin, структурно написанный по аналогии с Superpowers, но без зависимости от Superpowers. Plugin наблюдает за разговором OpenCode и иногда самостоятельно вмешивается отдельной репликой. Поведение определяется текущим контекстом, внутренним состоянием агрессии, семантической оценкой ситуации и случайностью.

The plugin is intentionally small. It is not an MCP server, backend, daemon, database-backed service, or controller of another agent.

## 2. Scope

### Included in v1

- OpenCode integration only.
- OpenCode message events as the input stream.
- User and model messages as conversational context.
- In-memory sliding window of the last 20 relevant messages.
- Semantic classification into five predefined categories.
- In-memory aggression state from 0 to 100.
- Adaptive intervention probability.
- Escalation and de-escalation.
- Apology detection and immediate forgiveness.
- Hybrid generation: plugin controls behavioral constraints; an LLM produces the actual wording.
- Current OpenCode session model by default.
- Optional configured model override.
- Separate Zabiyaka message as output.
- Unit tests for deterministic core logic and integration behavior.

### Explicitly excluded

- Superpowers dependency or integration.
- Other coding harnesses in v1.
- MCP.
- Database or persistent storage.
- Separate HTTP server or daemon.
- Keyword-trigger engine.
- Separate ML classifier/model service.
- External long-term memory.
- Full-session history beyond the 20-message window.

## 3. High-level architecture

```text
OpenCode
   │ message events
   ▼
context.ts
   │ last 20 user/model messages
   ▼
semantics.ts
   │ category + confidence
   ▼
state.ts
   │ aggression 0..100
   ▼
intervention.ts
   │ semantic assessment + adaptive randomness
   ├── no  → silence
   └── yes
         ▼
   generation.ts
         │ LLM wording under plugin constraints
         ▼
   separate Zabiyaka message
```

The plugin owns its own state and decision-making. The LLM does not decide whether Zabiyaka should intervene.

## 4. OpenCode lifecycle

On plugin initialization:

1. Load configuration.
2. Initialize an empty context buffer.
3. Initialize aggression to `0`.
4. Subscribe to the relevant OpenCode message events.

For every relevant incoming user/model message:

1. Append the message to the sliding context buffer.
2. Retain only the most recent 20 messages.
3. Perform semantic assessment of the current situation using the available context.
4. Update aggression according to the category and interaction state.
5. Calculate intervention probability.
6. Decide whether to intervene.
7. If intervention is selected, generate a Zabiyaka reply.
8. Publish the reply as a separate Zabiyaka message.

Technical event names and the exact message-publication API must be verified against the current OpenCode plugin API during implementation; the implementation must not invent unsupported APIs.

## 5. Conversation context

The plugin maintains a sliding window containing at most 20 conversational messages.

Conceptual model:

```ts
type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};
```

Only user/model conversational text that is useful for semantic assessment belongs in this context. Internal technical events, tool payloads, and unrelated system data must not be blindly treated as conversational messages.

When the 21st message is added, the oldest message is removed.

The context exists only in process memory. Restarting the plugin/OpenCode process loses it.

## 6. Semantic assessment

The classifier uses exactly five predefined semantic categories:

| Category | Meaning |
|---|---|
| `conflict` | The user enters into conflict with Zabiyaka. |
| `continuation` | An existing conflict is being continued. |
| `provocation` | The current interaction is a clear provocation. |
| `ordinary` | Ordinary conversation with no specific conflict signal. |
| `apology` | The user is making a genuine attempt to reconcile/apologize. |

There are no fixed keyword triggers. Classification is semantic and uses the recent conversation context.

The classifier returns a structured result conceptually equivalent to:

```json
{
  "category": "conflict",
  "confidence": 0.87
}
```

The plugin must validate both category and confidence. Invalid or malformed classifier output results in no intervention and must not corrupt state.

## 7. Aggression state

Aggression is an in-memory scalar in the inclusive range `0..100`.

Initial state:

```text
aggression = 0
```

The exact category deltas are configuration/implementation details, but the semantic direction is fixed:

- `conflict` increases aggression.
- `continuation` increases aggression.
- `provocation` increases aggression more strongly.
- `ordinary` does not escalate conflict.
- `apology` immediately moves the system to a calm state.

The value must always be clamped to `0..100`.

## 8. De-escalation

When the interaction is not feeding the conflict, aggression decreases gradually. A calm/ordinary interaction must not keep aggression permanently elevated.

The exact decrement is configurable/implementation-level behavior, but it must be deterministic and testable.

## 9. Intervention probability

The baseline probability is a linear function of aggression:

```text
P = 0.02 + 0.23 * aggression / 100
```

Therefore:

- aggression `0` → `2%`;
- aggression `50` → `13.5%`;
- aggression `100` → `25%`.

Randomness is evaluated after semantic assessment. The probability is not a timer and does not imply an unconditional response to every message.

Semantic confidence and category affect whether the baseline probability is applicable. The exact policy must be deterministic and testable; low-confidence semantic results must not cause unsafe/unexpected intervention.

## 10. Escalation model

The intended state flow is:

```text
calm
  ↓ spontaneous intervention
rude interaction
  ↓ user argues / conflicts
aggression increases
  ↓
escalation
  ↓ continued engagement
higher aggression
```

The generated wording should reflect the current aggression level and interaction category. The plugin, not the LLM, owns the state transition.

## 11. Apology and forgiveness

`apology` is a special transition valid from any aggression level:

```text
ANY STATE
    ↓ apology
aggression = 0
    ↓
calm
```

After a genuine apology, Zabiyaka immediately accepts the apology and stops escalating. The generated response must reflect forgiveness and the reset to calm.

## 12. Hybrid generation contract

The plugin controls:

- whether Zabiyaka speaks;
- semantic category;
- aggression level;
- interaction/escalation state;
- de-escalation or forgiveness behavior;
- model selection;
- behavioral constraints supplied to generation.

The LLM controls only the concrete wording of the Zabiyaka reply.

The LLM must not be the authority for the intervention decision or state transition.

The generation input should contain the minimum relevant context and explicit behavioral constraints rather than an unconstrained instruction to invent behavior.

The plugin should avoid generating threats, hate speech, or targeted abusive content. The intended behavior is rude/insulting banter within the fictional plugin interaction, not harassment of protected groups.

## 13. Model selection

Default behavior:

```text
use the current OpenCode session model
```

Optional configuration may override this with a model identifier, conceptually:

```json
{
  "model": "provider/model"
}
```

If no override is configured, the current session model is used.

The exact OpenCode API for invoking the configured/current model must be verified during implementation.

## 14. Output contract

When the intervention decision is positive, Zabiyaka publishes a separate message rather than injecting its text into the normal assistant response.

The implementation must use the supported OpenCode plugin mechanism for creating/publishing that message. The design does not assume an API method name until verified against current OpenCode documentation/source.

## 15. Module structure

The preferred implementation is one OpenCode plugin package split into small modules:

```text
.opencode/
└── plugins/
    └── zabiyaka/
        ├── index.ts
        ├── context.ts
        ├── semantics.ts
        ├── state.ts
        ├── intervention.ts
        ├── generation.ts
        └── config.ts
```

This is a single plugin, not multiple services.

Responsibilities:

- `index.ts` — OpenCode lifecycle/event wiring.
- `context.ts` — 20-message sliding window.
- `semantics.ts` — semantic category contract and validation.
- `state.ts` — aggression and interaction state transitions.
- `intervention.ts` — adaptive probability and intervention decision.
- `generation.ts` — LLM prompt/response generation.
- `config.ts` — defaults and optional model override.

## 16. Testing strategy

### Context tests

- appending messages;
- maximum size of 20;
- oldest message eviction;
- user/model role handling.

### State tests

- initial aggression is 0;
- escalation increases aggression;
- aggression never exceeds 100;
- de-escalation lowers aggression;
- aggression never falls below 0;
- apology resets to calm.

### Intervention tests

- aggression 0 maps to 2%;
- aggression 50 maps to 10%;
- aggression 100 maps to 25%;
- deterministic random source can force both intervention and silence;
- semantic confidence/category policy is respected.

### Semantic tests

- only five categories are accepted;
- confidence is validated;
- malformed output is rejected safely.

### Integration scenario

```text
ordinary
 → spontaneous Zabiyaka intervention
 → conflict
 → escalation
 → continuation
 → high aggression
 → apology
 → forgiveness
 → calm
```

## 17. Non-goals and simplicity constraints

The implementation should prefer the smallest mechanism supported by the current OpenCode API. No abstraction should be introduced merely for future extensibility. The plugin should remain understandable as a small reactive component with explicit state and deterministic core logic.

## 18. Acceptance criteria for the design

The implementation is considered aligned with this design only if:

1. It runs as an OpenCode plugin.
2. It has no dependency on Superpowers.
3. It observes both user and model conversational messages.
4. It retains no more than 20 messages in its own in-memory context.
5. It has no keyword-trigger engine.
6. It uses the five defined semantic categories.
7. Aggression is maintained in `0..100` in process memory.
8. Intervention probability follows the approved `2%..25%` aggression mapping.
9. Conflict can escalate and calm interaction can de-escalate.
10. Apology causes immediate forgiveness/reset.
11. The plugin controls intervention/state while the LLM supplies wording.
12. The current session model is the default, with an optional model override.
13. Zabiyaka appears as a separate message using a verified OpenCode-supported mechanism.
14. No persistence, MCP, server, daemon, database, or other harness integration is introduced.
15. Core behavior is covered by automated tests.
