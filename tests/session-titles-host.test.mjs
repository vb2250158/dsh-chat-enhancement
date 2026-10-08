import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { emptySessionTitle, installSessionTitles } from '../src/session-titles.js'

test('正式 Host 注册标题服务，首消息替换空会话名称，卸载移除服务', { skip: !process.env.DSH_HOME }, async () => {
  const require = createRequire(process.env.DSH_HOME + '/profiles/web/package.json')
  const { Context } = require('@deepseek-ai/cordis'), protocol = require('@deepseek-ai/dsh-typert-protocol')
  const { Session, SessionId } = require('@deepseek-ai/dsh-session')
  const ctx = new Context()
  const session = Session.create(SessionId('fixture-host-title'))
  const events = []
  let state = { title: emptySessionTitle(session.header), source: { kind: 'user' } }
  for (const name of ['sessions', 'sessionTitle', 'sessionController', 'sessionProjections']) ctx.provide(name)
  ctx.set('sessions', { get: () => session })
  ctx.set('sessionController', { async list() { return { items: [] } } })
  ctx.set('sessionProjections', { stateOf: () => ({ count: events.length }) })
  ctx.set('sessionTitle', { get: () => state, async refresh() { return state = { title: '修复登录', source: { kind: 'provider' } } } })
  const fork = ctx.plugin({ apply(scope) { installSessionTitles(scope, protocol) } })
  try {
    await fork
    assert.ok(ctx.get('chatTitles'))
    assert.equal('events' in session, false)
    events.push({ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '修复登录' }] } })
    ctx.emit('session/event', session, { type: 'request/header' })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(state.title, '修复登录')
    const { TYPERT } = await import('../src/typert.host.js')
    const descriptor = TYPERT.invocations.find(item => item.service === 'chatTitles')
    assert.throws(() => descriptor.parameters[0].codec.schema.parse({ action: 'rename', sessionId: '' }))
    assert.deepEqual(descriptor.result.schema.parse(await ctx.get('chatTitles').read({ action: 'list' })), { items: [] })
    await fork.dispose()
    assert.equal(ctx.get('chatTitles'), undefined)
  } finally { await fork.dispose(); await ctx.fiber.dispose() }
})
