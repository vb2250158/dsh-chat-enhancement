import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire, registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'

const sourceRoot = process.env.DSH_SOURCE_ROOT
test('生成的插件使用真实原语显示后台说明，支持开关、会话隔离和卸载', { skip: !sourceRoot }, async () => {
  const require = createRequire(resolve(sourceRoot, 'packages/client/ui-primitives/package.json'))
  const { JSDOM } = require('jsdom')
  const React = require('react')
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', { pretendToBeVisual: true })
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true }
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      return specifier.endsWith('.css') ? { url: new URL(specifier, context.parentURL).href, shortCircuit: true } : next(specifier, context)
    },
    load(url, context, next) {
      return url.endsWith('.css') ? { format: 'module', source: 'export default new Proxy({}, { get: (_, key) => String(key) })', shortCircuit: true } : next(url, context)
    },
  })
  const { createRoot } = require('react-dom/client')
  const root = createRoot(document.getElementById('app'))
  const disposers = []
  try {
    const primitives = Object.assign({}, ...await Promise.all(['Button', 'Menu', 'StateDot', 'Tooltip', 'Switch'].map(name => import(pathToFileURL(resolve(sourceRoot, `packages/client/ui-primitives/lib/types/${name}.js`)).href))), await import(pathToFileURL(resolve(sourceRoot, 'packages/client/ui-primitives/lib/types/icons/index.js')).href))
    let entry
    const code = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
    vm.runInNewContext(code, { window: { __ModuleLoader__: { load(value) { entry = value } } }, document, setInterval, clearInterval, setTimeout, clearTimeout })
    const plugin = entry.factory(name => name === 'react' ? React : primitives)
    const registrations = []
    const dictionaries = new Map()
    let snapshot = { status: 'ready', value: { toolDescriptions: true }, writable: true }
    const listeners = new Set()
    const writes = []
    const chatSettings = { getSnapshot: () => snapshot, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) }, async set(field, value) { writes.push([field, value]) } }
    await plugin.apply({
      effect(callback) { disposers.push(callback()) },
      locale: { register(name, values) { dictionaries.set(name, values); return () => dictionaries.delete(name) } },
      remote: { async $mount() { return () => {} } },
      get: () => ({}),
      settingsScope: { bind: () => chatSettings },
      reflect: { get: () => ({ read() {} }) },
      slots: { inject(_name, callback) { callback() }, register(options, component) { registrations.push({ options, component }); return () => {} } },
    })
    const registration = registrations.find(item => item.options.id === 'job-list')
    assert.equal(registration.options.priority, 100)
    const t = (key, data = {}) => dictionaries.get(registration.options.locale).zh[key].replace(/\{(\w+)\}/gu, (_, field) => data[field])
    const startedAt = Date.now() - 2000
    let jobs = [{ id: 'pwsh-1', kind: 'pwsh', label: 'Get-Process', status: 'running', startedAt }]
    const nodes = [{ kind: 'tool-result', callTime: startedAt - 1, time: startedAt + 1, isError: false, call: { name: 'pwsh', argsRaw: JSON.stringify({ command: 'Get-Process', description: '检查运行进程', run_in_background: true }) }, content: [{ type: 'text', text: 'started background job pwsh-1' }] }]
    let sessionId = 'one'
    const render = () => React.act(() => root.render(React.createElement(registration.component, { sessionId, t, chatSettings, useSessions: selector => selector({ jobsBySession: { one: jobs, two: [] } }), useTrajectory: selector => selector({ eventNodes: sessionId === 'one' ? nodes : [] }) })))
    const clickTrigger = () => React.act(() => document.querySelector('#app button').click())
    render()
    clickTrigger()
    assert.match(document.querySelector('[role="menu"]').textContent, /检查运行进程/u)
    React.act(() => { snapshot = { ...snapshot, value: { toolDescriptions: false } }; for (const listener of listeners) listener() })
    assert.match(document.querySelector('[role="menu"]').textContent, /Get-Process/u)
    assert.doesNotMatch(document.querySelector('[role="menu"]').textContent, /检查运行进程/u)
    React.act(() => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    assert.equal(document.querySelector('[role="menu"]'), null)
    assert.ok(document.activeElement === document.querySelector('#app button'), 'Escape 后焦点回到列表按钮')
    clickTrigger()
    jobs = [{ ...jobs[0], status: 'failed', finishedAt: startedAt + 1000, detail: 'exit code: 1' }]
    render()
    assert.match(document.querySelector('[role="menu"]').textContent, /exit code: 1/u)
    assert.match(document.querySelector('[role="menu"]').textContent, /1秒/u)
    sessionId = 'two'
    render()
    assert.equal(document.querySelector('[role="menu"]'), null)
    assert.equal(document.querySelector('#app button'), null)
    const settings = registrations.find(item => item.options.id === 'chat-enhancement' && item.options.name === 'settings.section')
    React.act(() => root.render(React.createElement(settings.component, { chatSettings })))
    const switches = [...document.querySelectorAll('[role="switch"]')]
    assert.equal(switches.length, 4)
    assert.equal(document.querySelector('input[type="checkbox"]'), null)
    for (const control of switches) {
      assert.equal(control.tagName, 'BUTTON')
      assert.ok(control.getAttribute('aria-label'))
      React.act(() => control.click())
    }
    assert.deepEqual(writes, [['expandReasoningWhileRunning', true], ['toolDescriptions', true], ['audioAutoplay', true], ['videoAutoplay', true]])
    React.act(() => { snapshot = { ...snapshot, writable: false }; for (const listener of listeners) listener() })
    for (const control of document.querySelectorAll('[role="switch"]')) {
      assert.equal(control.disabled, true)
      React.act(() => control.click())
    }
    assert.equal(writes.length, 4)
    const recovery = registrations.find(item => item.options.id === 'chat-enhancement-recovery')
    assert.equal(recovery.options.name, 'sidebar.footer.action')
    const recoveryText = key => dictionaries.get(recovery.options.locale).zh[key]
    const requests = []
    let completeCheck
    let completeRecovery
    const readRecovery = request => {
      requests.push(request)
      if (request.action === 'check') return new Promise(resolve => { completeCheck = resolve })
      return new Promise(resolve => { completeRecovery = resolve })
    }
    const ready = { phase: 'ready', batchId: 'batch', count: 2, scanErrors: 0, restored: 0, pollIntervalMs: 60000 }
    await React.act(async () => root.render(React.createElement(recovery.component, { wide: true, readRecovery, t: recoveryText })))
    assert.equal(document.querySelector('.dsh-session-recovery'), null, '异步检查不阻塞页面或提前显示恢复按钮')
    await React.act(async () => completeCheck(ready))
    assert.equal(document.querySelector('.dsh-session-recovery-label').textContent, '是否恢复意外中断会话')
    assert.deepEqual([...document.querySelectorAll('#app button')].map(button => button.textContent), ['✓', '×'])
    assert.equal(requests.filter(request => request.action === 'recover').length, 0)
    const tick = document.querySelector('#app button')
    tick.focus(); assert.equal(document.activeElement, tick)
    await React.act(async () => { tick.click(); tick.click() })
    assert.equal(requests.filter(request => request.action === 'recover').length, 1)
    assert.ok(document.querySelector('#app button').disabled)
    await React.act(async () => completeRecovery({ ...ready, phase: 'failed', count: 1, restored: 1 }))
    assert.match(document.querySelector('.dsh-session-recovery-label').textContent, /重试/u)
    await React.act(async () => document.querySelectorAll('#app button')[1].click())
    assert.equal(requests.at(-1).action, 'dismiss')
    await React.act(async () => completeRecovery({ ...ready, phase: 'dismissed' }))
    assert.equal(document.querySelector('.dsh-session-recovery'), null)
    assert.match(document.querySelector('style').textContent, /var\(--dsw-alias-label-secondary\)/u)
    assert.match(document.querySelector('style').textContent, /white-space:nowrap/u)
    const oldRequestCount = requests.length
    await React.act(async () => root.render(React.createElement(recovery.component, { key: 'unmount-probe', wide: true, readRecovery, t: recoveryText })))
    assert.equal(requests.length, oldRequestCount + 1)
    await React.act(async () => root.render(null))
    await React.act(async () => completeCheck(ready))
    assert.equal(document.querySelector('.dsh-session-recovery'), null, '卸载后的查询结果不再更新页面或重启轮询')
  } finally {
    React.act(() => root.unmount())
    for (const dispose of disposers.reverse()) if (typeof dispose === 'function') dispose()
    assert.equal(document.querySelector('style'), null)
    hooks.deregister()
    dom.window.close()
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})
