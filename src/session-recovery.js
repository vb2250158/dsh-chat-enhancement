/** 重启恢复只读取公开会话观察；自动恢复原会话的迭代，不投递恢复提示。 */
import { randomUUID } from 'node:crypto'
import { setImmediate as yieldToHost } from 'node:timers/promises'

/** 解析可由 cordis.yml 调整的检查范围、轮询间隔和读取超时。 */
export function recoveryConfig(config = {}) {
  const values = { recoveryLookbackMs: 3600000, recoveryPollIntervalMs: 1500, recoveryReadTimeoutMs: 30000 }
  for (const key of Object.keys(values)) {
    if (config[key] !== undefined) values[key] = config[key]
    if (!Number.isSafeInteger(values[key]) || values[key] <= 0) throw new TypeError(`${key} must be a positive integer`)
  }
  values.recoveryAutoResume = config.recoveryAutoResume ?? true
  if (typeof values.recoveryAutoResume !== 'boolean') throw new TypeError('recoveryAutoResume must be boolean')
  return values
}

/** 只识别本会话最后一轮的崩溃记录；继承历史和主动取消不属于候选。 */
export function interruptedCandidate(observation, bootAt, lookbackMs) {
  const events = observation.events.filter(event => event.seq >= observation.inheritedEventCount)
  const start = events.findLast(event => event.type === 'turn/start')
  if (!start) return undefined
  const tail = events.filter(event => event.seq > start.seq)
  const end = tail.findLast(event => event.type === 'turn/end')
  if (end && end.data.reason.kind !== 'interrupted') return undefined
  if (tail.some(event => event.type === 'user/message' && end && event.seq > end.seq)) return undefined
  // 冷会话挂载会追加 session/end-seed；它不改变被中断轮次的发生时间。
  const lastTime = end?.time ?? tail.filter(event => !event.type.startsWith('session/')).reduce((time, event) => Math.max(time, event.time), start.time)
  if (lastTime < bootAt - lookbackMs || lastTime >= bootAt) return undefined
  const mode = events.findLast(event => event.type === 'subagent/descriptor')?.data.mode
  if (observation.header.origin === 'subagent' && mode !== 'continuable') return undefined
  return { id: observation.header.id, startSeq: start.seq, parentId: observation.header.origin === 'subagent' ? observation.header.parentSession : undefined }
}

/** 只重新启动重启前仍活动的现有目标，保留暂停、完成和轮数限制。 */
export function resumeInterruptedGoal(goals, agent) {
  const goal = goals?.get(agent)
  if (!goal) return 'absent'
  if (goal.phase !== 'active' || goal.roundsStarted >= goal.maxGoalRounds) return 'held'
  if (goal.activation !== 'armed') goals.resume(agent, { id: goal.id, revision: goal.revision })
  return 'resumed'
}

/** 每个 Host 插件实例共享一次检查及确认状态，避免多标签页重复提交。 */
export class SessionRecovery {
  constructor(ctx, config, bootAt = Date.now() - process.uptime() * 1000) {
    this.ctx = ctx
    this.config = recoveryConfig(config)
    this.bootAt = bootAt
    this.batchId = randomUUID()
    this.phase = 'idle'
    this.candidates = new Map()
    this.headers = new Map()
    this.scanErrors = 0
    this.issues = new Map()
    this.restored = 0
    this.abort = new AbortController()
    this.work = Promise.resolve()
    this.active = false
    this.stage = 'idle'
    this.completed = 0
    this.total = 0
    this.stageStartedAt = Date.now()
    this.currentSessionId = ''
    this.pendingCalls = new Map()
  }

  startAutomatic() {
    if (!this.config.recoveryAutoResume || this.phase !== 'idle') return
    this.launch('checking', async () => {
      await this.scan()
      if (this.candidates.size) {
        this.phase = 'recovering'
        await this.recover()
      }
    })
  }

  snapshot() {
    return { batchId: this.batchId, phase: this.phase, count: this.candidates.size, scanErrors: this.scanErrors, restored: this.restored, pollIntervalMs: this.config.recoveryPollIntervalMs, stage: this.stage, completed: this.completed, total: this.total, stageStartedAt: this.stageStartedAt, currentSessionId: this.currentSessionId, requestTimeoutMs: this.config.recoveryReadTimeoutMs, issues: [...this.issues.values()] }
  }

