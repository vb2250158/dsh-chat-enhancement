/** 从完整会话日志重建目标用量；不写入目标状态或修改历史消息。 */
export function createGoalMetricsProjection(z, lastAssistantStreamChunk) {
  const count = z.number().nonnegative()
  const sample = z.object({ turn: count, step: count, tokens: count, reported: z.boolean() }).nullable()
  const goal = z.object({ id: z.string(), createdAt: count, phase: z.string(), completedAt: count.nullable(),
    tokens: count, missing: count, last: sample, messageId: z.string().nullable(), completionTurn: count.nullable() })
  const summary = z.object({ id: z.string(), createdAt: count, completedAt: count, tokens: count, missing: count })
  const stateSchema = z.object({ current: goal.nullable(), turn: count.nullable(), completed: z.record(z.string(), summary) })
  return {
    key: 'chatGoalMetrics', stateVersion: 1, stateSchema,
    init: () => ({ current: null, turn: null, completed: {} }),
    apply(state, event) {
      if (event.type === 'turn/start') return { ...state, turn: event.data.turn }
      if (event.type === 'goal/change') {
        const change = event.data
        if (change.operation === 'clear') return { ...state, current: null }
        if (change.operation === 'create') return { ...state, current: {
          id: change.goal.id, createdAt: change.createdAt, phase: change.goal.phase, completedAt: null,
          tokens: 0, missing: 0, last: null, messageId: null, completionTurn: null,
        } }
        if (state.current?.id !== change.goal.id) return state
        const current = { ...state.current, phase: change.goal.phase }
        if (change.operation === 'complete') {
          current.completedAt = change.updatedAt
          current.completionTurn = state.turn
        }
        return { ...state, current }
      }
      const current = state.current
      if (current === null) return state
      if (event.type === 'turn/end') {
        if (current.completedAt === null || current.completionTurn !== event.data.turn || current.messageId === null) return { ...state, turn: null }
        const { id, createdAt, tokens, missing } = current
        const completedAt = Math.max(current.completedAt, event.time)
        return { ...state, turn: null, current: { ...current, completedAt, completionTurn: null },
          completed: { ...state.completed, [current.messageId]: { id, createdAt, completedAt, tokens, missing } } }
      }
      if (current.completedAt !== null && current.completionTurn === null) return state
      if (event.type === 'llm/retry-started') return { ...state, current: { ...current, last: null } }
      if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return state
      const usage = event.data.usage ?? lastAssistantStreamChunk(event.data.stream ?? [], 'usage')?.usage
      const tokens = usage === undefined ? 0 : usage.totalTokens ??
        (usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0))
      const { turn, step } = event.data
      const previous = current.last?.turn === turn && current.last.step === step ? current.last : null
      return { ...state, current: { ...current,
        tokens: current.tokens - (previous?.tokens ?? 0) + tokens,
        missing: current.missing - (previous !== null && !previous.reported ? 1 : 0) + (usage === undefined ? 1 : 0),
        last: { turn, step, tokens, reported: usage !== undefined },
        messageId: event.type === 'assistant/message' ? event.data.message.id : current.messageId,
      } }
    },
    wire: { viewSchema: stateSchema, view: state => state },
  }
}
