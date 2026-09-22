import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire, registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'

test('发布产物复用真实目标栏，计时刷新、编辑动作及完成尾注匹配消息', { skip: !process.env.DSH_SOURCE_ROOT }, async () => {
  const sourceRoot = process.env.DSH_SOURCE_ROOT
  const require = createRequire(resolve(sourceRoot, 'packages/client/ui-primitives/package.json'))
  const { JSDOM } = require('jsdom'), React = require('react')
  const dom = new JSDOM('<body><div id="app"></div></body>', { pretendToBeVisual: true, url: 'http://localhost/' })
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle, IS_REACT_ACT_ENVIRONMENT: true }
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  const hooks = registerHooks({
    resolve(specifier, context, next) { return specifier.endsWith('.css') ? { url: new URL(specifier, context.parentURL).href, shortCircuit: true } : next(specifier, context) },
    load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: 'export default new Proxy({}, { get: (_, key) => String(key) })', shortCircuit: true } : next(url, context) },
  })
  const root = require('react-dom/client').createRoot(document.getElementById('app'))
  const disposers = [], intervals = new Set()
  try {
    const primitives = await import(pathToFileURL(resolve(sourceRoot, 'packages/client/ui-primitives/lib/index.js')).href)
    let goalEntry, entry
    const sandbox = { document, window: { __ModuleLoader__: { load(value) { goalEntry = value } } } }
    vm.runInNewContext(await readFile(resolve(sourceRoot, 'packages/client/ui-goal/lib/client.js'), 'utf8'), sandbox)
    const goalRequire = createRequire(resolve(sourceRoot, 'packages/client/ui-goal/package.json'))
    const goal = goalEntry.factory(name => name === '@deepseek-ai/dsh-client-ui-primitives' ? primitives : goalRequire(name))
    vm.runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), {
      document, setTimeout, clearTimeout,
      setInterval(fn) { intervals.add(fn); return fn }, clearInterval(fn) { intervals.delete(fn) },
      window: { __ModuleLoader__: { load(value) { entry = value } } },
    })
    const plugin = entry.factory(name => name === 'react' ? React : name === '@deepseek-ai/dsh-client-ui-goal' ? goal : primitives)
    const rows = [], dictionaries = new Map()
    await plugin.apply({ effect(fn) { disposers.push(fn()) }, locale: { register(id, value) { dictionaries.set(id, value); return () => {} } },
      remote: { async $mount() { return () => {} } }, get: () => ({}), settingsScope: { bind: () => ({}) }, reflect: { get: () => ({ read() {} }) },
      slots: { inject(_key, fn) { fn() }, register(options, component) { rows.push({ options, component }); return () => {} } } })
    const dock = rows.find(row => row.options.id === 'goal')
    assert.equal(dock.options.priority, 100)
    const projection = { goal: { id: 'a', revision: 1, phase: 'active', objective: '合成测试目标' }, createdAt: Date.now() - 65000 }
    let edited
    const props = { useProjection: () => projection, useGoalActivation: select => select({ id: 'a', revision: 1, activation: 'armed' }),
      t: key => ({ 'phase.active': '进行中的目标', 'action.edit': '编辑目标', 'action.pause': '暂停目标', 'action.clear': '清除目标' })[key] ?? key,
      onEdit: text => { edited = text }, onPause: async () => ({ ok: true }), onResume: async () => ({ ok: true }), onClear: async () => ({ ok: true }) }
    await React.act(async () => root.render(React.createElement(dock.component, props)))
    assert.match(document.querySelector('[data-goal-bar]').textContent, /进行中的目标 · 01:0[5-9]/)
    assert.equal(intervals.size, 1)
    await React.act(async () => document.querySelector('[aria-label="编辑目标"]').click())
    assert.equal(edited, '合成测试目标')
    projection.goal.phase = 'complete'
    await React.act(async () => root.render(React.createElement(dock.component, props)))
    assert.equal(document.querySelector('[data-goal-bar]'), null)
    assert.equal(intervals.size, 0)
    const badge = rows.find(row => row.options.id === 'chat-enhancement-goal-completed')
    const badgeProps = { messageId: 'final', t: key => dictionaries.get(badge.options.locale).zh[key],
      useProjection: () => ({ completed: { final: { id: 'a', tokens: 213363, missing: 0, createdAt: 1000, completedAt: 3662000 } } }) }
    await React.act(async () => root.render(React.createElement(badge.component, badgeProps)))
    assert.equal(document.querySelector('[data-dsh-goal-completed]').textContent, '目标已完成 · 213,363 token · 用时 1:01:01')
    await React.act(async () => root.render(React.createElement(badge.component, { ...badgeProps, messageId: 'other' })))
    assert.equal(document.querySelector('[data-dsh-goal-completed]'), null)
  } finally {
    await React.act(async () => root.unmount())
    for (const dispose of disposers.reverse()) if (typeof dispose === 'function') dispose()
    hooks.deregister(); dom.window.close()
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
  }
})