  read(request) {
    this.abort.signal.throwIfAborted()
    if (request.action === 'check') {
      if (this.phase === 'idle') this.launch('checking', () => this.scan())
    } else {
      if (request.batchId !== this.batchId) throw new Error('Recovery batch expired; check again.')
      if (request.action === 'dismiss' && !this.active) this.phase = 'dismissed'
      else if (request.action === 'recover' && !this.active && ['ready', 'failed'].includes(this.phase)) {
        this.launch('recovering', async () => {
          if (this.scanErrors) await this.scan()
          await this.recover()
        })
      }
    }
    return this.snapshot()
  }

  launch(phase, operation) {
    if (this.active) return
    this.active = true
    this.phase = phase
    this.work = yieldToHost(undefined, { signal: this.abort.signal }).then(operation).catch(error => {
      if (!this.abort.signal.aborted) {
        this.phase = 'failed'
        this.scanErrors += 1
        this.issues.set('', { sessionId: this.currentSessionId, stage: phase === 'checking' ? 'check' : 'recover', message: String(error.message ?? error).split('\n')[0].slice(0, 300) })
      }
    }).finally(() => { this.active = false })
  }

  setStage(stage, id = '') {
    this.stage = stage
    this.currentSessionId = id
    this.stageStartedAt = Date.now()
  }

  /** 超时只结束本次等待；未完成的挂载/续作复用同一调用，防止重试重复提交。 */
  async waitFor(key, operation, lateDispose) {
    this.abort.signal.throwIfAborted()
    let pending = this.pendingCalls.get(key)
    if (!pending) {
      pending = Promise.resolve().then(operation)
      this.pendingCalls.set(key, pending)
      const release = () => { if (this.pendingCalls.get(key) === pending) this.pendingCalls.delete(key) }
      pending.then(release, release)
    }
    let timer, onAbort, expired = false
    const deadline = new Promise((_, reject) => {
      onAbort = () => reject(this.abort.signal.reason)
      this.abort.signal.addEventListener('abort', onAbort, { once: true })
      timer = setTimeout(() => { expired = true; reject(new Error(`Recovery timeout: ${this.stage} (${this.currentSessionId})`)) }, this.config.recoveryReadTimeoutMs)
    })
    try { return await Promise.race([pending, deadline]) }
    finally {
      clearTimeout(timer)
      this.abort.signal.removeEventListener('abort', onAbort)
      if ((expired || this.abort.signal.aborted) && lateDispose) {
        // 只读观察的迟到句柄由原等待者释放，不交给下一次读取。
        this.pendingCalls.delete(key)
        pending.then(lateDispose, () => {})
      }
    }
  }

  async observe(id, use) {
    const signal = AbortSignal.any([this.abort.signal, AbortSignal.timeout(this.config.recoveryReadTimeoutMs)])
    const observation = await this.waitFor(`observe:${id}`, () => this.ctx.sessionQuery.observeSession(id, { projectionMode: 'none', signal }), value => value[Symbol.dispose]())
    try { signal.throwIfAborted(); return use(observation) } finally { observation[Symbol.dispose]() }
  }

  busy(id) {
    const agent = this.ctx.agents.get(id)
    return agent?.status === 'running'
  }

  async scan() {
    const retryIds = new Set([...this.issues.values()].filter(issue => issue.stage === 'check').map(issue => issue.sessionId))
    const retryOnly = retryIds.size > 0 && !this.issues.has('')
    this.scanErrors = 0
    this.issues.clear()
    this.completed = 0
    this.total = 0
    this.setStage('listing')
    const records = await this.waitFor('list', () => this.ctx.sessionQuery.listSessions(this.abort.signal))
    const selected = retryOnly ? records.filter(record => retryIds.has(record.header.id)) : records
    this.total = selected.length
    this.headers = new Map(records.map(record => [record.header.id, record.header]))
    for (const { header } of selected) {
      this.abort.signal.throwIfAborted()
      this.setStage('scanning', header.id)
      if (this.busy(header.id)) { this.completed += 1; continue }
      try {
        const candidate = await this.observe(header.id, value => interruptedCandidate(value, this.bootAt, this.config.recoveryLookbackMs))
        if (candidate && !this.candidates.has(candidate.id)) this.candidates.set(candidate.id, candidate)
      } catch (error) {
        // 单个会话损坏或读取超时保留失败计数，允许用户重试本批检查。
        this.abort.signal.throwIfAborted()
        this.scanErrors += 1
        this.issues.set(header.id, { sessionId: header.id, stage: 'check', message: String(error.message ?? error).split('\n')[0].slice(0, 300) })
      }
      this.completed += 1
      await yieldToHost(undefined, { signal: this.abort.signal })
    }
    if (this.phase !== 'recovering') this.phase = this.scanErrors ? 'failed' : this.candidates.size ? 'ready' : 'done'
  }

