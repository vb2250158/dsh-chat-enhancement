import assert from 'node:assert/strict'
import test from 'node:test'
import { emptySessionTitle, isUnnamedTitle, SessionTitles } from '../src/session-titles.js'

function fixture({ human = false, title, refresh } = {}) {
  const session = { id: 'session-fixture', header: { id: 'session-fixture', cwd: 'C:/Projects/PangHu', createdAt: Date.UTC(2026, 9, 2, 10, 50) } }
  const events = human ? [{ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '修复登录' }] } }] : []
  let releases = 0
  let state = title ? { title, source: { kind: 'user' } } : undefined
  let writes = 0, resolves = 0
  const ctx = {
    sessions: { get: () => session },
    sessionController: {
      async resolveAgent() { resolves++; return { agent: { session } } },
      async list() { return { items: [{ sessionId: session.id, cwd: session.header.cwd, projections: { values: { title: state?.title } } }] } },
    },
    sessionTitle: {
      get: () => state,
      rename(_, next) { writes++; return state = { title: next, source: { kind: 'user' } } },
      async refresh() { writes++; if (refresh) await refresh(); return state = { title: '登录问题修复', source: { kind: 'provider' } } },
    },
    sessionQuery: {
      async observeSession() { return { events, [Symbol.dispose]() { releases++ } } },
      async listSessions() { return [{ header: session.header }] },
      async readTitleSnapshots(ids) { return ids.map(sessionId => ({ status: 'fulfilled', sessionId, value: { session: session.header, title: state } })) },
    },
  }
  return { ctx, session, get eventCount() { return events.length }, get releases() { return releases }, get writes() { return writes }, get resolves() { return resolves } }
}

test('空会话名称含工作区、创建时间和短身份，不发送用户消息', async () => {
  const f = fixture(), titles = new SessionTitles(f.ctx, { emptyTitleTimeZone: 'Asia/Hong_Kong' })
  const result = await titles.read({ action: 'rename', sessionId: f.session.id, onlyUnnamed: true })
  assert.equal(result.kind, 'empty')
  assert.equal(result.title, '空会话 PangHu 2026-10-02 18:50 ixture')
  assert.equal(f.eventCount, 0)
  assert.equal(f.releases, 1)
  assert.equal('events' in f.session, false)
  assert.equal(emptySessionTitle(f.session.header, 'Asia/Hong_Kong'), result.title)
})

test('批量命名在写前复核并保留已命名会话，显式菜单可重新生成', async () => {
  const f = fixture({ human: true, title: '人工命名' }), titles = new SessionTitles(f.ctx)
  assert.equal((await titles.read({ action: 'rename', sessionId: f.session.id, onlyUnnamed: true })).kind, 'retained')
  assert.equal(f.writes, 0)
  assert.equal((await titles.read({ action: 'rename', sessionId: f.session.id })).title, '登录问题修复')
  assert.equal(f.writes, 1)
})

test('同一会话并发重试复用写入，失败后可再次请求', async () => {
  let done
  const f = fixture({ human: true, refresh: () => new Promise(resolve => { done = resolve }) }), titles = new SessionTitles(f.ctx)
  const a = titles.read({ action: 'rename', sessionId: f.session.id })
  const b = titles.read({ action: 'rename', sessionId: f.session.id })
  await new Promise(resolve => setImmediate(resolve)); done()
  assert.deepEqual(await a, await b)
  assert.equal(f.writes, 1)
  f.ctx.sessionTitle.refresh = async () => { throw new Error('provider failed') }
  await assert.rejects(titles.read({ action: 'rename', sessionId: f.session.id }), /provider failed/)
  assert.equal(titles.pending.size, 0)
})

test('Host 读取全部身份和独立标题观察，旧占位名称仍可识别', async () => {
  const f = fixture(), titles = new SessionTitles(f.ctx)
  const result = await titles.read({ action: 'list' })
  assert.equal(result.items[0].sessionId, f.session.id)
  assert.equal(result.items[0].unnamed, true)
  assert.equal(isUnnamedTitle(' 未命名 '), true)
  assert.equal(isUnnamedTitle('真实标题'), false)
})

test('不存在的会话及命名回读不一致拒绝请求', async () => {
  const f = fixture(), titles = new SessionTitles(f.ctx)
  f.ctx.sessions.get = () => undefined
  f.ctx.sessionController.resolveAgent = async () => ({ error: new Error('not found') })
  await assert.rejects(titles.read({ action: 'rename', sessionId: 'missing' }), /not found/)
  f.ctx.sessions.get = () => f.session
  f.ctx.sessionTitle.rename = () => ({ title: 'uncommitted' })
  await assert.rejects(titles.read({ action: 'rename', sessionId: f.session.id }), /readback differs/)
})

test('模型失败时仅接受已经保存的非空回退标题，已有标题的失败仍拒绝', async () => {
  const f = fixture({ human: true }), titles = new SessionTitles(f.ctx)
  let state
  f.ctx.sessionTitle.get = () => state
  f.ctx.sessionTitle.refresh = async () => { state = { title: '修复登录', source: { kind: 'fallback' } }; throw new Error('model unavailable') }
  assert.equal((await titles.read({ action: 'rename', sessionId: f.session.id, onlyUnnamed: true })).kind, 'fallback')
  await assert.rejects(titles.read({ action: 'rename', sessionId: f.session.id }), /model unavailable/)
  assert.throws(() => new SessionTitles(f.ctx, { emptyTitleTimeZone: 'invalid-zone' }), /time zone/i)
})
