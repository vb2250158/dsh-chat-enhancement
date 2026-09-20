import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

test('built message badge resolves exact route names without following the current selection', async () => {
  const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  let entry
  vm.runInNewContext(bundle.replace('return { inject, apply, createMediaAutoplayGate, modelForMessage, thinkRowTarget, thinkRowExpanded, expandRunningThinkRow, collapseSettledThinkRow }', 'return { TurnModelBadge }'), {
    window: { __ModuleLoader__: { load(value) { entry = value } } },
  })
  const { TurnModelBadge } = entry.factory(name => name === 'react' ? {
    createElement: (tag, props, text) => ({ tag, props, text }), useEffect() {},
  } : {})
  const snapshot = { eventNodes: [{ kind: 'assistant', messageId: 'm-1', requestConfig: {
    provider: 'provider-a', model: 'gpt-6-astra', reasoningEffort: 'high',
  } }] }
  const directory = { current: { provider: 'provider-a', model: 'gpt-6-astra' }, groups: [
    { id: 'provider-a', name: 'Provider A', models: [{ id: 'gpt-6-astra', name: 'GPT-6 Astra' }] },
    { id: 'provider-b', name: 'Provider B', models: [{ id: 'gpt-6-astra', name: 'Different Name' }] },
  ] }
  let history = {}
  const render = () => TurnModelBadge({
    messageId: 'm-1', useTrajectory: select => select(snapshot),
    useModelDirectory: select => select(directory), loadModelDirectory: async () => {},
    useProjection: () => history, t: () => '已重定向',
  })
  assert.equal(render().text, 'GPT-6 Astra · Provider A')
  directory.current = { provider: 'provider-b', model: 'gpt-6-astra' }
  assert.equal(render().text, 'GPT-6 Astra · Provider A')
  assert.equal(render().props.title, 'GPT-6 Astra · Provider A · high')
  history = { 'm-1': { from: { provider: 'provider-b', model: 'gpt-6-astra' }, to: { provider: 'provider-a', model: 'gpt-6-astra' } } }
  assert.equal(render().text, '已重定向 · GPT-6 Astra · Provider A')
  assert.equal(render().props.title, 'Different Name · Provider B → GPT-6 Astra · Provider A · high')
  directory.current = null
  assert.equal(render().text, '已重定向 · GPT-6 Astra · Provider A')
  history = {}
  directory.groups = []
  assert.equal(render().text, 'gpt-6-astra · provider-a')
  snapshot.eventNodes = []
  assert.equal(render(), null)
})
