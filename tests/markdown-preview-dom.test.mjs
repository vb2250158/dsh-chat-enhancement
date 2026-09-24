import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire, registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'

const sourceRoot = process.env.DSH_SOURCE_ROOT
test('Markdown 弹窗使用真实原语渲染代码块、脚注和关闭', { skip: !sourceRoot }, async () => {
  const require = createRequire(resolve(sourceRoot, 'packages/client/ui-primitives/package.json'))
  const React = require('react')
  const { JSDOM } = require('jsdom')
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'https://harness.test/', pretendToBeVisual: true })
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true }
  const old = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  const hooks = registerHooks({
    resolve(specifier, context, next) { return specifier.endsWith('.css') ? { url: new URL(specifier, context.parentURL).href, shortCircuit: true } : next(specifier, context) },
    load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: 'export default new Proxy({}, {get: (_, key) => String(key)})', shortCircuit: true } : next(url, context) },
  })
  const root = require('react-dom/client').createRoot(document.getElementById('app'))
  const disposers = []
  try {
    const base = resolve(sourceRoot, 'packages/client/ui-primitives/lib/types')
    const primitives = Object.assign({}, ...await Promise.all(['Modal.js', 'Button.js', 'markdown/MarkdownText.js', 'icons/index.js'].map(file => import(pathToFileURL(resolve(base, file)).href))))
    const load = async file => {
      let result
      const win = Object.create(dom.window)
      win.__ModuleLoader__ = { load(entry) { result = entry.factory(name => name === 'react' ? React : name === 'react/jsx-runtime' ? require(name) : primitives) } }
      vm.runInNewContext(await readFile(file, 'utf8'), { window: win, document, navigator, Element: dom.window.Element, console, setInterval, clearInterval, setTimeout, clearTimeout })
      return result
    }
    const chat = await load(new URL('../lib/client.js', import.meta.url))
    const registrations = []
    const dictionaries = new Map()
    const slots = { inject(_key, fn) { fn() }, register(options, component) { registrations.push({ options, component }); return () => {} } }
    await chat.apply({ slots, effect(fn) { disposers.push(fn()) }, locale: { register(name, values) { dictionaries.set(name, values); return () => {} } }, remote: { async $mount() { return () => {} } }, get: () => ({}), settingsScope: { bind: () => ({}) }, reflect: { provide: () => () => {}, get: () => ({ read() {} }) } })
    const entry = registrations.find(x => x.options.id === 'chat-enhancement-markdown-preview')
    const t = key => dictionaries.get(entry.options.locale).zh[key]
    const text = '# 标题\n\n```js\nconst preview = true\n```\n\n正文[^a]\n\n[^a]: 脚注内容'
    await React.act(async () => root.render(React.createElement(entry.component, { sessionId: 'one', t, readMarkdown: async () => ({ name: 'SKILL.md', text }) })))
    const card = document.createElement('button'); card.title = 'C:/outside/SKILL.md'; document.body.append(card)
    await React.act(async () => card.click())
    assert.equal(document.getElementById('app').querySelector('[role="dialog"]'), null)
    assert.equal(document.querySelector('[role="dialog"] h1').textContent, '标题')
    assert.match(document.querySelector('[role="dialog"] pre').textContent, /const preview = true/)
    assert.match(document.querySelector('[data-footnotes]').textContent, /脚注内容/)
    assert.ok([...document.querySelectorAll('[role="dialog"] button')].some(button => button.textContent === '复制'))
    await React.act(async () => document.querySelector('[aria-label="关闭 Markdown 预览"]').click())
    assert.equal(document.querySelector('[role="dialog"]'), null)
    await React.act(async () => card.click())
    await React.act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' })))
    assert.equal(document.querySelector('[role="dialog"]'), null)
    await React.act(async () => root.render(React.createElement(entry.component, { sessionId: 'one', t, readMarkdown: async () => ({ name: 'SKILL.md', text }), getMarkdownPreviewRenderer: () => ({ text: value }) => React.createElement('div', { 'data-enhanced-markdown': true }, value) })))
    await React.act(async () => card.click())
    assert.match(document.querySelector('[data-enhanced-markdown]').textContent, /脚注内容/)
    assert.match(document.querySelector('style').textContent, /1800px/)
  } finally {
    await React.act(async () => root.unmount())
    for (const dispose of disposers.reverse()) if (typeof dispose === 'function') dispose()
    hooks.deregister(); dom.window.close()
    for (const [key, descriptor] of Object.entries(old)) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
})
