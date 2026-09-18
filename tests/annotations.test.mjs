import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const source = await readFile(new URL('../src/annotations.js', import.meta.url), 'utf8')
const code = source.replace(/^import .*\r?\n/gmu, '').replace(/^export /gmu, '')
// `annotationFile` builds a real `File`, which the bare context has no global
// for; the stub records the parts so the tests can assert the payload.
class FileStub {
  constructor(parts, name, options) { this.parts = parts; this.name = name; this.type = options.type }
}
const api = vm.runInNewContext(`${code}\n;({ appendAnnotation, annotationEndOffset, annotationFileText, annotationFileName, parseAnnotationFile, captureAnnotationSelection })`, { File: FileStub })

function fixture(input, applied = true, withIntake = true) {
  const calls = []
  const added = []
  const scope = { bail(subject, event, request) { assert.equal(subject, scope); calls.push({ event, request }); return applied } }
  const sessions = { list: { getSnapshot: () => ({ current: 'one' }) }, scope: id => id === 'one' ? scope : undefined }
  // `addAttachmentFiles` is the conversation service's supported intake for a
  // file the plugin produced itself.
  const intake = withIntake
    ? { addAttachmentFiles: (sessionId, files) => { assert.equal(sessionId, 'one'); added.push(...files); return files.map((_, index) => `draft-${index}`) } }
    : { attachments: { for: () => ({ add: () => {} }) } }
  const conversation = { input: { for: actual => { assert.equal(actual, scope); return { state: { getSnapshot: () => input } } } }, ...intake }
  return { sessions, conversation, calls, added }
}

test('hands one annotation to the composer as a JSON attachment without touching the draft', () => {
  const input = { draft: '中文🙂 @long-ref\n@file.ts 末尾', occurrences: [{ length: 9 }, { length: 8 }], phase: 'plain', draftRev: 17, attachmentIds: ['image'] }
  const before = JSON.stringify(input)
  const f = fixture(input)
  const target = { msgKey: 'message-one', msgKind: null, seq: null }
  assert.equal(api.appendAnnotation(f.sessions, f.conversation, 'one', { quote: '原文🙂\n第二段', note: '意见\n再一行', target }), null)
  // The draft is never rewritten: the payload travels as an attachment instead
  // of spending chat context as quoted prose.
  assert.equal(f.calls.length, 0)
  assert.equal(JSON.stringify(input), before)
  assert.equal(f.added.length, 1)
  const file = f.added[0]
  // `seq` is null here, so the name falls back to the creation stamp; assert
  // the shape rather than a clock-dependent literal.
  assert.match(file.name, /^批注-\d{4}-\d{2}-\d{2}T[\d-]+Z\.json$/u)
  assert.equal(file.type, 'application/json')
  const payload = JSON.parse(file.parts[0])
  assert.equal(payload.quote, '原文🙂\n第二段')
  assert.equal(payload.note, '意见\n再一行')
  assert.equal(payload.sessionId, 'one')
  assert.deepEqual({ ...payload.target }, target)
})

test('end offsets still resolve from the draft for callers that need them', () => {
  assert.equal(api.annotationEndOffset({ draft: '', occurrences: [] }), 0)
  assert.equal(api.annotationEndOffset({ draft: '🙂\n', occurrences: [{ length: 0 }] }), 4)
})

test('the JSON payload round-trips, and a foreign schema is refused', () => {
  const annotation = { quote: '原文', note: ' 批注 ', target: { msgKey: 'message-one', msgKind: 'assistant', seq: 42 }, sessionId: 'one', createdAt: 1_700_000_000_000 }
  const text = api.annotationFileText(annotation)
  const parsed = api.parseAnnotationFile(text)
  assert.equal(parsed.quote, '原文')
  assert.equal(parsed.note, ' 批注 ')
  assert.deepEqual({ ...parsed.target }, { msgKey: 'message-one', msgKind: 'assistant', seq: 42 })
  assert.equal(parsed.sessionId, 'one')
  assert.equal(parsed.createdAt, 1_700_000_000_000)
  assert.equal(api.annotationFileName(42, 1_700_000_000_000), '批注-0042.json')
  assert.equal(api.parseAnnotationFile('not json'), null)
  assert.equal(api.parseAnnotationFile(JSON.stringify({ schema: 'other', quote: 'a', note: 'b' })), null)
})

test('refuses changed sessions, claimed commands, busy submission and stale revision', () => {
  const annotation = { quote: 'q', note: 'n', target: { msgKey: null, msgKind: null, seq: null } }
  for (const phase of ['claimed', 'adjudicating', 'submitting']) {
    const f = fixture({ phase })
    assert.equal(api.appendAnnotation(f.sessions, f.conversation, 'one', annotation), 'unavailable')
    assert.equal(f.added.length, 0)
  }
  const f = fixture({ draft: '', occurrences: [], phase: 'plain', draftRev: 4 }, undefined)
  assert.equal(api.appendAnnotation(f.sessions, f.conversation, 'two', annotation), 'changed')
  assert.equal(f.added.length, 0)
  // No attachment intake means the payload has nowhere to go; refuse rather
  // than silently dropping the annotation.
  const bare = fixture({ draft: '', occurrences: [], phase: 'plain', draftRev: 4 }, true, false)
  assert.equal(api.appendAnnotation(bare.sessions, bare.conversation, 'one', annotation), 'unavailable')
  assert.equal(bare.added.length, 0)
})

test('selection capture rejects collapsed, multi-range and editor selections', () => {
  assert.equal(api.captureAnnotationSelection(null), null)
  assert.equal(api.captureAnnotationSelection({ isCollapsed: true }), null)
  assert.equal(api.captureAnnotationSelection({ rangeCount: 2 }), null)
  const editable = { nodeType: 1, closest: () => ({}) }
  assert.equal(api.captureAnnotationSelection({ rangeCount: 1, anchorNode: editable, focusNode: editable }), null)
})
