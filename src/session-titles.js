/** 会话标题通过 Host 标题服务保存；不发送对话消息或启动轮次。 */
import { basename } from 'node:path'

/** 空会话以工作区、创建时间及短身份命名，保持名称可重复计算。 */
export function emptySessionTitle(header, timeZone = 'UTC') {
  const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(header.createdAt)
  const workspace = basename((header.cwd || '').replaceAll('\\', '/')) || 'DSH'
  return `空会话 ${Array.from(workspace).slice(0, 10).join('')} ${stamp} ${header.id.slice(-6)}`
}

/** 空白及客户端旧占位名称才属于批量命名范围。 */
export function isUnnamedTitle(title) {
  return !title?.trim() || ['未命名', 'Untitled', 'Unnamed'].includes(title.trim())
}

/** 并发调用同一会话复用一个写入，批量调用不覆盖已命名会话。 */
export class SessionTitles {
  constructor(ctx, config = {}) {
    this.ctx = ctx; this.pending = new Map(); this.timeZone = config.emptyTitleTimeZone ?? 'UTC'
    new Intl.DateTimeFormat('sv-SE', { timeZone: this.timeZone })
  }

  async list() {
    const { items } = await this.ctx.sessionController.list({})
    return { items: items.map(item => {
      const session = this.ctx.sessions.get(item.sessionId)
      const title = session ? this.ctx.sessionTitle.get(session)?.title ?? '' : item.projections?.values?.title ?? ''
      return { sessionId: item.sessionId, cwd: session?.header.cwd || item.cwd || '', createdAt: session?.header.createdAt, parentSession: session?.header.parentSession || item.parentSessionId || '', title, unnamed: isUnnamedTitle(title) }
    }) }
  }

  async read(request) {
    if (request.action === 'list') return this.list()
    const existing = this.pending.get(request.sessionId)
    if (existing) return existing
    const work = this.rename(request).finally(() => this.pending.delete(request.sessionId))
    this.pending.set(request.sessionId, work)
    return work
  }

  async rename(request) {
    let session = this.ctx.sessions.get(request.sessionId)
    if (!session) {
      const result = await this.ctx.sessionController.resolveAgent(request.sessionId)
      if (result.error) throw result.error
      session = result.agent.session
    }
    const before = this.ctx.sessionTitle.get(session)
    if (request.onlyUnnamed && !isUnnamedTitle(before?.title)) return { sessionId: session.id, title: before.title, kind: 'retained' }
    const input = this.ctx.sessionProjections.stateOf(session, 'titleInput')
    if (input === undefined) throw new Error('Session title input projection is unavailable')
    const human = input.count > 0
    let accepted
    if (!human) accepted = this.ctx.sessionTitle.rename(session, emptySessionTitle(session.header, this.timeZone))
    else {
      try { accepted = await this.ctx.sessionTitle.refresh(session) }
      catch (error) {
        const fallback = this.ctx.sessionTitle.get(session)
        if (!isUnnamedTitle(before?.title) || fallback?.source.kind !== 'fallback' || isUnnamedTitle(fallback.title)) throw error
        accepted = fallback
      }
    }
    if (!accepted?.title) throw new Error('Session title generation returned no title')
    const after = this.ctx.sessionTitle.get(session)
    if (after?.title !== accepted.title) throw new Error('Session title readback differs from accepted title')
    return { sessionId: session.id, title: after.title, kind: human ? after.source.kind : 'empty' }
  }
}

/** 挂载可撤销的正式 Remote 服务，卸载前等待已有写入。 */
export function installSessionTitles(ctx, protocol, config = {}) {
  const titles = new SessionTitles(ctx, config)
  const initializers = []
  class ChatTitlesService extends protocol.TypertRemoteService {
    constructor() { super(ctx, 'chatTitles'); for (const initializer of initializers) initializer.call(this) }
    async read(request) { return titles.read(request) }
  }
  protocol.Remote('read')(ChatTitlesService.prototype.read, { private: false, static: false, name: 'read', addInitializer(initializer) { initializers.push(initializer) } })
  new ChatTitlesService()
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'request/header' || ctx.sessionTitle.get(session)?.title !== emptySessionTitle(session.header, titles.timeZone)) return
    void titles.read({ action: 'rename', sessionId: session.id }).catch(error => ctx.logger.warn(`session "${session.id}": empty-session title refresh failed: ${String(error)}`))
  })
  ctx.effect(() => () => Promise.allSettled([...titles.pending.values()]), 'chat title operations')
}
