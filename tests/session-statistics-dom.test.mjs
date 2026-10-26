import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire, registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'

test('built activity replacement opens a modal with measured bars, exact values and keyboard dismissal', { skip: !process.env.DSH_SOURCE_ROOT }, async () => {
  const sourceRoot = process.env.DSH_SOURCE_ROOT
  const require = createRequire(resolve(sourceRoot, 'packages/client/ui-primitives/package.json'))
  const React = require('react'), { JSDOM } = require('jsdom')
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost/' })
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle, IS_REACT_ACT_ENVIRONMENT: true }
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  const hooks = registerHooks({
    resolve(specifier, context, next) { return specifier.endsWith('.css') ? { url: new URL(specifier, context.parentURL).href, shortCircuit: true } : next(specifier, context) },
    load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: 'export default new Proxy({}, { get: (_, key) => String(key) })', shortCircuit: true } : next(url, context) },
  })
  const root = require('react-dom/client').createRoot(document.getElementById('app'))
  const disposers = []
  try {

    const primitives = await import(pathToFileURL(resolve(sourceRoot, 'packages/client/ui-primitives/lib/index.js')).href)

    let entry
    vm.runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), {
      document, Intl, setTimeout, clearTimeout, window: { __ModuleLoader__: { load(value) { entry = value } } },
    })
    const plugin = entry.factory(name => name === 'react' ? React : name === '@deepseek-ai/dsh-client-ui-goal' ? {} : primitives)

    const rows = [], dictionaries = new Map()
    await plugin.apply({ effect(fn) { disposers.push(fn()) }, locale: { register(id, value) { dictionaries.set(id, value); return () => {} } },
      remote: { async $mount() { return () => {} } }, get: () => ({}), configForms: { get: () => ({}) }, reflect: { provide: () => () => {}, get: () => ({ read() {} }) },
      slots: { inject(_key, fn) { fn() }, register(options, component) { rows.push({ options, component }); return () => {} } } })

    const activity = rows.find(row => row.options.name === 'conversation.composer.dock' && row.options.id === 'activity')
    assert.ok(activity)
    assert.ok(activity.options.priority < 0)
    const theme = await readFile(resolve(sourceRoot, 'packages/client/ui-theme/src/styles/design-platform.css'), 'utf8')
    const css = [...document.querySelectorAll('style')].find(style => style.textContent.includes('.dsh-session-statistics-summary')).textContent
    const tokens = [...new Set(css.match(/--dsw-alias-[a-z0-9-]+/g))]
    assert.deepEqual(tokens.filter(token => !theme.includes(`${token}:`)), [], 'All chart and dialog colors exist in the host theme')
    assert.equal(rows.filter(row => row.options.name === 'conversation.composer.dock' && row.options.id === 'usage').length, 0)
    const translate = language => (key, args = {}) => Object.entries(args).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), dictionaries.get(activity.options.locale)[language][key] ?? key)
    let stats = { turns: 1, steps: 1, turnMs: 17800, llmMs: 3300, toolMs: 0, compactionMs: 0, otherMs: 14500,
      ttftMs: 3200, ttftSteps: 1, decodeMs: 100, decodeTokens: 24 }
    const usage = { uncachedInputTokens: 31900, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 24 }
    let t = translate('zh')
    const render = () => root.render(React.createElement(activity.component, { useProjection: name => name === 'sessionStats' ? stats : usage, t }))
    await React.act(async () => render())

    const trigger = document.querySelector('[data-composer-stat="activity"]')
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.match(trigger.textContent, /17.8 秒/)
    trigger.focus()
    await React.act(async () => trigger.click())

    const dialog = document.querySelector('[role="dialog"]')
    assert.equal(dialog.getAttribute('aria-modal'), 'true')
    assert.match(dialog.textContent, /14,500 毫秒/)
    assert.match(dialog.textContent, /3,200 毫秒/)
    assert.match(dialog.textContent, /31,900/)
    assert.match(dialog.textContent, /不能直接相加/)
    assert.equal(dialog.querySelectorAll('[role="img"]').length, 4)
    const width = Number.parseFloat(dialog.querySelector('[data-kind="other"]').style.width)
    assert.ok(Math.abs(width - 14500 / 17800 * 100) < 0.01)

    stats = { ...stats, toolMs: 35600 }
    await React.act(async () => render())
    assert.equal(document.querySelector('[data-kind="tools"]').style.width, '100%')
    assert.match(document.querySelector('[data-timing-kind="tools"]').textContent, /200%/)
    await React.act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.ok(document.activeElement === trigger, 'Escape restores focus to the statistics trigger')
    stats = { ...stats, turnMs: undefined, otherMs: undefined, compactionMs: undefined, ttftSteps: 0, decodeMs: 0 }
    t = translate('en')
    await React.act(async () => render())
    await React.act(async () => document.querySelector('[data-composer-stat="activity"]').click())
    assert.match(document.querySelector('[role="dialog"]').textContent, /Unavailable/)
    assert.match(document.querySelector('[role="dialog"]').textContent, /Cumulative turn time unavailable/)
    await React.act(async () => document.querySelector('[aria-label="Close session statistics"]').click())
    stats = undefined
    await React.act(async () => render())
    await React.act(async () => document.querySelector('[data-composer-stat="activity"]').click())
    assert.match(document.querySelector('[role="dialog"]').textContent, /Whole-log statistics are not available yet/)
  } finally {

    await React.act(async () => root.unmount())
    for (const dispose of disposers.reverse()) if (typeof dispose === 'function') dispose()
    assert.equal(document.querySelectorAll('.dsh-session-statistics').length, 0)
    assert.ok(![...document.querySelectorAll('style')].some(style => style.textContent.includes('.dsh-session-statistics-summary')))
    hooks.deregister(); dom.window.close()
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
  }
})
