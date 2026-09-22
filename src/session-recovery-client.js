/** 底部恢复提示通过异步 Remote 查询共享批次，组件卸载时停止轮询。 */
import React from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'

export const recoveryLocales = {
  zh: { listing: '读取会话列表', scanning: '检查中断记录', validating: '核验会话状态', attaching: '挂载原会话', resuming: '启动原会话', waiting: '等待响应', seconds: '秒', question: '是否恢复意外中断会话', recover: '恢复中断会话', dismiss: '忽略本次恢复提示', busy: '正在恢复中断会话', failed: '恢复未完成，点击重试', checkFailed: '中断会话检查失败，点击重试' },
  en: { listing: 'Listing sessions', scanning: 'Checking interruptions', validating: 'Validating session', attaching: 'Loading original session', resuming: 'Resuming session', waiting: 'Waiting for response', seconds: 's', question: 'Restore interrupted sessions?', recover: 'Restore interrupted sessions', dismiss: 'Dismiss this recovery prompt', busy: 'Restoring interrupted sessions', failed: 'Recovery incomplete; retry', checkFailed: 'Session check failed; retry' },
}

export const recoveryCss = `.dsh-session-recovery{position:relative;display:flex;align-items:center;gap:2px;min-width:0;width:100%;color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap}.dsh-session-recovery-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}.dsh-session-recovery button{flex-shrink:0}.dsh-session-recovery-progress{position:absolute;inset:auto 0 0;height:2px;overflow:hidden;background:var(--dsw-alias-label-secondary);opacity:.7}.dsh-session-recovery-progress-fill{display:block;height:100%;background:var(--dsw-alias-label-primary);transition:width .25s ease}.dsh-session-recovery-progress[data-indeterminate] .dsh-session-recovery-progress-fill{width:30%;animation:dsh-recovery-progress 1.2s ease-in-out infinite}@keyframes dsh-recovery-progress{from{transform:translateX(-100%)}to{transform:translateX(340%)}}@media(prefers-reduced-motion:reduce){.dsh-session-recovery-progress-fill{transition:none}.dsh-session-recovery-progress[data-indeterminate] .dsh-session-recovery-progress-fill{animation:none;transform:translateX(110%)}}`

