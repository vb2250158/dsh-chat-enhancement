import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const source = await readFile(new URL('../src/annotations.js', import.meta.url), 'utf8')
const code = source.replace(/^import .*\r?\n/gmu, '').replace(/^export /gmu, '')
const api = vm.runInNewContext(`${code}\n;({ appendAnnotation, annotationEndOffset, captureAnnotationSelection })`, {})

function fixture(input, applied = true) {
  const calls = []
  const scope = { bail(subject, event, request) { assert.equal(subject, scope); calls.push({ event, request }); return applied } }
  const sessions = { list: { getSnapshot: () => ({ current: 'one' }) }, scope: id => id === 'one' ? scope : undefined }
  const conversation = { input: { for: actual => { assert.equal(actual, scope); return { state: { getSnapshot: () => input } } } } }
  return { sessions, conversation, calls }
}

test('appends multiline Unicode quote after atomic chips without replacing draft or submitting', () => {
  const input = { draft: '中文🙂 @long-ref\n@file.ts 末尾', occurrences: [{ length: 9 }, { length: 8 }], phase: 'plain', draftRev: 17, attachmentIds: ['image'] }
  const before = JSON.stringify(input)
  const f = fixture(input)
  assert.equal(api.appendAnnotation(f.sessions, f.conversation, 'one', '原文🙂\n第二段', '意见\n再一行'), null)
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].event, 'slash/input-insert-text')
  assert.equal(f.calls[0].request.span.start, input.draft.length - 8 - 7)
  assert.equal(f.calls[0].request.span.end, f.calls[0].request.span.start)
  assert.equal(f.calls[0].request.span.draftRev, 17)
  assert.equal(f.calls[0].request.text, '\n\n> 原文🙂\n> 第二段\n\n意见\n再一行\n')
  assert.equal(JSON.stringify(input), before)
})

test('empty draft, zero-length chip and ordinary text end offsets use detect coordinates', () => {
  assert.equal(api.annotationEndOffset({ draft: '', occurrences: [] }), 0)
  assert.equal(api.annotationEndOffset({ draft: '🙂\n', occurrences: [{ length: 0 }] }), 4)
  const f = fixture({ draft: '', occurrences: [], phase: 'plain', draftRev: 0 })
  assert.equal(api.appendAnnotation(f.sessions, f.conversation, 'one', '原文', ' 批注 '), null)
  assert.equal(f.calls[0].request.text, '> 原文\n\n批注\n')
})

test('refuses changed sessions, claimed commands, busy submission and stale revision', () => {
  for (const phase of ['claimed', 'adjudicating', 'submitting']) {
    const f = fixture({ phase })
    assert.equal(api.appendAnnotation(f.sessions, f.conversation, 'one', 'q', 'n'), 'unavailable')
    assert.equal(f.calls.length, 0)
  }
  const f = fixture({ draft: '', occurrences: [], phase: 'plain', draftRev: 4 }, undefined)
  assert.equal(api.appendAnnotation(f.sessions, f.conversation, 'two', 'q', 'n'), 'changed')
  assert.equal(f.calls.length, 0)
  const stale = fixture({ draft: '', occurrences: [], phase: 'plain', draftRev: 4 }, false)
  assert.equal(api.appendAnnotation(stale.sessions, stale.conversation, 'one', 'q', 'n'), 'changed')
})

test('selection capture rejects collapsed, multi-range and editor selections', () => {
  assert.equal(api.captureAnnotationSelection(null), null)
  assert.equal(api.captureAnnotationSelection({ isCollapsed: true }), null)
  assert.equal(api.captureAnnotationSelection({ rangeCount: 2 }), null)
  const editable = { nodeType: 1, closest: () => ({}) }
  assert.equal(api.captureAnnotationSelection({ rangeCount: 1, anchorNode: editable, focusNode: editable }), null)
})
