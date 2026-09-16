/** Opt-in integration with the installed DSH editor; no browser rendering is asserted. */
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'

if (!process.env.DSH_SOURCE_ROOT) throw new Error('Set DSH_SOURCE_ROOT to a built DSH checkout.')
// The editor imports visual primitives transitively; CSS has no role in editor transactions.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) return { url: new URL(specifier, context.parentURL).href, shortCircuit: true }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }
    return nextLoad(url, context)
  },
})
try {
  const { SessionInputShell } = await import(pathToFileURL(resolve(process.env.DSH_SOURCE_ROOT, 'packages/client/ui-conversation/lib/types/client/input/facade.js')).href)
  const source = await readFile(new URL('../src/annotations.js', import.meta.url), 'utf8')
  const { appendAnnotation } = vm.runInNewContext(source.replace(/^import .*\r?\n/gmu, '').replace(/^export /gmu, '') + '\n;({appendAnnotation})')
  let submissions = 0
  let shell
  const scope = { bail(subject, event, request) {
    assert.equal(subject, scope)
    assert.equal(event, 'slash/input-insert-text')
    return shell.insertText(request.text, request.span) ? true : undefined
  } }
  shell = new SessionInputShell({
    actx: scope,
    defaultSink: async () => { submissions++; return { kind: 'success' } },
    commandAttachments: { serialize: async () => [], release() {}, unsupportedNotice: () => 'unsupported' },
  })
  try {
    shell.setDraft('中文🙂 @ref')
    const reference = '@[Research notes](dsh-session:InNvdXJjZSI)'
    assert.equal(shell.insertReference({ source: 'reference', ref: reference, label: 'Research notes', clipboardText: reference }, { start: 5, end: 9, draftRev: shell.snapshot.draftRev }), true)
    assert.equal(shell.addAttachments(['fixture-attachment']), true)
    const before = shell.snapshot
    assert.equal(before.occurrences.length, 1)
    const sessions = { list: { getSnapshot: () => ({ current: 'fixture' }) }, scope: () => scope }
    const conversation = { input: { for: () => shell } }
    assert.equal(appendAnnotation(sessions, conversation, 'fixture', '选文🙂\n第二段', '第一行意见\n第二行意见'), null)
    assert.equal(shell.snapshot.draft, `${before.draft}\n\n> 选文🙂\n> 第二段\n\n第一行意见\n第二行意见\n`)
    assert.deepEqual(shell.snapshot.occurrences, before.occurrences)
    assert.deepEqual(shell.snapshot.attachmentIds, before.attachmentIds)
    assert.equal(submissions, 0)
    console.log('PASS: real editor appends a Unicode annotation and preserves reference identity and attachments without submitting.')
  } finally {
    shell.dispose()
  }
} finally {
  hooks.deregister()
}