const recoveryRequestSchema = { parse(value) {
  if (!value || !['check', 'recover', 'dismiss'].includes(value.action) || (value.action !== 'check' && typeof value.batchId !== 'string')) throw new TypeError('Invalid recovery request')
  return value
} }
const recoveryResultSchema = { parse(value) {
  if (!value || typeof value.batchId !== 'string' || !['idle', 'checking', 'ready', 'recovering', 'done', 'failed', 'dismissed'].includes(value.phase) || !['count', 'scanErrors', 'restored', 'pollIntervalMs'].every(key => Number.isSafeInteger(value[key]) && value[key] >= 0) || value.pollIntervalMs === 0) throw new TypeError('Invalid recovery result')
  if (!['idle', 'listing', 'scanning', 'validating', 'attaching', 'resuming'].includes(value.stage) || !['completed', 'total', 'stageStartedAt', 'requestTimeoutMs'].every(key => Number.isSafeInteger(value[key]) && value[key] >= 0) || value.requestTimeoutMs === 0 || typeof value.currentSessionId !== 'string') throw new TypeError('Invalid recovery progress')
  return value
} }
export const recoveryDescriptor = {
  id: 'dsh-chat-enhancement#chatRecovery/read', service: 'chatRecovery', namespace: 'chatRecovery', method: 'read', invocation: { kind: 'direct' },
  parameters: [{ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatRecoveryRequest', schema: recoveryRequestSchema } }],
  result: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatRecoveryResult', schema: recoveryResultSchema },
}

/** 仅勾选触发恢复；检查失败和部分失败保留同一行重试入口。 */
export function SessionRecoveryPrompt({ wide, readRecovery, t, requestTimeoutMs = 30000 }) {
  const [state, setState] = React.useState(null)
  const [error, setError] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const operation = React.useRef(null)
  const [now, setNow] = React.useState(Date.now())
  React.useEffect(() => {
    if (!pending && !['checking', 'recovering'].includes(state?.phase)) return
    let timer
    const tick = () => { setNow(Date.now()); timer = setTimeout(tick, 1000) }
    timer = setTimeout(tick, 1000)
    return () => clearTimeout(timer)
  }, [pending, state?.phase])
  React.useEffect(() => {
    let active = true
    let timer
    let requestTimer
    let requestLimit = requestTimeoutMs
    let inflight = false
    let inflightAction
    let queued
    const request = async (action = 'check', batchId) => {
      if (inflight) {
        if (inflightAction === 'check' && action !== 'check' && !queued) { queued = { action, batchId }; if (active) setPending(true) }
        return
      }
      inflight = true
      inflightAction = action
      clearTimeout(timer)
      if (active && action !== 'check') setPending(true)
      try {
        const next = await Promise.race([
          readRecovery({ action, ...(batchId ? { batchId } : {}) }),
          new Promise((_, reject) => { requestTimer = setTimeout(() => reject(new Error('Recovery request timeout')), requestLimit) }),
        ])
        if (!active) return
        requestLimit = next.requestTimeoutMs ?? requestTimeoutMs
        setState(next)
        setError(false)
        if (!['done', 'dismissed'].includes(next.phase)) timer = setTimeout(() => request(), next.pollIntervalMs)
      } catch {
        // 连接或服务失败留在原行，由用户重试，避免后台无界重试。
        if (active) setError(true)
      } finally {
        clearTimeout(requestTimer)
        inflight = false
        if (active) {
          setPending(false)
          if (queued) { const next = queued; queued = undefined; void request(next.action, next.batchId) }
        }
      }
    }
    operation.current = request
    void request()
    return () => { active = false; clearTimeout(timer); clearTimeout(requestTimer); operation.current = null }
  }, [readRecovery, requestTimeoutMs])
  if (!wide || (!error && (!state || ['idle', 'done', 'dismissed'].includes(state.phase)))) return null
  const busy = !error && (pending || ['checking', 'recovering'].includes(state?.phase))
  const total = state?.total ?? ((state?.restored ?? 0) + (state?.count ?? 0))
  const completed = state?.completed ?? state?.restored ?? 0
  const progress = total > 0 ? Math.min(100, Math.round(completed / total * 100)) : undefined
  const indeterminate = pending || progress === undefined || progress === 0
  const elapsed = Math.max(0, Math.floor((now - (state?.stageStartedAt ?? now)) / 1000))
  const activity = pending ? t('waiting') : state?.stage && state.stage !== 'idle' ? t(state.stage) : t('busy')
  const detail = `${activity}${total ? ` ${completed}/${total}` : ''} · ${elapsed}${t('seconds')}`
  const label = error ? t('checkFailed') : state.phase === 'failed' ? `${t('failed')} (${state.scanErrors + state.count})` : busy ? detail : t('question')
  return React.createElement('div', { className: 'dsh-session-recovery', role: 'status', 'aria-busy': busy },
    React.createElement('span', { className: 'dsh-session-recovery-label', title: [label, state?.currentSessionId, state?.issues?.[0]?.message].filter(Boolean).join('\n') }, label),
    React.createElement(Button, { variant: 'ghost', size: 'sm', disabled: busy, 'aria-label': t('recover'), title: t('recover'), onClick: () => operation.current?.(error ? 'check' : 'recover', state?.batchId) }, '✓'),
    React.createElement(Button, { variant: 'ghost', size: 'sm', disabled: busy, 'aria-label': t('dismiss'), title: t('dismiss'), onClick: () => {
      if (state) void operation.current?.('dismiss', state.batchId)
      else { setError(false); setState({ phase: 'dismissed' }) }
    } }, '×'),
    busy && !error ? React.createElement('div', { className: 'dsh-session-recovery-progress', role: 'progressbar', 'aria-label': t('busy'), 'aria-valuetext': detail, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': indeterminate ? undefined : progress, 'data-indeterminate': indeterminate ? '' : undefined },
      React.createElement('span', { className: 'dsh-session-recovery-progress-fill', style: indeterminate ? undefined : { width: `${progress}%` } })) : null)
}
