import assert from 'node:assert/strict'
import test from 'node:test'
import { SessionRecovery, interruptedCandidate, recoveryConfig, resumeInterruptedGoal } from '../src/session-recovery.js'

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
      async resolveAgent(id) { agents.set(id, { id, status: 'idle', inbox: { nextTurn: [], nextStep: [] }, continueInterrupted(startSeq) { prompts.push({ sessionId: id, startSeq }); if (fail) throw new Error('rejected'); return true } }); return { agent: agents.get(id) } },
      async prompt(request) { prompts.push(request); if (fail) throw new Error('rejected'); return { accepted: true } },
    },
    subagents: { async continueInterrupted(parent, childSessionId, startSeq) { assert.ok(parent); prompts.push({ parentSessionId: parent.id, childSessionId, startSeq }); agents.set(childSessionId, { id: childSessionId, status: 'running', inbox: { nextTurn: [], nextStep: [] } }); return true } },
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
test('重启后挂载追加的 end-seed 不掩盖之前的中断轮次', () => {
  const value = observation('resumed')
  value.events.push({ type: 'session/end-seed', seq: 2, time: bootAt + 1000, data: {} })
  assert.equal(interruptedCandidate(value, bootAt, 3600000).id, 'resumed')
  value.events.push({ type: 'user/message', seq: 3, time: bootAt + 1001, data: {} })
  assert.equal(interruptedCandidate(value, bootAt, 3600000), undefined)
})
test('两次确认只提交一次；失败沿用轮次身份重试，成功项不再提交', async () => {
  const f = fixture(); f.recovery.read({ action: 'check' }); await f.recovery.work
  const request = { action: 'recover', batchId: f.recovery.batchId }
  f.fail(true); f.recovery.read(request); f.recovery.read(request); await f.recovery.work
  assert.equal(f.prompts.length, 1); assert.equal(f.recovery.phase, 'failed')
  f.fail(false); f.recovery.read(request); await f.recovery.work
  assert.equal(f.prompts.length, 2); assert.equal(f.prompts[0].startSeq, f.prompts[1].startSeq)
  assert.equal(f.recovery.phase, 'done')
  f.recovery.read(request); await f.recovery.work; assert.equal(f.prompts.length, 2)
})
test('检查后用户已恢复或正在运行时不重复续作', async () => {
  for (const change of ['turn', 'running']) {
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


test('现有活动目标直接恢复迭代，不投递消息，不越过暂停和轮数上限', () => {
  const agent = { followup() { throw new Error('must not prompt') } }
  let goal, calls = []
  const goals = { get: () => goal, resume: (owner, ref) => calls.push({ owner, ref }) }
  assert.equal(resumeInterruptedGoal(goals, agent), 'absent')
  goal = { id: 'goal-1', revision: 4, phase: 'active', activation: 'disarmed', roundsStarted: 1, maxGoalRounds: 5 }
  assert.equal(resumeInterruptedGoal(goals, agent), 'resumed')
  assert.deepEqual(calls, [{ owner: agent, ref: { id: 'goal-1', revision: 4 } }])
  goal.activation = 'armed'
  assert.equal(resumeInterruptedGoal(goals, agent), 'resumed')
  assert.equal(calls.length, 1)
  for (const phase of ['paused', 'blocked', 'complete']) {
    goal.phase = phase
    assert.equal(resumeInterruptedGoal(goals, agent), 'held')
  }
  goal.phase = 'active'; goal.roundsStarted = 5
  assert.equal(resumeInterruptedGoal(goals, agent), 'held')
  assert.equal(calls.length, 1)
})


test('宿主启动自动扫描并续跑，关闭配置时仍可手动检查', async () => {
  const f = fixture(); f.recovery.startAutomatic(); f.recovery.startAutomatic()
  await f.recovery.work
  assert.equal(f.recovery.phase, 'done'); assert.equal(f.prompts.length, 1)
  assert.equal(f.prompts[0].content, undefined)
  const disabled = fixture(); disabled.recovery.config.recoveryAutoResume = false
  disabled.recovery.startAutomatic(); await disabled.recovery.work
  assert.equal(disabled.reads(), 0)
  assert.equal(disabled.recovery.phase, 'idle')
})


test('冷恢复保留的子会话回报不会被误判成运行中，原队列继续处理', async () => {
  const f = fixture()
  const pending = [{ id: 'existing-child-result' }]
  f.agents.set('root', { status: 'idle', inbox: { nextTurn: [], nextStep: pending } })
  f.recovery.startAutomatic()
  await f.recovery.work
  assert.equal(f.recovery.snapshot().restored, 1)
  assert.equal(f.prompts.length, 1)
  assert.equal(f.prompts[0].content, undefined)
  assert.deepEqual(pending, [{ id: 'existing-child-result' }])
})

test('不响应的列表读取在期限内失败，批次可以重试', async () => {
  const f = fixture(); f.recovery.config.recoveryReadTimeoutMs = 15
  let release
  f.ctx.sessionQuery.listSessions = () => new Promise(resolve => { release = resolve })
  f.recovery.startAutomatic()
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(f.recovery.snapshot().stage, 'listing')
  await f.recovery.work
  assert.equal(f.recovery.phase, 'failed')
  assert.match(f.recovery.snapshot().issues[0].message, /timeout/)
  release([])
  await Promise.resolve()
  f.recovery.read({ action: 'recover', batchId: f.recovery.batchId })
  await new Promise(resolve => setTimeout(resolve, 5))
  release([])
  await f.recovery.work
  assert.equal(f.recovery.phase, 'done')
})

test('挂载卡住显示当前身份和进度，超时重试复用未完成调用', async () => {
  const f = fixture(); f.recovery.config.recoveryReadTimeoutMs = 20
  let release, calls = 0
  const original = f.ctx.sessionController.resolveAgent
  f.ctx.sessionController.resolveAgent = id => { calls++; return new Promise(resolve => { release = async () => resolve(await original(id)) }) }
  f.recovery.startAutomatic()
  await new Promise(resolve => setTimeout(resolve, 8))
  const snapshot = f.recovery.snapshot()
  assert.equal(snapshot.stage, 'attaching'); assert.equal(snapshot.currentSessionId, 'root')
  assert.equal(snapshot.total, 1); assert.equal(snapshot.completed, 0)
  // 中途状态不可绕过批次运行锁。
  f.recovery.phase = 'ready'
  f.recovery.read({ action: 'recover', batchId: f.recovery.batchId })
  assert.equal(calls, 1)
  await f.recovery.work
  assert.equal(f.recovery.phase, 'failed')
  f.recovery.read({ action: 'recover', batchId: f.recovery.batchId })
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(calls, 1)
  await release(); await f.recovery.work
  assert.equal(f.recovery.phase, 'done'); assert.equal(f.prompts.length, 1)
  assert.equal(f.recovery.snapshot().completed, 1)
})

test('超时读取的迟到观察句柄释放，卸载不等待失联提供方', async () => {
  const f = fixture(); f.recovery.config.recoveryReadTimeoutMs = 10
  let release, disposed = 0
  f.ctx.sessionQuery.observeSession = () => new Promise(resolve => { release = resolve })
  f.recovery.startAutomatic(); await f.recovery.work
  assert.equal(f.recovery.phase, 'failed')
  const value = observation('root'); value[Symbol.dispose] = () => { disposed++ }
  release(value); await Promise.resolve(); await Promise.resolve()
  assert.equal(disposed, 1)
  f.ctx.sessionQuery.listSessions = () => new Promise(() => {})
  f.recovery.read({ action: 'recover', batchId: f.recovery.batchId })
  await new Promise(resolve => setTimeout(resolve, 2))
  await f.recovery.dispose()
  assert.equal(f.recovery.active, false)
})

test('检查重试只读取失败项，成功记录不重复扫描', async () => {
  const f = fixture([observation('good'), observation('bad')])
  const original = f.ctx.sessionQuery.observeSession
  const readIds = []
  let broken = true
  f.ctx.sessionQuery.observeSession = id => { readIds.push(id); if (id === 'bad' && broken) throw new Error('bad record'); return original(id) }
  f.recovery.read({ action: 'check' }); await f.recovery.work
  assert.deepEqual(readIds, ['good', 'bad'])
  broken = false; readIds.length = 0
  await f.recovery.scan()
  assert.deepEqual(readIds, ['bad'])
  assert.equal(f.recovery.snapshot().total, 1)
  assert.equal(f.recovery.snapshot().count, 2)
})
