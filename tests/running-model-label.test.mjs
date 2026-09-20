import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

async function component() {
  let entry
  const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  vm.runInNewContext(bundle.replace('return { inject, apply, createMediaAutoplayGate, modelForMessage, thinkRowTarget, thinkRowExpanded, expandRunningThinkRow, collapseSettledThinkRow }', 'return { RunningModelBadge }'), {
    window: { __ModuleLoader__: { load(value) { entry = value } } },
  })
  return entry.factory(name => name === 'react' ? {
    createElement: (tag, props, text) => ({ tag, props, text }), useEffect() {},
  } : {}).RunningModelBadge
}

test('运行中读取实际请求，忽略下轮选择、旧轮次与压缩模型，工具期间保留显示', async () => {
  const Badge = await component()
  const current = { provider: 'api', model: 'actual-model', reasoningEffort: 'high' }
  const request = { purpose: 'assistant', turn: 2, step: 1, startSeq: 10, startedAt: 100, status: 'running', requestConfig: current }
  const snapshot = { requests: [
    { purpose: 'assistant', startSeq: 1, startedAt: 10, status: 'complete', requestConfig: { provider: 'old', model: 'old' } },
    request,
    { purpose: 'compaction', startSeq: 11, startedAt: 110, status: 'running', requestConfig: { provider: 'compact', model: 'compact' } },
  ] }
  const directory = { current: { provider: 'next', model: 'next' }, groups: [{ id: 'api', name: 'API Provider', models: [{ id: 'actual-model', name: 'Actual Model' }] }] }
  const render = (startTime = 100) => Badge({ startTime, useTrajectory: select => select(snapshot), useModelDirectory: select => select(directory), loadModelDirectory: async () => {} })
  assert.equal(render().text, 'Actual Model · API Provider')
  assert.equal(render().props.title, 'Actual Model · API Provider · high')
  const redirect = { turn: 2, step: 1, record: { from: { provider: 'subscription', model: 'original' }, to: current } }
  const redirected = () => Badge({ startTime: 100, useTrajectory: select => select(snapshot), useProjection: () => redirect,
    useModelDirectory: select => select(directory), loadModelDirectory: async () => {}, t: () => '已重定向' })
  assert.equal(redirected().text, '已重定向 · Actual Model · API Provider')
  assert.equal(redirected().props.title, 'original · subscription → Actual Model · API Provider · high')
  redirect.step = 2
  assert.equal(redirected().text, 'Actual Model · API Provider')
  request.status = 'complete'
  directory.current = { provider: 'changed', model: 'changed' }
  assert.equal(render().text, 'Actual Model · API Provider')
  assert.equal(render(200), null)
  assert.equal(render(null), null)
  snapshot.requests.push({ purpose: 'assistant', startSeq: 12, startedAt: 120, status: 'running' })
  assert.equal(render(), null)
  snapshot.requests.at(-1).requestConfig = { provider: 'api', model: 'unknown' }
  assert.equal(render().text, 'unknown · API Provider')
})
