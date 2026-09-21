/** 重启恢复只读取公开会话观察；用户确认后向原会话提交续作请求。 */
import { randomUUID } from 'node:crypto'
import { setImmediate as yieldToHost } from 'node:timers/promises'

/** 解析可由 cordis.yml 调整的检查范围、轮询间隔和读取超时。 */
export function recoveryConfig(config = {}) {
  const values = { recoveryLookbackMs: 3600000, recoveryPollIntervalMs: 1500, recoveryReadTimeoutMs: 30000 }
  for (const key of Object.keys(values)) {
    if (config[key] !== undefined) values[key] = config[key]
    if (!Number.isSafeInteger(values[key]) || values[key] <= 0) throw new TypeError(`${key} must be a positive integer`)
  }
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
  const lastTime = tail.reduce((time, event) => Math.max(time, event.time), start.time)
  if (lastTime < bootAt - lookbackMs || lastTime >= bootAt) return undefined
  const mode = events.findLast(event => event.type === 'subagent/descriptor')?.data.mode
  if (observation.header.origin === 'subagent' && mode !== 'continuable') return undefined
  return { id: observation.header.id, startSeq: start.seq, parentId: observation.header.origin === 'subagent' ? observation.header.parentSession : undefined }
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
    this.restored = 0
    this.abort = new AbortController()
    this.work = Promise.resolve()
  }

  snapshot() {
    return { batchId: this.batchId, phase: this.phase, count: this.candidates.size, scanErrors: this.scanErrors, restored: this.restored, pollIntervalMs: this.config.recoveryPollIntervalMs }
  }

  read(request) {
    this.abort.signal.throwIfAborted()
    if (request.action === 'check') {
      if (this.phase === 'idle') this.launch('checking', () => this.scan())
    } else {
      if (request.batchId !== this.batchId) throw new Error('Recovery batch expired; check again.')
      if (request.action === 'dismiss' && !['checking', 'recovering'].includes(this.phase)) this.phase = 'dismissed'
      else if (request.action === 'recover' && ['ready', 'failed'].includes(this.phase)) {
        this.launch('recovering', async () => {
          if (this.scanErrors) await this.scan()
          await this.recover()
        })
      }
    }
    return this.snapshot()
  }

  launch(phase, operation) {
    this.phase = phase
    this.work = yieldToHost(undefined, { signal: this.abort.signal }).then(operation).catch(() => {
      if (!this.abort.signal.aborted) { this.phase = 'failed'; this.scanErrors += 1 }
    })
  }

  async observe(id, use) {
    const signal = AbortSignal.any([this.abort.signal, AbortSignal.timeout(this.config.recoveryReadTimeoutMs)])
    const observation = await this.ctx.sessionQuery.observeSession(id, { projectionMode: 'none', signal })
    try { signal.throwIfAborted(); return use(observation) } finally { observation[Symbol.dispose]() }
  }

  busy(id) {
    const agent = this.ctx.agents.get(id)
    return agent?.status === 'running' || (agent?.inbox.nextTurn.length ?? 0) > 0 || (agent?.inbox.nextStep.length ?? 0) > 0
  }

  async scan() {
    this.scanErrors = 0
    const records = await this.ctx.sessionQuery.listSessions(this.abort.signal)
    this.headers = new Map(records.map(record => [record.header.id, record.header]))
    for (const { header } of records) {
      this.abort.signal.throwIfAborted()
      if (this.busy(header.id)) continue
      try {
        const candidate = await this.observe(header.id, value => interruptedCandidate(value, this.bootAt, this.config.recoveryLookbackMs))
        if (candidate && !this.candidates.has(candidate.id)) this.candidates.set(candidate.id, { ...candidate, requestId: randomUUID() })
      } catch {
        // 单个会话损坏或读取超时保留失败计数，允许用户重试本批检查。
        this.abort.signal.throwIfAborted()
        this.scanErrors += 1
      }
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
      const result = await this.ctx.sessionController.resolveAgent(id)
      if (result.error) throw new Error('Recovery parent could not be resumed')
    }
  }

  async resume(candidate) {
    this.abort.signal.throwIfAborted()
    const current = await this.observe(candidate.id, value => interruptedCandidate(value, this.bootAt, this.config.recoveryLookbackMs))
    if (this.busy(candidate.id) || !current || current.startSeq !== candidate.startSeq) {
      this.candidates.delete(candidate.id)
      return
    }
    const content = [{ type: 'text', text: 'DSH 重启中断了本会话。用户已确认恢复，请从已有进度继续原任务，保持原会话和任务身份。先核对已执行操作的实际结果，避免重复写入。原子会话由同一恢复批次分别处理，请先检查原子会话状态，不要重复创建。' }]
    const signal = this.abort.signal
    if (candidate.parentId) {
      await this.ctx.subagents.prompt({ requestId: candidate.requestId, parentSessionId: candidate.parentId, childSessionId: candidate.id, mode: 'continuable', delivery: 'queue', content }, signal)
    } else {
      await this.ctx.sessionController.prompt({ requestId: candidate.requestId, sessionId: candidate.id, mode: 'queue', content }, signal)
    }
    this.candidates.delete(candidate.id)
    this.restored += 1
  }

  async recover() {
    // 子会话先获得原父 Agent；最后续作主会话，减少主会话重新派工的机会。
    const candidates = [...this.candidates.values()].sort((a, b) => Number(Boolean(b.parentId)) - Number(Boolean(a.parentId)))
    for (const candidate of candidates) {
      if (!this.candidates.has(candidate.id)) continue
      try {
        if (candidate.parentId) await this.ensureParent(candidate.parentId)
        await this.resume(candidate)
      } catch {
        // 单个恢复失败仍保留同一 requestId，重试前会再次检查最新轮次和队列。
        this.abort.signal.throwIfAborted()
      }
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
  ctx.effect(() => () => recovery.dispose(), 'chat recovery work')
  new ChatRecoveryService()
}
