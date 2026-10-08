import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire, registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'

test('发布菜单在真实 React 和原语中显示等待、失败重试及成功关闭', { skip: !process.env.DSH_SOURCE_ROOT }, async () => {
  const require = createRequire(resolve(process.env.DSH_SOURCE_ROOT, 'packages/client/ui-primitives/package.json'))
  const { JSDOM } = require('jsdom'), React = require('react')
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', { pretendToBeVisual: true, url: 'http://localhost/' })
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle, IS_REACT_ACT_ENVIRONMENT: true }
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  const hooks = registerHooks({
    resolve(specifier, context, next) { return specifier.endsWith('.css') ? { url: new URL(specifier, context.parentURL).href, shortCircuit: true } : next(specifier, context) },
    load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: 'export default new Proxy({}, { get: (_, key) => String(key) })', shortCircuit: true } : next(url, context) },
  })
  const primitives = await import(pathToFileURL(resolve(process.env.DSH_SOURCE_ROOT, 'packages/client/ui-primitives/lib/index.js')).href)
  let entry
  const disposers = [], registrations = [], dictionaries = new Map()
  const root = require('react-dom/client').createRoot(document.getElementById('app'))
  try {
    vm.runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), { document, setTimeout, clearTimeout, window: { __ModuleLoader__: { load(value) { entry = value } } } })
    const plugin = entry.factory(name => name === 'react' ? React : name === '@deepseek-ai/dsh-client-ui-goal' ? {} : primitives)
    await plugin.apply({ effect(fn) { disposers.push(fn()) }, locale: { register(id, value) { dictionaries.set(id, value); return () => {} } }, remote: { async $mount() { return () => {} } }, get: () => ({}), configForms: { get: () => ({}) }, reflect: { provide: () => () => {}, get: () => ({ read() {} }) }, slots: { inject(_, fn) { fn() }, register(options, component) { registrations.push({ options, component }); return () => {} } } })
    const menu = registrations.find(row => row.options.id === 'chat-enhancement-auto-rename')
    assert.ok(menu)
    let release, closed = false, calls = 0
    const readTitles = async request => { assert.equal(request.sessionId, 'fixture'); calls++; return new Promise((resolve, reject) => { release = { resolve, reject } }) }
    const t = key => dictionaries.get('chat-enhancement-titles').zh[key]
    const states = []
    for (const theme of ['light', 'dark', 'custom']) {
      document.body.dataset.theme = theme
      await React.act(async () => root.render(React.createElement(menu.component, { sessionId: 'fixture', useMenuOpenState: () => [true, value => { closed = !value }], readTitles, t })))
      assert.equal(document.querySelector('[role=menuitem]').textContent, '自动重命名')
    }
    states.push(document.querySelector('[role=menuitem]').textContent)
    await React.act(async () => document.querySelector('[role=menuitem]').click())
    assert.equal(document.querySelector('[role=menuitem]').disabled, true)
    states.push(document.querySelector('[role=menuitem]').textContent)
    await React.act(async () => release.reject(new Error('fixture failure')))
    assert.equal(closed, false)
    states.push(document.querySelector('[role=menuitem]').textContent)
    await React.act(async () => document.querySelector('[role=menuitem]').click())
    await React.act(async () => release.resolve({ title: '合成标题' }))
    assert.equal(closed, true)
    assert.equal(calls, 2)
    assert.equal(states.join('\n') + '\n', await readFile(new URL('./fixtures/session-title-menu.expected.txt', import.meta.url), 'utf8'))
  } finally {
    await React.act(async () => root.unmount())
    for (const dispose of disposers.reverse()) if (typeof dispose === 'function') dispose()
    for (const [key, descriptor] of Object.entries(previous)) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
    dom.window.close()
    hooks.deregister()
  }
})
