import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import vm from 'node:vm'
import test from 'node:test'

// A caller supplies a development dependency root; no machine paths ship in the plugin.
const dependencyRoot = process.env.DSH_TEST_DEPENDENCY_ROOT

test('DOM selection, saved quote, IME, cancellation, retry and session isolation', { skip: !dependencyRoot }, async () => {
  const require = createRequire(pathToFileURL(resolve(dependencyRoot, 'package.json')))
  const { JSDOM } = require('jsdom')
  const React = require('react')
  const dom = new JSDOM('<body><div data-chat-flow><p data-chat-flow-key="message-one">选中原文🙂</p><textarea>编辑区</textarea></div><div id="app"></div></body>', { pretendToBeVisual: true })
  const previous = Object.fromEntries(['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  const { createRoot } = require('react-dom/client')
  const { document, Event, MouseEvent, KeyboardEvent } = dom.window
  const act = React.act
  const context = { React, Button: ({ variant, ...props }) => React.createElement('button', props), window: dom.window, document }
  const source = (await readFile(new URL('../src/annotations.js', import.meta.url), 'utf8')).replace(/^import .*\r?\n/gmu, '').replace(/^export /gmu, '')
  const { AnnotationController, captureAnnotationSelection } = vm.runInNewContext(`${source}\n;({AnnotationController,captureAnnotationSelection})`, context)
  const root = createRoot(document.getElementById('app'))
  let current = 'one'
  let failure = null
  const calls = []
  const props = { sessionId: 'one', useSessions: selector => selector({ current }), t: key => key, append: (...args) => { calls.push(args); return failure } }
  const render = () => act(() => root.render(React.createElement(AnnotationController, props)))
  const flow = document.querySelector('[data-chat-flow]')
  flow.getClientRects = () => [{}]
  const selection = dom.window.getSelection()
  const select = () => act(() => {
    const range = document.createRange()
    range.selectNodeContents(document.querySelector('p'))
    range.getBoundingClientRect = () => ({ left: 20, bottom: 30 })
    selection.removeAllRanges(); selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  const click = element => act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  const type = text => act(() => {
    const input = document.querySelector('[data-dsh-annotation] textarea')
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  try {
    render(); select()
    assert.equal(document.querySelector('[data-dsh-annotation]').getAttribute('role'), 'toolbar')
    click(document.querySelector('[data-dsh-annotation] button'))
    assert.equal(document.activeElement.tagName, 'TEXTAREA')
    assert.equal(document.querySelector('[data-dsh-annotation-source]').textContent, 'message-one')
    act(() => { selection.removeAllRanges(); document.dispatchEvent(new Event('selectionchange')) })
    assert.equal(document.querySelector('blockquote').textContent, '选中原文🙂')
    type('我的批注\n下一行')
    const textarea = document.querySelector('[data-dsh-annotation] textarea')
    act(() => textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true, bubbles: true })))
    assert.equal(calls.length, 0)
    failure = 'changed'
    click(document.querySelector('[data-dsh-annotation] button:last-child'))
    assert.equal(calls.length, 1)
    assert.ok(document.querySelector('[role="alert"]'))
    assert.equal(textarea.value, '我的批注\n下一行')
    failure = null
    click(document.querySelector('[data-dsh-annotation] button:last-child'))
    assert.equal(calls.length, 2)
    assert.deepEqual([...calls[1]], ['one', 'message-one\n\n选中原文🙂', '我的批注\n下一行'])
    assert.equal(document.querySelector('[data-dsh-annotation]'), null)
    select(); click(document.querySelector('[data-dsh-annotation] button'))
    act(() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    assert.equal(document.querySelector('[data-dsh-annotation]'), null)
    select(); click(document.querySelector('[data-dsh-annotation] button'))
    type('discard on outside click')
    const panel = document.querySelector('[data-dsh-annotation]')
    act(() => panel.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })))
    assert.equal(document.querySelector('[data-dsh-annotation]'), panel)
    const blank = document.createElement('div')
    blank.addEventListener('pointerdown', event => event.stopPropagation())
    document.body.append(blank)
    act(() => blank.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })))
    assert.equal(document.querySelector('[data-dsh-annotation]') === null, true, 'outside pointerdown must dismiss the editing panel even when bubbling is stopped')
    act(() => blank.dispatchEvent(new MouseEvent('pointerup', { bubbles: true })))
    act(() => document.dispatchEvent(new Event('selectionchange')))
    assert.equal(document.querySelector('[data-dsh-annotation]'), null, 'the old browser selection must not reopen the launcher')
    assert.equal(calls.length, 2)
    select(); current = 'two'; render()
    assert.equal(document.querySelector('[data-dsh-annotation]'), null)
    assert.equal(calls.length, 2)
    current = 'one'; render()
    const markdown = document.createElement('div')
    markdown.setAttribute('data-dsh-chat-enhancement-markdown', '')
    markdown.setAttribute('aria-label', 'notes.md')
    const article = document.createElement('article')
    article.textContent = '文档正文'
    markdown.append(article)
    markdown.getClientRects = () => [{}]
    document.body.append(markdown)
    let previewClicks = 0
    markdown.addEventListener('click', () => previewClicks++)
    act(() => {
      const range = document.createRange(); range.selectNodeContents(markdown.querySelector('article'))
      range.getBoundingClientRect = () => ({ left: 50, bottom: 60 })
      selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new Event('selectionchange'))
    })
    click(document.querySelector('[data-dsh-annotation] button'))
    type('文件意见')
    click(document.querySelector('[data-dsh-annotation] button:last-child'))
    assert.equal(calls[2][1], 'notes.md\n\n文档正文')
    assert.equal(previewClicks, 0)
    assert.ok(markdown.isConnected)
    const second = document.createElement('p')
    second.setAttribute('data-chat-flow-key', 'message-two')
    second.textContent = '下一条消息'
    flow.insertBefore(second, flow.querySelector('textarea'))
    const crossRange = document.createRange()
    crossRange.setStart(document.querySelector('p').firstChild, 0)
    crossRange.setEnd(second.firstChild, second.textContent.length)
    crossRange.getBoundingClientRect = () => ({ left: 10, bottom: 20 })
    selection.removeAllRanges(); selection.addRange(crossRange)
    assert.equal(captureAnnotationSelection(selection).source, null)
    assert.equal(captureAnnotationSelection({ rangeCount: 1, anchorNode: document.querySelector('textarea'), focusNode: document.querySelector('textarea') }), null)
  } finally {
    act(() => root.unmount()); dom.window.close()
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
  }
})
