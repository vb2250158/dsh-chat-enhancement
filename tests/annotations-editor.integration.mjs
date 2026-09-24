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
  const { appendAnnotation } = vm.runInNewContext(source.replace(/^import .*\r?\n/gmu, '').replace(/^export /gmu, '') + '\n;({appendAnnotation})', { File })
  let submissions = 0
  let shell
  const scope = {}
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
    const files = []
    const conversation = {
      input: { for: () => shell },
      addAttachmentFiles(sessionId, generated) {
        assert.equal(sessionId, 'fixture')
        files.push(...generated)
        const ids = generated.map((_, index) => `annotation-${index}`)
        assert.equal(shell.addAttachments(ids), true)
        return ids
      },
    }
    assert.equal(appendAnnotation(sessions, conversation, 'fixture', {
      quote: '选文🙂\n第二段', note: '第一行意见\n第二行意见',
      target: { msgKey: 'fixture:assistant:42', msgKind: 'assistant', seq: 42 },
    }), null)
    assert.equal(shell.snapshot.draft, before.draft)
    assert.deepEqual(shell.snapshot.occurrences, before.occurrences)
    assert.deepEqual(shell.snapshot.attachmentIds, [...before.attachmentIds, 'annotation-0'])
    assert.equal(files[0].name, '批注-0042.json')
    assert.equal(JSON.parse(await files[0].text()).note, '第一行意见\n第二行意见')
    assert.equal(submissions, 0)
    console.log('PASS: real editor accepts a JSON annotation attachment and preserves text and reference identity without submitting.')
  } finally {
    shell.dispose()
  }
} finally {
  hooks.deregister()
}
