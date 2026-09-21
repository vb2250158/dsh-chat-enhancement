import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire, registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'

const sourceRoot = process.env.DSH_SOURCE_ROOT
test('两个生成插件通过公开插槽显示问题及选项图文，保留选择、提交和失败回退', { skip: !sourceRoot }, async () => {
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
    const primitives = Object.assign({}, ...await Promise.all(['Button.js', 'markdown/MarkdownText.js', 'icons/index.js'].map(file => import(pathToFileURL(resolve(base, file)).href))))
    const load = async file => {
      let result
      const win = Object.create(dom.window)
      win.__ModuleLoader__ = { load(entry) { result = entry.factory(name => name === 'react' ? React : name === 'react/jsx-runtime' ? require(name) : primitives) } }
      vm.runInNewContext(await readFile(file, 'utf8'), { window: win, document, navigator, console, setInterval, clearInterval, setTimeout, clearTimeout })
      return result
    }
    const chat = await load(new URL('../lib/client.js', import.meta.url))
    const questions = await load(new URL('../../dsh-proactive-questioning/lib/client.js', import.meta.url))
    const registrations = []
    const dictionaries = new Map()
    const slots = { inject(_key, fn) { fn() }, register(options, component) { registrations.push({ options, component }); return () => {} } }
    await chat.apply({ slots, effect(fn) { disposers.push(fn()) }, locale: { register(name, values) { dictionaries.set(name, values); return () => {} } }, remote: { async $mount() { return () => {} } }, get: () => ({}), settingsScope: { bind: () => ({}) }, reflect: { get: () => ({ read() {} }) } })
    questions.apply({ slots })
    const rich = registrations.find(x => x.options.name === 'proactive.question.content')
    const dock = registrations.find(x => x.options.id === 'proactive-questioning-dock')
    const tool = registrations.find(x => x.options.key === 'queue_user_question')
    assert.equal(dock.options.children['proactive.question.content'].scope, 'session')
    const t = key => dictionaries.get(rich.options.locale).zh[key]
    const renderSlot = (key, owner) => { assert.equal(key, 'proactive.question.content'); return React.createElement(rich.component, { ...owner, t }) }
    const sent = []
    const question = { id: 'layout', question: '说明前 ![总览](https://images.test/overview.png) 说明后', detail: '细节前\n\n![细节](<C:/mock folder/detail.png>)\n\n细节后', options: [{ label: '方案 A (推荐)', description: '选项前\n\n![方案图](https://images.test/a.png)\n\n选项后 [参考](https://example.test/)' }, { label: '方案 B', description: '普通说明' }] }
    const mount = (sessionId = 'one', enabled = true) => root.render(React.createElement(React.Fragment, null,
      React.createElement(tool.component, { sessionId: 'one', callId: 'call', block: { argsRaw: JSON.stringify({ questions: [question] }) } }),
      React.createElement(dock.component, { sessionId, send: async text => sent.push(text), ...(enabled ? { renderSlot } : {}) })))
    await React.act(async () => mount())
    const projection = { images: [...document.querySelectorAll('img')].map(x => ({ alt: x.alt, src: x.src })), choices: [...document.querySelectorAll('[role="radio"]')].map(x => x.getAttribute('aria-label')) }
    assert.deepEqual(projection, JSON.parse(await readFile(new URL('./fixtures/question-images.expected.json', import.meta.url), 'utf8')))
    assert.equal(document.querySelectorAll('img').length, 3)
    assert.equal(document.querySelector('img[alt="细节"]').src, 'https://harness.test/api/file?path=C%3A%2Fmock%20folder%2Fdetail.png')
    assert.match(document.body.textContent, /选项前.*选项后/su)
    assert.equal(document.querySelector('button button, button a, button img'), null, '富文本不嵌入选择按钮')
    await React.act(async () => mount('one', false))
    assert.equal(document.querySelector('img'), null)
    assert.match(document.body.textContent, /!\[方案图\]/u, '未安装增强时保留可读原文')
    await React.act(async () => mount())
    await React.act(async () => document.querySelector('img[alt="方案图"]').click())
    assert.equal(document.querySelector('[role="radio"]').getAttribute('aria-checked'), 'false')
    await React.act(async () => document.querySelector('img[alt="方案图"]').dispatchEvent(new dom.window.Event('error')))
    assert.equal(document.querySelector('img[alt="方案图"]'), null)
    assert.match(document.body.textContent, /方案图/u)
    await React.act(async () => document.querySelector('[role="radio"]').click())
    await React.act(async () => mount('two'))
    assert.equal(document.querySelector('[role="radio"]'), null)
    await React.act(async () => mount('one'))
    // 会话切换重新开始当前草稿，但不会把别的会话选项带进来。
    await React.act(async () => document.querySelector('[role="radio"]').click())
    const chosen = document.querySelector('[role="radio"]')
    if (chosen.getAttribute('aria-checked') !== 'true') await React.act(async () => chosen.click())
    await React.act(async () => [...document.querySelectorAll('button')].find(x => x.textContent === '提交').click())
    assert.equal(sent.length, 1)
    assert.match(sent[0], /"selected":\["方案 A \(推荐\)"\]/u)
    await React.act(async () => root.render(React.createElement(rich.component, { text: '![危险](javascript:alert) ![数据](data:image/png;base64,AAAA) ![相对](../secret.png)', t })))
    assert.equal(document.querySelector('img'), null)
    assert.match(document.body.textContent, /危险.*数据.*相对/u)
  } finally {
    await React.act(async () => root.unmount())
    for (const dispose of disposers.reverse()) if (typeof dispose === 'function') dispose()
    hooks.deregister(); dom.window.close()
    for (const [key, descriptor] of Object.entries(old)) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
})