  async ensureParent(id, path = new Set()) {
    if (this.ctx.agents.get(id)) return
    if (path.has(id)) throw new Error('Cyclic subagent ownership')
    path.add(id)
    const header = this.headers.get(id)
    if (!header) throw new Error('Recovery parent unavailable')
    if (header.origin === 'subagent') {
      const candidate = this.candidates.get(id)
      if (!candidate) throw new Error('Recovery requires an inactive subagent parent')
      await this.ensureParent(header.parentSession, path)
      await this.resume(candidate)
    } else {
      this.setStage('attaching', id)
      const result = await this.waitFor(`attach:${id}`, () => this.ctx.sessionController.resolveAgent(id))
      if (result.error) throw new Error('Recovery parent could not be resumed')
    }
  }

  async resume(candidate) {
    this.abort.signal.throwIfAborted()
    this.setStage('validating', candidate.id)
    const current = await this.observe(candidate.id, value => interruptedCandidate(value, this.bootAt, this.config.recoveryLookbackMs))
    if (this.busy(candidate.id) || !current || current.startSeq !== candidate.startSeq) {
      this.candidates.delete(candidate.id)
      return
    }
    const signal = this.abort.signal
    let started = false
    if (candidate.parentId) {
      const parent = this.ctx.agents.get(candidate.parentId)
      if (!this.ctx.subagents.continueInterrupted) throw new Error('Host upgrade required: prompt-free subagent continuation unavailable')
      this.setStage('resuming', candidate.id)
      started = await this.waitFor(`resume:${candidate.id}:${candidate.startSeq}`, () => this.ctx.subagents.continueInterrupted(parent, candidate.id, candidate.startSeq, signal))
    } else {
      this.setStage('attaching', candidate.id)
      const result = await this.waitFor(`attach:${candidate.id}`, () => this.ctx.sessionController.resolveAgent(candidate.id))
      if (result.error || !result.agent) throw new Error('Original session could not be resumed')
      signal.throwIfAborted()
      if (this.busy(candidate.id)) { this.candidates.delete(candidate.id); return }
      this.setStage('resuming', candidate.id)
      const goalResult = resumeInterruptedGoal(this.ctx.goals, result.agent)
      if (goalResult === 'resumed') started = true
      else if (goalResult === 'absent') {
        if (!result.agent.continueInterrupted) throw new Error('Host upgrade required: prompt-free continuation unavailable')
        started = result.agent.continueInterrupted(candidate.startSeq)
      }
    }
    this.candidates.delete(candidate.id)
    if (started) this.restored += 1
  }

  async recover() {
    // 子会话先获得原父 Agent；最后续作主会话，减少主会话重新派工的机会。
    const candidates = [...this.candidates.values()].sort((a, b) => Number(Boolean(b.parentId)) - Number(Boolean(a.parentId)))
    this.total = candidates.length
    this.completed = 0
    for (const candidate of candidates) {
      if (!this.candidates.has(candidate.id)) { this.completed += 1; continue }
      try {
        if (candidate.parentId) await this.ensureParent(candidate.parentId)
        await this.resume(candidate)
        this.issues.delete(candidate.id)
      } catch (error) {
        // 单个恢复失败保留原轮次身份，重试前会再次检查最新轮次和队列。
        this.abort.signal.throwIfAborted()
        this.issues.set(candidate.id, { sessionId: candidate.id, stage: 'recover', message: String(error.message ?? error).split('\n')[0].slice(0, 300) })
      }
      this.completed += 1
      await yieldToHost(undefined, { signal: this.abort.signal })
    }
    this.phase = this.candidates.size || this.scanErrors ? 'failed' : 'done'
  }

  async dispose() { this.abort.abort(); await this.work }
}

/** 通过公开 Typert 服务挂载恢复入口，卸载时取消并等待本插件工作。 */
export function installSessionRecovery(ctx, protocol, config) {
  const recovery = new SessionRecovery(ctx, config)
  const initializers = []
  class ChatRecoveryService extends protocol.TypertRemoteService {
    constructor() { super(ctx, 'chatRecovery'); for (const initializer of initializers) initializer.call(this) }
    async read(request) { return recovery.read(request) }
  }
  protocol.Remote('read')(ChatRecoveryService.prototype.read, { private: false, static: false, name: 'read', addInitializer(initializer) { initializers.push(initializer) } })
  new ChatRecoveryService()
  ctx.effect(() => {
    recovery.startAutomatic()
    return () => recovery.dispose()
  }, 'chat recovery work')
}
