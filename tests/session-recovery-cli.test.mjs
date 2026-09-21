import assert from 'node:assert/strict'
import test from 'node:test'
import { runRecovery, localRecoveryReader } from '../scripts/recover-sessions.mjs'

function states(phases) {
  const calls = []
  const read = async request => { calls.push(request); return { phase: phases.shift(), batchId: 'same-batch', pollIntervalMs: 1, count: 1 } }
  return { calls, read }
}
test('CLI check 仅等待检查，recover 确认同一批次一次并等待结束', async () => {
  const check = states(['checking', 'ready'])
  assert.equal((await runRecovery(check.read, { action: 'check', wait: async () => {} })).phase, 'ready')
  assert.ok(check.calls.every(request => request.action === 'check'))
  const recover = states(['checking', 'ready', 'recovering', 'done'])
  assert.equal((await runRecovery(recover.read, { action: 'recover', wait: async () => {} })).phase, 'done')
  assert.deepEqual(recover.calls.filter(request => request.action === 'recover'), [{ action: 'recover', batchId: 'same-batch' }])
})
test('CLI 保留失败和忽略状态，不重复恢复已完成的批次', async () => {
  for (const phase of ['done', 'dismissed']) {
    const f = states([phase]); await runRecovery(f.read, { action: 'recover' }); assert.equal(f.calls.length, 1)
  }
  const f = states(['ready', 'recovering', 'failed'])
  assert.equal((await runRecovery(f.read, { action: 'recover', wait: async () => {} })).phase, 'failed')
  assert.equal(f.calls.filter(request => request.action === 'recover').length, 1)
})
test('CLI 超时结束等待，不把凭据发往远端或 URL 附带的认证地址', async () => {
  let now = 0
  await assert.rejects(runRecovery(async () => ({ phase: 'checking', pollIntervalMs: 2 }), { action: 'check', timeoutMs: 1, now: () => now, wait: async ms => { now += ms } }), /超时/u)
  for (const baseUrl of ['https://example.com', 'http://user:pass@localhost', 'http://localhost/path', 'file:///tmp/test']) assert.throws(() => localRecoveryReader({ baseUrl, dshHome: 'unused' }), /本机/u)
})
