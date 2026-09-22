import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire, registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'

test('发布产物用真实按钮呈现单行恢复提示，确认去重、失败重试、忽略与卸载', { skip: !process.env.DSH_SOURCE_ROOT }, async () => {
  const sourceRoot = process.env.DSH_SOURCE_ROOT
  const require = createRequire(resolve(sourceRoot, 'packages/client/ui-primitives/package.json'))
  const { JSDOM } = require('jsdom')
  const React = require('react')
  const dom = new JSDOM('<body><div id="app"></div></body>', { pretendToBeVisual: true })
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true }
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  const hooks = registerHooks({
    resolve(specifier, context, next) { return specifier.endsWith('.css') ? { url: new URL(specifier, context.parentURL).href, shortCircuit: true } : next(specifier, context) },
    load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: 'export default new Proxy({}, {get: (_, key) => String(key)})', shortCircuit: true } : next(url, context) },
  })
  const root = require('react-dom/client').createRoot(document.getElementById('app'))
  const disposers = []
  try {
    const primitives = await import(pathToFileURL(resolve(sourceRoot, 'packages/client/ui-primitives/lib/types/Button.js')).href)
    let entry
    vm.runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), { window: { __ModuleLoader__: { load(value) { entry = value } } }, document, setTimeout, clearTimeout })
    const plugin = entry.factory(name => name === 'react' ? React : primitives)
    const registrations = []
    const locales = new Map()
    await plugin.apply({
      effect(callback) { disposers.push(callback()) },
      locale: { register(id, value) { locales.set(id, value); return () => locales.delete(id) } },
      remote: { async $mount() { return () => {} } }, get: () => ({}),
      settingsScope: { bind: () => ({}) }, reflect: { get: () => ({ read() {} }) },
      slots: { inject(_slot, callback) { callback() }, register(options, component) { registrations.push({ options, component }); return () => {} } },
    })
    const row = registrations.find(item => item.options.id === 'chat-enhancement-recovery')
    assert.equal(row.options.name, 'sidebar.footer.action')
    const t = key => locales.get(row.options.locale).zh[key]
    const requests = []
    let reply
    const readRecovery = request => { requests.push(request); return new Promise(resolve => { reply = resolve }) }
    const ready = { phase: 'ready', batchId: 'fixture', pollIntervalMs: 60000, count: 1, restored: 0, scanErrors: 0 }
    await React.act(async () => root.render(React.createElement(row.component, { wide: true, readRecovery, t })))
    assert.equal(document.querySelector('.dsh-session-recovery'), null)
    await React.act(async () => reply(ready))
    assert.equal(document.querySelector('.dsh-session-recovery-label').textContent, '是否恢复意外中断会话')
    assert.deepEqual([...document.querySelectorAll('#app button')].map(button => button.textContent), ['✓', '×'])
    assert.equal(requests.length, 1)
    const button = document.querySelector('#app button'); button.focus(); assert.equal(document.activeElement, button)
    await React.act(async () => { button.click(); button.click() })
    assert.equal(requests.filter(request => request.action === 'recover').length, 1)
    assert.equal(document.querySelector('[role=progressbar]').hasAttribute('aria-valuenow'), false)
    await React.act(async () => reply({ ...ready, phase: 'recovering', restored: 1, count: 1, pollIntervalMs: 10 }))
    assert.equal(document.querySelector('[role=progressbar]').getAttribute('aria-valuenow'), '50')
    assert.equal(document.querySelector('.dsh-session-recovery-progress-fill').style.width, '50%')
    await React.act(async () => new Promise(resolve => setTimeout(resolve, 25)))
    await React.act(async () => reply({ ...ready, phase: 'failed' }))
    assert.equal(document.querySelector('[role=progressbar]'), null)
    assert.match(document.querySelector('.dsh-session-recovery-label').textContent, /重试/u)
    await React.act(async () => document.querySelectorAll('#app button')[1].click())
    assert.equal(requests.at(-1).action, 'dismiss')
    await React.act(async () => reply({ ...ready, phase: 'dismissed' }))
    assert.equal(document.querySelector('.dsh-session-recovery'), null)
    assert.match(document.querySelector('style').textContent, /white-space:nowrap/u)
    assert.match(document.querySelector('style').textContent, /var\(--dsw-alias-label-secondary\)/u)
    // 实际产物展示扫描阶段、数量和当前会话；失联请求解除按钮禁用。
    await React.act(async () => root.render(React.createElement(row.component, { key: 'timeout', wide: true, readRecovery, t, requestTimeoutMs: 40 })))
    await React.act(async () => reply({ ...ready, phase: 'checking', stage: 'scanning', completed: 2, total: 8, currentSessionId: 'original-session', stageStartedAt: Date.now() - 2000, pollIntervalMs: 5 }))
    assert.match(document.querySelector('.dsh-session-recovery-label').textContent, /检查中断记录 2\/8/)
    assert.match(document.querySelector('.dsh-session-recovery-label').title, /original-session/)
    assert.equal(document.querySelector('[role=progressbar]').getAttribute('aria-valuenow'), '25')
    await React.act(async () => new Promise(resolve => setTimeout(resolve, 60)))
    assert.match(document.querySelector('.dsh-session-recovery-label').textContent, /检查失败/)
    assert.equal(document.querySelector('#app button').disabled, false)
    await React.act(async () => document.querySelector('#app button').click())
    assert.equal(requests.at(-1).action, 'check')
    await React.act(async () => reply({ ...ready, phase: 'done' }))
    await React.act(async () => root.render(React.createElement(row.component, { key: 'late', wide: false, readRecovery, t })))
    await React.act(async () => root.render(null))
    await React.act(async () => reply(ready))
    assert.equal(document.querySelector('.dsh-session-recovery'), null)
  } finally {
    await React.act(async () => root.unmount())
    for (const dispose of disposers.reverse()) if (typeof dispose === 'function') dispose()
    assert.equal(document.querySelector('style'), null)
    hooks.deregister(); dom.window.close()
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
  }
})
