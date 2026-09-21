/** 后台任务说明来自同会话已记录的工具调用，不修改任务注册信息。 */
export function backgroundJobDescriptions(nodes, jobs) {
  const descriptions = new Map()
  const byId = new Map(jobs.map(job => [job.id, job]))
  for (const node of nodes ?? []) {
    if (node.kind !== 'tool-result' || node.isError || !['bash', 'pwsh'].includes(node.call?.name)) continue
    const acknowledgement = node.content?.find(part => part.type === 'text' && /^started background job (?:bash|pwsh)-\d+$/u.test(part.text))
    if (!acknowledgement) continue
    const id = acknowledgement.text.slice('started background job '.length)
    const job = byId.get(id)
    // 宿主重启后任务编号可能复用；旧结果不能为新任务提供说明。
    if (!job || job.kind !== node.call.name || node.time < job.startedAt || node.callTime === null || node.callTime > job.startedAt) continue
    let args
    try { args = JSON.parse(node.call.argsRaw) } catch { continue } // 历史工具参数可能是未完成的 JSON。
    if (args?.run_in_background !== true || args.command !== job.label || typeof args.description !== 'string') continue
    const description = args.description.trim()
    if (description) descriptions.set(id, description)
  }
  return descriptions
}

export const backgroundJobLocales = {
  zh: { live: '{count} 个后台任务运行中', idle: '{count} 个后台任务', running: '运行中', stopping: '正在停止', completed: '已完成', killed: '已取消', failed: '已失败', seconds: '{seconds}秒', minutes: '{minutes}分{seconds}秒', hours: '{hours}小时{minutes}分' },
  en: { live: '{count} background jobs running', idle: '{count} background jobs', running: 'running', stopping: 'stopping', completed: 'completed', killed: 'cancelled', failed: 'failed', seconds: '{seconds}s', minutes: '{minutes}m {seconds}s', hours: '{hours}h {minutes}m' },
}

const backgroundJobLive = job => job.status === 'running' || job.status === 'stopping'

/** 运行任务按开始时间排列，已结束任务按结束时间倒序排列。 */
export function orderedBackgroundJobs(jobs) {
  return [...jobs].sort((a, b) => {
    if (backgroundJobLive(a) !== backgroundJobLive(b)) return backgroundJobLive(a) ? -1 : 1
    if (backgroundJobLive(a)) return a.startedAt - b.startedAt
    return (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt) || a.startedAt - b.startedAt
  })
}

/** 结束后冻结耗时，计时仅由列表的展示状态驱动。 */
export function backgroundJobDuration(job, now, t) {
  const seconds = Math.max(0, Math.floor(((backgroundJobLive(job) ? now : job.finishedAt ?? job.startedAt) - job.startedAt) / 1000))
  if (seconds >= 3600) return t('hours', { hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds / 60) % 60 })
  if (seconds >= 60) return t('minutes', { minutes: Math.floor(seconds / 60), seconds: seconds % 60 })
  return t('seconds', { seconds })
}

const noBackgroundJobs = []
const backgroundJobDots = { running: 'ongoing', stopping: 'warning', completed: 'done', killed: 'warning', failed: 'error' }

/** 公开 header action 的替换视图；普通任务保留命令、状态和耗时。 */
export function BackgroundJobList({ sessionId, useSessions, useTrajectory, chatSettings, t }) {
  const jobs = useSessions(state => state.jobsBySession[sessionId]) ?? noBackgroundJobs
  const nodes = typeof useTrajectory === 'function' ? useTrajectory(state => state.eventNodes) : undefined
  const preferences = settingsPreferences(useSettingsSnapshot(chatSettings))
  const [open, setOpen] = React.useState(false)
  const [now, setNow] = React.useState(Date.now)
  const liveCount = jobs.filter(backgroundJobLive).length
  const descriptions = React.useMemo(() => preferences.toolDescriptions === false ? new Map() : backgroundJobDescriptions(nodes, jobs), [nodes, jobs, preferences.toolDescriptions])
  React.useEffect(() => { setOpen(false) }, [sessionId, jobs.length === 0])
  React.useEffect(() => {
    if (!open || liveCount === 0) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [open, liveCount])
  if (jobs.length === 0) return null
  const count = t(liveCount > 0 ? 'live' : 'idle', { count: liveCount || jobs.length })
  const items = orderedBackgroundJobs(jobs).map(job => {
    const label = descriptions.get(job.id) ?? job.label
    const status = job.detail ?? t(job.status)
    const duration = backgroundJobDuration(job, now, t)
    return {
      id: job.id,
      icon: React.createElement(StateDot, { state: backgroundJobDots[job.status] }),
      label: React.createElement(Tooltip, { label: `${label}\n${job.label}\n${status}`, side: 'bottom' },
        React.createElement('span', { className: 'dsh-background-job', 'data-background-job': job.id },
          React.createElement('span', { className: 'dsh-background-job-kind' }, job.kind),
          React.createElement('span', { className: 'dsh-background-job-label' }, label),
          React.createElement('span', { className: 'dsh-background-job-status' }, status),
          React.createElement('span', { className: 'dsh-background-job-duration' }, duration))),
    }
  })
  return React.createElement(Menu, {
    open, items, onClose: () => setOpen(false), onSelect: () => {}, portal: true, autoFocus: true,
    className: 'dsh-background-jobs-menu',
    anchor: React.createElement(Button, {
      variant: 'ghost', size: 'sm', 'aria-label': count, 'aria-haspopup': 'menu', 'aria-expanded': open,
      onClick: () => { setNow(Date.now()); setOpen(value => !value) },
    }, liveCount > 0 ? React.createElement(StateDot, { state: 'ongoing' }) : null, count, React.createElement(IconChevronDownOutline14)),
  })
}

export const backgroundJobCss = `
.dsh-background-jobs-menu { max-width: calc(100vw - 24px); }
.dsh-background-job { display: flex; align-items: center; gap: 8px; width: min(480px, calc(100vw - 110px)); min-width: 0; }
.dsh-background-job-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-background-job-kind, .dsh-background-job-status, .dsh-background-job-duration { color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 18px; }
.dsh-background-job-status { max-width: 30%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-background-job-duration { flex: none; font-variant-numeric: tabular-nums; }
`
