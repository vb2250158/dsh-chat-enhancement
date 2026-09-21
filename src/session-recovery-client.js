/** 底部恢复提示通过异步 Remote 查询共享批次，组件卸载时停止轮询。 */
import React from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'

export const recoveryLocales = {
  zh: { question: '是否恢复意外中断会话', recover: '恢复中断会话', dismiss: '忽略本次恢复提示', busy: '正在恢复中断会话', failed: '恢复未完成，点击重试', checkFailed: '中断会话检查失败，点击重试' },
  en: { question: 'Restore interrupted sessions?', recover: 'Restore interrupted sessions', dismiss: 'Dismiss this recovery prompt', busy: 'Restoring interrupted sessions', failed: 'Recovery incomplete; retry', checkFailed: 'Session check failed; retry' },
}

export const recoveryCss = `.dsh-session-recovery{display:flex;align-items:center;gap:2px;min-width:0;width:100%;color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap}.dsh-session-recovery-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}.dsh-session-recovery button{flex-shrink:0}`

const recoveryRequestSchema = { parse(value) {
  if (!value || !['check', 'recover', 'dismiss'].includes(value.action) || (value.action !== 'check' && typeof value.batchId !== 'string')) throw new TypeError('Invalid recovery request')
  return value
} }
const recoveryResultSchema = { parse(value) {
  if (!value || typeof value.batchId !== 'string' || !['idle', 'checking', 'ready', 'recovering', 'done', 'failed', 'dismissed'].includes(value.phase) || !['count', 'scanErrors', 'restored', 'pollIntervalMs'].every(key => Number.isSafeInteger(value[key]) && value[key] >= 0) || value.pollIntervalMs === 0) throw new TypeError('Invalid recovery result')
  return value
} }
export const recoveryDescriptor = {
  id: 'dsh-chat-enhancement#chatRecovery/read', service: 'chatRecovery', namespace: 'chatRecovery', method: 'read', invocation: { kind: 'direct' },
  parameters: [{ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatRecoveryRequest', schema: recoveryRequestSchema } }],
  result: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatRecoveryResult', schema: recoveryResultSchema },
}

/** 仅勾选触发恢复；检查失败和部分失败保留同一行重试入口。 */
export function SessionRecoveryPrompt({ wide, readRecovery, t }) {
  const [state, setState] = React.useState(null)
  const [error, setError] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const operation = React.useRef(null)
  React.useEffect(() => {
    let active = true
    let timer
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
        const next = await readRecovery({ action, ...(batchId ? { batchId } : {}) })
        if (!active) return
        setState(next)
        setError(false)
        if (!['done', 'dismissed'].includes(next.phase)) timer = setTimeout(() => request(), next.pollIntervalMs)
      } catch {
        // 连接或服务失败留在原行，由用户重试，避免后台无界重试。
        if (active) setError(true)
      } finally {
        inflight = false
        if (active) {
          setPending(false)
          if (queued) { const next = queued; queued = undefined; void request(next.action, next.batchId) }
        }
      }
    }
    operation.current = request
    void request()
    return () => { active = false; clearTimeout(timer); operation.current = null }
  }, [readRecovery])
  if (!wide || (!error && (!state || ['idle', 'checking', 'done', 'dismissed'].includes(state.phase)))) return null
  const busy = pending || state?.phase === 'recovering'
  const label = error ? t('checkFailed') : state.phase === 'failed' ? t('failed') : state.phase === 'recovering' ? t('busy') : t('question')
  return React.createElement('div', { className: 'dsh-session-recovery', role: 'status', 'aria-busy': busy },
    React.createElement('span', { className: 'dsh-session-recovery-label', title: label }, label),
    React.createElement(Button, { variant: 'ghost', size: 'sm', disabled: busy, 'aria-label': t('recover'), title: t('recover'), onClick: () => operation.current?.(error ? 'check' : 'recover', state?.batchId) }, '✓'),
    React.createElement(Button, { variant: 'ghost', size: 'sm', disabled: busy, 'aria-label': t('dismiss'), title: t('dismiss'), onClick: () => {
      if (state) void operation.current?.('dismiss', state.batchId)
      else { setError(false); setState({ phase: 'dismissed' }) }
    } }, '×'))
}
