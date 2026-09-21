import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { installSessionRecovery } from '../src/session-recovery.js'

test('当前 Host 的 Cordis 和 Typert 注册恢复服务，描述符校验请求，卸载移除服务', { skip: !process.env.DSH_SOURCE_ROOT }, async () => {
  const require = createRequire(join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'profiles', 'web', 'package.json'))
  const { Context } = require('@deepseek-ai/cordis')
  const protocol = require('@deepseek-ai/dsh-typert-protocol')
  const ctx = new Context()
  ctx.provide('agents')
  ctx.provide('sessionQuery')
  ctx.set('agents', { get() {} })
  ctx.set('sessionQuery', { async listSessions() { return [] } })
  const fork = ctx.plugin({ apply(scope) { installSessionRecovery(scope, protocol, { recoveryAutoResume: false }) } })
  try {
    await fork
    const service = ctx.get('chatRecovery')
    assert.ok(service)
    const state = await service.read({ action: 'check' })
    assert.equal(state.phase, 'checking')
    const { TYPERT } = await import('../src/typert.host.js')
    const descriptor = TYPERT.invocations.find(item => item.service === 'chatRecovery')
    assert.equal(descriptor.result.schema.parse(state).batchId, state.batchId)
    assert.throws(() => descriptor.parameters[0].codec.schema.parse({ action: 'remove' }))
    await fork.dispose()
    assert.equal(ctx.get('chatRecovery'), undefined)
  } finally { await fork.dispose() }
})


test('Host 插件加载自动恢复，未调用查询也会启动原会话', { skip: !process.env.DSH_SOURCE_ROOT }, async () => {
  const require = createRequire(join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'profiles', 'web', 'package.json'))
  const { Context } = require('@deepseek-ai/cordis')
  const protocol = require('@deepseek-ai/dsh-typert-protocol')
  const ctx = new Context()
  const calls = []
  const time = Date.now() - process.uptime() * 1000 - 1000
  const header = { id: 'startup-original' }
  const agent = { status: 'idle', inbox: { nextTurn: [], nextStep: [] }, continueInterrupted(seq) { calls.push(seq); return true } }
  for (const name of ['agents', 'sessionQuery', 'sessionController', 'goals']) ctx.provide(name)
  ctx.set('agents', { get() {} })
  ctx.set('sessionQuery', {
    async listSessions() { return [{ header }] },
    async observeSession() { return { header, inheritedEventCount: 0, events: [
      { type: 'turn/start', seq: 7, time: time - 1, data: { turn: 1 } },
      { type: 'turn/end', seq: 8, time, data: { reason: { kind: 'interrupted' } } },
    ], [Symbol.dispose]() {} } },
  })
  ctx.set('goals', { get() {} })
  ctx.set('sessionController', {
    async resolveAgent() { return { agent } },
    prompt() { throw new Error('recovery must not send a message') },
  })
  const fork = ctx.plugin({ apply(scope) { installSessionRecovery(scope, protocol, {}) } })
  try {
    await fork
    await new Promise((resolve, reject) => {
      const deadline = Date.now() + 3000
      const poll = () => calls.length ? resolve() : Date.now() > deadline ? ctx.get('chatRecovery').read({ action: 'check' }).then(state => reject(new Error(JSON.stringify(state)))) : setTimeout(poll, 10)
      poll()
    })
    assert.deepEqual(calls, [7])
    assert.equal((await ctx.get('chatRecovery').read({ action: 'check' })).restored, 1)
  } finally { await fork.dispose(); await ctx.fiber.dispose() }
})
