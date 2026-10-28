import assert from 'node:assert/strict'
import test from 'node:test'
import { SessionTitles, emptySessionTitle } from '../src/session-titles.js'

function deferred() {
  let resolve
  const promise = new Promise(accept => { resolve = accept })
  return { promise, resolve }
}
const tick = () => new Promise(resolve => setImmediate(resolve))
function fixture() {
  const idle = deferred()
  const session = { id: 'background-title', header: { id: 'background-title', cwd: 'C:/fixture', createdAt: 0 } }
  let state = { title: emptySessionTitle(session.header), eventSeq: 1, source: { kind: 'user' } }
  let calls = 0
  const warnings = []
  const ctx = {
    agents: { get: () => ({ whenIdle: () => idle.promise }) },
    sessions: { get: () => session },
    sessionProjections: { stateOf: () => ({ count: 1 }) },
    logger: { warn: text => warnings.push(text) },
    sessionTitle: {
      get: () => state,
      async refresh(_, signal) {
        signal?.throwIfAborted()
        calls++
        return state = { title: 'Background title', eventSeq: state.eventSeq + 1, source: { kind: 'provider' } }
      },
    },
  }
  return { ctx, session, idle, warnings, titles: new SessionTitles(ctx),
    get calls() { return calls }, get state() { return state },
    rename(title) { state = { title, eventSeq: state.eventSeq + 1, source: { kind: 'user' } } } }
}

test('空会话自动改名等待前台结束，重复 header 只执行一次', async () => {
  const f = fixture()
  const a = f.titles.queueAutomatic(f.session)
  const b = f.titles.queueAutomatic(f.session)
  assert.equal(a, b)
  await tick()
  assert.equal(f.calls, 0)
  assert.equal(f.titles.pending.size, 0)
  f.idle.resolve()
  await a
  assert.equal(f.calls, 1)
  assert.equal(f.state.title, 'Background title')
  assert.equal(f.titles.automatic.size, 0)
  await f.titles.close()
})

test('手动重新生成无需等待排队的自动工作，自动工作不重复覆盖', async () => {
  const f = fixture()
  const automatic = f.titles.queueAutomatic(f.session)
  const manual = await f.titles.read({ action: 'rename', sessionId: f.session.id })
  assert.equal(manual.title, 'Background title')
  assert.equal(f.calls, 1)
  f.idle.resolve()
  await automatic
  assert.equal(f.calls, 1)
  await f.titles.close()
})

test('等待期间用户改名，即使文字相同也不覆盖新版本', async () => {
  const f = fixture()
  const automatic = f.titles.queueAutomatic(f.session)
  f.rename(f.state.title)
  f.idle.resolve()
  await automatic
  assert.equal(f.calls, 0)
  await f.titles.close()
})

test('卸载取消排队，不等待尚未结束的前台，不发送标题请求', async () => {
  const f = fixture()
  const automatic = f.titles.queueAutomatic(f.session)
  await f.titles.close()
  await automatic
  assert.equal(f.calls, 0)
  assert.equal(f.titles.automatic.size, 0)
  assert.deepEqual(f.warnings, [])
})

test('会话销毁取消排队且不保留旧会话操作', async () => {
  const f = fixture()
  const automatic = f.titles.queueAutomatic(f.session)
  f.titles.cancelAutomatic(f.session.id)
  await automatic
  assert.equal(f.calls, 0)
  assert.equal(f.titles.automatic.size, 0)
  await f.titles.close()
})

test('同身份的新会话不能接收旧对象的排队结果', async () => {
  const f = fixture()
  const automatic = f.titles.queueAutomatic(f.session)
  f.ctx.sessions.get = () => ({ ...f.session })
  f.idle.resolve()
  await automatic
  assert.equal(f.calls, 0)
  await f.titles.close()
})

test('标题失败只保留原名并清理队列，前台不接收失败', async () => {
  const f = fixture()
  f.ctx.sessionTitle.refresh = async () => { throw new Error('fixture provider unavailable') }
  const automatic = f.titles.queueAutomatic(f.session)
  f.idle.resolve()
  await automatic
  assert.equal(f.state.source.kind, 'user')
  assert.equal(f.titles.automatic.size, 0)
  assert.equal(f.warnings.length, 1)
  await f.titles.close()
})
