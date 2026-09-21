import assert from 'node:assert/strict'
import test from 'node:test'
import { SessionRecovery, interruptedCandidate, recoveryConfig } from '../src/session-recovery.js'

const bootAt = 10000000
function observation(id, { reason = 'interrupted', parentId, time = bootAt - 1000, inheritedEventCount = 0 } = {}) {
  const events = [{ type: 'turn/start', seq: 0, time: time - 100, data: { turn: 1 } }]
  if (parentId) events.push({ type: 'subagent/descriptor', seq: 1, time, data: { mode: 'continuable' } })
  if (reason) events.push({ type: 'turn/end', seq: events.length, time, data: { turn: 1, reason: { kind: reason } } })
  return { header: { id, ...(parentId ? { origin: 'subagent', parentSession: parentId } : {}) }, events, inheritedEventCount, [Symbol.dispose]() {} }
}
function fixture(items = [observation('root')]) {
  const values = new Map(items.map(value => [value.header.id, value]))
  const agents = new Map()
  const prompts = []
  let reads = 0
  let fail = false
  const ctx = {
    agents: { get: id => agents.get(id) },
    sessionQuery: {
      async listSessions() { return [...values.values()].map(value => ({ header: value.header })) },
      async observeSession(id) { reads++; if (!values.has(id)) throw new Error('missing'); return values.get(id) },
    },
    sessionController: {
      async resolveAgent(id) { agents.set(id, { status: 'idle', inbox: { nextTurn: [], nextStep: [] } }); return { agent: agents.get(id) } },
      async prompt(request) { prompts.push(request); if (fail) throw new Error('rejected'); return { accepted: true } },
    },
    subagents: { async prompt(request) { assert.ok(agents.has(request.parentSessionId)); prompts.push(request); agents.set(request.childSessionId, { status: 'running', inbox: { nextTurn: [], nextStep: [] } }); return { messageId: 'ok' } } },
  }
  const recovery = new SessionRecovery(ctx, {}, bootAt)
  return { recovery, ctx, values, agents, prompts, reads: () => reads, fail(value) { fail = value } }
}
test('候选只含重启前一小时的最后中断轮，排除手动取消、完成、继承和一次性子会话', () => {
  for (const reason of ['completed', 'aborted', 'blocked', 'error', 'max-tokens']) assert.equal(interruptedCandidate(observation('x', { reason }), bootAt, 3600000), undefined)
  for (const reason of ['interrupted', null]) assert.equal(interruptedCandidate(observation('x', { reason }), bootAt, 3600000).id, 'x')
  for (const time of [bootAt, bootAt + 1, bootAt - 3600001]) assert.equal(interruptedCandidate(observation('x', { time }), bootAt, 3600000), undefined)
  assert.equal(interruptedCandidate(observation('x', { inheritedEventCount: 2 }), bootAt, 3600000), undefined)
  const child = observation('c', { parentId: 'p' }); child.events[1].data.mode = 'one-shot'
  assert.equal(interruptedCandidate(child, bootAt, 3600000), undefined)
  assert.throws(() => recoveryConfig({ recoveryLookbackMs: 0 }))
})
test('首次查询立即返回且共享一次检查；叉号跨后续查询有效，无自动恢复', async () => {
  const f = fixture()
  assert.equal(f.recovery.read({ action: 'check' }).phase, 'checking')
  assert.equal(f.reads(), 0)
  f.recovery.read({ action: 'check' })
  await f.recovery.work
  assert.equal(f.reads(), 1)
  assert.equal(f.recovery.snapshot().count, 1)
  assert.equal(f.prompts.length, 0)
  assert.throws(() => f.recovery.read({ action: 'recover', batchId: 'stale' }))
  f.recovery.read({ action: 'dismiss', batchId: f.recovery.batchId })
  assert.equal(f.recovery.read({ action: 'check' }).phase, 'dismissed')
  await f.recovery.dispose()
})
test('两次确认只提交一次；失败沿用 requestId 重试，成功项不再提交', async () => {
  const f = fixture(); f.recovery.read({ action: 'check' }); await f.recovery.work
  const request = { action: 'recover', batchId: f.recovery.batchId }
  f.fail(true); f.recovery.read(request); f.recovery.read(request); await f.recovery.work
  assert.equal(f.prompts.length, 1); assert.equal(f.recovery.phase, 'failed')
  f.fail(false); f.recovery.read(request); await f.recovery.work
  assert.equal(f.prompts.length, 2); assert.equal(f.prompts[0].requestId, f.prompts[1].requestId)
  assert.equal(f.recovery.phase, 'done')
  f.recovery.read(request); await f.recovery.work; assert.equal(f.prompts.length, 2)
})
test('检查后用户已恢复或已有队列时不重复续作', async () => {
  for (const change of ['turn', 'running', 'queued']) {
    const f = fixture(); f.recovery.read({ action: 'check' }); await f.recovery.work
    if (change === 'turn') f.values.set('root', observation('root', { reason: 'completed' }))
    else f.agents.set('root', { status: change === 'running' ? 'running' : 'idle', inbox: { nextTurn: change === 'queued' ? [{}] : [], nextStep: [] } })
    f.recovery.read({ action: 'recover', batchId: f.recovery.batchId }); await f.recovery.work
    assert.equal(f.prompts.length, 0); assert.equal(f.recovery.phase, 'done')
  }
})
test('已完成主会话只挂载原 Agent，子会话通过原父地址恢复', async () => {
  const f = fixture([observation('root', { reason: 'completed' }), observation('child', { parentId: 'root' })])
  f.recovery.read({ action: 'check' }); await f.recovery.work
  f.recovery.read({ action: 'recover', batchId: f.recovery.batchId }); await f.recovery.work
  assert.equal(f.prompts.length, 1); assert.equal(f.prompts[0].childSessionId, 'child'); assert.equal(f.prompts[0].parentSessionId, 'root')
  assert.equal(f.recovery.phase, 'done')
})
test('读取失败可重试；卸载取消尚未开始的检查', async () => {
  const f = fixture(); const original = f.ctx.sessionQuery.observeSession
  f.ctx.sessionQuery.observeSession = async () => { throw new Error('broken log') }
  f.recovery.read({ action: 'check' }); await f.recovery.work
  assert.equal(f.recovery.phase, 'failed'); assert.equal(f.recovery.scanErrors, 1)
  f.ctx.sessionQuery.observeSession = original
  f.recovery.read({ action: 'recover', batchId: f.recovery.batchId }); await f.recovery.work
  assert.equal(f.recovery.phase, 'done'); assert.equal(f.prompts.length, 1)
  const stopped = fixture(); stopped.recovery.read({ action: 'check' }); await stopped.recovery.dispose()
  assert.equal(stopped.reads(), 0)
})
