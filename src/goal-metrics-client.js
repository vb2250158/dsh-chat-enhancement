/** 目标栏复用公开 GoalBar/GoalEditDialog，统计从宿主日志投影读取。 */
export const goalMetricsLocales = {
  zh: { completed: '目标已完成', elapsed: '用时', running: '已运行', partial: '已记录', detail: '包含等待和暂停时间；token 为本会话目标期间的输入、缓存和输出用量，含重试，不含子会话。' },
  en: { completed: 'Goal completed', elapsed: 'Elapsed', running: 'Elapsed', partial: 'Recorded', detail: 'Includes waiting and pauses. Tokens cover input, cache and output in this session during the goal, including retries, excluding child sessions.' },
}

export function goalDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(seconds / 3600)
  return `${hours > 0 ? `${hours}:` : ''}${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function GoalCompletionBadge({ messageId, useProjection, t }) {
  const summary = useProjection('chatGoalMetrics')?.completed[messageId]
  if (!summary) return null
  const tokens = `${summary.missing > 0 ? `${t('partial')} ≥ ` : ''}${summary.tokens.toLocaleString()} token`
  return React.createElement(Tooltip, { label: t('detail') },
    React.createElement('span', { 'data-dsh-goal-completed': summary.id, className: 'dsh-goal-completed' },
      `${t('completed')} · ${tokens} · ${t('elapsed')} ${goalDuration(summary.completedAt - summary.createdAt)}`))
}

/** 正式目标变更与连接重置使旧读失效；无订阅时释放所有监听。 */
export function goalActivationSource(binding, remote, sessionId, onReset) {
  let value = {}, generation = 0, dispose = []
  let running = binding.session.getSnapshot().running
  const listeners = new Set()
  const publish = goal => {
    value = goal ? { id: goal.id, revision: goal.revision, activation: goal.activation } : {}
    for (const listener of listeners) listener()
  }
  const refresh = () => {
    const epoch = ++generation
    publish(undefined)
    void remote.goals.get(sessionId).then(result => {
      if (epoch === generation && listeners.size && result.ok) publish(result.value)
    }).catch(() => { /* 读取失败保持未知，正式变更或重连后重试。 */ })
  }
  return {
    getSnapshot: () => value,
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) {
        dispose = [binding.session.projections.faceOf('goal').subscribe(refresh),
          binding.session.subscribe(() => {
            const next = binding.session.getSnapshot().running
            if (next !== running) { running = next; refresh() }
          }), onReset(refresh),
          remote.$on('goal/activation-changed', event => {
            if (event.sessionId === sessionId) { generation++; publish(event.goal) }
          })]
        refresh()
      }
      return () => {
        listeners.delete(listener)
        if (!listeners.size) { generation++; dispose.forEach(fn => fn()); dispose = [] }
      }
    },
  }
}

export function TimedGoalDock({ useProjection, useGoalActivation, t, ...actions }) {
  const projection = useProjection('goal')
  const goal = projection?.goal
  const activation = useGoalActivation(value => value.id === goal?.id && value.revision === goal?.revision ? value.activation : undefined)
  const [now, setNow] = React.useState(Date.now)
  React.useEffect(() => {
    if (!goal || goal.phase === 'complete') return undefined
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [goal?.id, goal?.phase])
  const timedTranslate = key => key.startsWith('phase.') && projection
    ? `${t(key)} · ${goalDuration(now - projection.createdAt)}` : t(key)
  return React.createElement(GoalBar, { ...actions, goal: goal ?? projection, activation, t: timedTranslate })
}

export function installGoalMetricsClient(ctx) {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = '.dsh-goal-completed{font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary);white-space:normal;font-variant-numeric:tabular-nums}'
    document.head.appendChild(style)
    return () => style.remove()
  })
  ctx.effect(() => ctx.locale.register('chat-enhancement-goal-metrics', goalMetricsLocales))
  ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions', id: 'chat-enhancement-goal-completed', order: 100,
    locale: 'chat-enhancement-goal-metrics',
  }, GoalCompletionBadge))
  const dialogs = new Map()
  const mutate = async (sessionId, verb, changes) => {
    const goal = ctx.sessions.binding(sessionId)?.session.projections.faceOf('goal').getSnapshot()?.goal
    if (!goal) return { ok: false, error: { code: 'no-current-goal', message: 'No current goal' } }
    try { return await ctx.remote.goals[verb](sessionId, { id: goal.id, revision: goal.revision }, ...(changes ? [changes] : [])) }
    catch (error) { return { ok: false, error: { code: 'goal-request-failed', message: String(error) } } }
  }
  const dialogFor = id => {
    if (!dialogs.has(id)) dialogs.set(id, new GoalEditDialogController(objective => mutate(id, 'edit', { objective })))
    return dialogs.get(id)
  }
  ctx.effect(() => () => { for (const dialog of dialogs.values()) dialog.dispose(); dialogs.clear() })
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'goal', priority: 100, order: 10, locale: 'goal',
    inject: sessionId => ({
      hooks: { goalActivation: goalActivationSource(ctx.sessions.binding(sessionId), ctx.remote, sessionId, listener => ctx.on('connection/reset', listener)) },
      onEdit: objective => dialogFor(sessionId).open(objective),
      onPause: () => mutate(sessionId, 'pause'), onResume: () => mutate(sessionId, 'resume'), onClear: () => mutate(sessionId, 'clear'),
    }),
  }, TimedGoalDock))
  ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
    name: 'conversation.input.overlay', id: 'goal-edit-dialog', priority: 100, order: 3, locale: 'goal',
    inject: sessionId => {
      const dialog = dialogFor(sessionId)
      return { hooks: { goalEditDialog: dialog.state }, edit: text => dialog.edit(text), submit: () => dialog.submitDraft(), dismiss: () => dialog.dismiss() }
    },
  }, GoalEditDialog))
}
