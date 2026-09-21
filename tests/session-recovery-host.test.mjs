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
  const fork = ctx.plugin({ apply(scope) { installSessionRecovery(scope, protocol, {}) } })
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
