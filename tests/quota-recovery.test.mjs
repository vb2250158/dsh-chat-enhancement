import assert from 'node:assert/strict'
import test from 'node:test'
import { SessionRecovery } from '../src/session-recovery.js'
import { runRecovery } from '../scripts/recover-sessions.mjs'

function fixture({ accepted = true, origin = 'user', goal, turn = 7 } = {}) {
  const calls = []
  const agent = { status: 'idle', continueQuotaFailure(seq) { calls.push(seq); if (accepted) this.status = 'running'; return accepted } }
  const ctx = {
    agents: { get: () => agent },
    goals: { get: () => goal },
    sessionQuery: { async observeSession() { return { header: { origin }, inheritedEventCount: 0, events: [{ type: 'turn/start', seq: turn }], [Symbol.dispose]() {} } } },
    sessionController: { async resolveAgent() { return { agent } } },
  }
  const recovery = new SessionRecovery(ctx, {})
  recovery.phase = 'done'
  const request = { action: 'recover-quota', batchId: recovery.batchId, targets: [{ id: 'original', startSeq: 7 }] }
  return { recovery, calls, agent, request }
}

test('显式额度批次续作原轮次；重复提交和已运行项不重复启动', async () => {
  const f = fixture()
  assert.equal(f.recovery.read(f.request).phase, 'recovering')
  assert.throws(() => f.recovery.read(f.request), /current recovery batch/)
  await f.recovery.work
  assert.deepEqual(f.calls, [7])
  assert.equal(f.recovery.snapshot().restored, 1)
  f.recovery.read(f.request); await f.recovery.work
  assert.deepEqual(f.calls, [7])
  await f.recovery.dispose()
})

test('拒绝原生续作后保留逐会话错误及重试入口', async () => {
  const f = fixture({ accepted: false })
  f.recovery.read(f.request); await f.recovery.work
  assert.equal(f.recovery.phase, 'failed')
  assert.equal(f.recovery.snapshot().issues[0].sessionId, 'original')
  assert.equal(f.recovery.snapshot().restored, 0)
  f.agent.continueQuotaFailure = () => true
  f.recovery.read({ action: 'recover', batchId: f.recovery.batchId }); await f.recovery.work
  assert.equal(f.recovery.phase, 'done')
  await f.recovery.dispose()
})

test('旧轮次、子会话和目标会话不走普通额度续作', async () => {
  for (const options of [{ turn: 8 }, { origin: 'subagent' }, { goal: { phase: 'paused' } }]) {
    const f = fixture(options)
    f.recovery.read(f.request); await f.recovery.work
    assert.deepEqual(f.calls, [])
    await f.recovery.dispose()
  }
})

test('不覆盖未处理的重启恢复批次并校验目标身份', async () => {
  const f = fixture()
  for (const targets of [undefined, [], [{ id: '', startSeq: 1 }], [{ id: 'x', startSeq: -1 }], [{ id: 'x', startSeq: 1 }, { id: 'x', startSeq: 2 }]]) assert.throws(() => f.recovery.read({ ...f.request, targets }))
  f.recovery.candidates.set('restart', { id: 'restart', startSeq: 2 })
  assert.throws(() => f.recovery.read(f.request), /current recovery batch/)
  assert.equal(f.recovery.candidates.has('restart'), true)
  await f.recovery.dispose()
})

test('CLI 等待同一批次并传递明确额度目标，不创建用户消息', async () => {
  const f = fixture()
  const state = await runRecovery(request => f.recovery.read(request), { action: 'recover-quota', targets: f.request.targets, wait: async () => f.recovery.work })
  assert.equal(state.phase, 'done')
  assert.deepEqual(f.calls, [7])
  await f.recovery.dispose()
})
