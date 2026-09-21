import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import vm from 'node:vm'
import test from 'node:test'

test('two activity groups settle after hydration, update new rows, and ignore sidebar changes', { skip: !process.env.DSH_SOURCE_ROOT }, async () => {
  const require = createRequire(resolve(process.env.DSH_SOURCE_ROOT, 'packages/client/ui-primitives/package.json'))
  const { JSDOM } = require('jsdom')
  const dom = new JSDOM('<body><aside></aside><main data-chat-flow><section id="tools"></section><section id="thinking"></section></main></body>')
  const { document, Element, MutationObserver } = dom.window
  for (const id of ['tools', 'thinking']) for (let i = 0; i < 3; i++) {
    const row = document.createElement('div'); row.dataset.key = `${id}-${i}`; row.innerHTML = '<span>activity</span>'; document.getElementById(id).append(row)
  }
  const queue = new Map(), disposers = []; let nextId = 0, scans = 0, entry
  const react = { useRef: current => ({ current }), useEffect: cb => disposers.push(cb()) }
  let bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  bundle = bundle.replace('return { inject, apply, createMediaAutoplayGate, modelForMessage, thinkRowTarget, thinkRowExpanded, expandRunningThinkRow, collapseSettledThinkRow }', 'return { createActivityGroupController }')
  vm.runInNewContext(bundle, { window: { __ModuleLoader__: { load: value => { entry = value } } }, document, Element, MutationObserver, requestAnimationFrame: cb => { queue.set(++nextId, cb); return nextId }, cancelAnimationFrame: id => queue.delete(id) })
  const { createActivityGroupController } = entry.factory(name => name === 'react' ? react : {})
  const settle = async () => { for (let i = 0; i < 8; i++) { const jobs = [...queue.values()]; queue.clear(); jobs.forEach(cb => cb()); await new Promise(resolve => setImmediate(resolve)) } assert.equal(queue.size, 0, 'DOM must stop scheduling itself') }
  try {
    for (const [id, toggleKey] of [['tools', 'dshChatEnhancementToolGroupToggle'], ['thinking', 'dshChatEnhancementThinkingGroupToggle']]) createActivityGroupController({ toggleKey, parentNodes: () => { scans++; return [document.getElementById(id)] }, rowsForParent: parent => [...parent.children], isActivity: () => true, groupKey: rows => rows.map(row => row.dataset.key).join('|'), label: count => `${count} activities` })()
    await settle()
    assert.equal(document.querySelectorAll('button').length, 2)
    assert.equal(document.querySelectorAll('[hidden]').length, 4)
    const before = scans; document.querySelector('aside').textContent = 'unrelated status'; await settle(); assert.equal(scans, before)
    document.querySelector('button').click(); await settle(); assert.equal(document.querySelector('#tools > [hidden]'), null)
    const row = document.createElement('div'); row.dataset.key = 'new'; row.innerHTML = '<span>new activity</span>'; document.getElementById('thinking').append(row); await settle(); assert.match(document.getElementById('thinking').textContent, /3 activities/)
  } finally { disposers.reverse().forEach(dispose => dispose()); dom.window.close() }
})
