import assert from 'node:assert/strict'
import test from 'node:test'
import { SessionRecovery, interruptedCandidate, recoveryConfig } from '../src/session-recovery.js'

const bootAt = 10000000
function value(id) {
  return { header: { id }, inheritedEventCount: 0, events: [
    { type: 'turn/start', seq: 0, time: bootAt - 2000 },
    { type: 'turn/end', seq: 1, time: bootAt - 1000, data: { reason: { kind: 'interrupted' } } },
  ], [Symbol.dispose]() {} }
}

test('扫描限量并行，进度对应最早未完成读取，候选保持列表顺序', async () => {
  const pending = new Map(), disposed = [], reads = []
  const headers = Array.from({ length: 7 }, (_, i) => ({ id: String(i) }))
  let changed
  const started = () => new Promise(resolve => { changed = resolve })
  const ctx = { agents: { get() {} }, sessionQuery: {
    async listSessions() { return headers.map(header => ({ header })) },
    observeSession(id) {
      reads.push(id)
      changed?.(); changed = undefined
      return new Promise(resolve => pending.set(id, () => {
        const observation = value(id)
        observation[Symbol.dispose] = () => disposed.push(id)
        resolve(observation)
      }))
    },
  } }
  const recovery = new SessionRecovery(ctx, {}, bootAt)
  const first = started()
  const scanning = recovery.scan()
  await first
  await Promise.resolve()
  assert.equal(pending.size, 4)
  assert.equal(recovery.snapshot().currentSessionId, '0')
  const next = started()
  pending.get('3')()
  await next
  assert.equal(reads.length, 5)
  assert.equal(recovery.snapshot().completed, 1)
  assert.equal(recovery.snapshot().currentSessionId, '0')
  for (const id of ['0', '1', '2']) pending.get(id)()
  while (reads.length < 7) await started()
  for (const id of ['4', '5', '6']) pending.get(id)()
  await scanning
  assert.equal(recovery.completed, 7)
  assert.equal(disposed.length, 7)
  assert.deepEqual([...recovery.candidates.keys()], headers.map(header => header.id))
  await recovery.dispose()
})

test('取消扫描收束全部工作者，迟到句柄释放且不再取新记录', async () => {
  const releases = [], disposed = []
  let started
  const allStarted = new Promise(resolve => { started = resolve })
  const ctx = { agents: { get() {} }, sessionQuery: {
    async listSessions() { return Array.from({ length: 8 }, (_, id) => ({ header: { id: String(id) } })) },
    observeSession(id) { return new Promise(resolve => {
      releases.push(() => { const observation = value(id); observation[Symbol.dispose] = () => disposed.push(id); resolve(observation) })
      if (releases.length === 4) started()
    }) },
  } }
  const recovery = new SessionRecovery(ctx, {}, bootAt)
  recovery.read({ action: 'check' })
  await allStarted
  await recovery.dispose()
  assert.equal(recovery.active, false)
  assert.equal(releases.length, 4)
  releases.forEach(release => release())
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(disposed.length, 4)
  assert.equal(recovery.candidates.size, 0)
})

test('根会话只访问最后轮次，子会话模式仍从自己的历史解析', () => {
  const events = Array.from({ length: 10000 }, (_, seq) => new Proxy({ seq }, { get() { throw Error('old root history visited') } }))
  events.push({ type: 'turn/start', seq: 10000, time: bootAt - 1000 })
  const root = value('root'); root.events = events
  assert.equal(interruptedCandidate(root, bootAt, 3600000).startSeq, 10000)
  const child = value('child'); child.header = { id: 'child', origin: 'subagent', parentSession: 'parent' }
  child.events.unshift({ type: 'subagent/descriptor', seq: -1, data: { mode: 'continuable' } })
  child.inheritedEventCount = -1
  assert.equal(interruptedCandidate(child, bootAt, 3600000).parentId, 'parent')
  child.inheritedEventCount = 0
  assert.equal(interruptedCandidate(child, bootAt, 3600000), undefined)
  for (const recoveryScanConcurrency of [0, -1, 1.5, 17]) assert.throws(() => recoveryConfig({ recoveryScanConcurrency }))
  assert.equal(recoveryConfig({ recoveryScanConcurrency: 1 }).recoveryScanConcurrency, 1)
})
