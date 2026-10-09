import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'

async function removeFixture(directory) {
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()))
  assert.ok(basename(directory).startsWith('dsh-native-recovery-'))
  await rm(directory, { recursive: true, force: true, maxRetries: 5 })
}

test('正式 SDK profile 保留主子会话身份和已记录输入，拒绝重复恢复', { skip: !process.env.DSH_SOURCE_ROOT, timeout: 120000 }, async () => {
  const root = process.env.DSH_SOURCE_ROOT
  const { DeepSeekHarness } = await import(pathToFileURL(join(root, 'packages/sdk/client/lib/index.js')).href)
  const dir = await mkdtemp(join(tmpdir(), 'dsh-native-recovery-'))
  const fixture = fileURLToPath(new URL('./fixtures/native-recovery-runtime.mjs', import.meta.url))
  const patch = join(dir, 'cordis.patch.yml')
  await writeFile(patch, `- insert:\n    - id: native-recovery-fixture\n      name: ${JSON.stringify(fixture)}\n- id: session-persistence-jsonl\n  name: '@deepseek-ai/dsh-session-persistence-jsonl'\n  config:\n    root: ${JSON.stringify(join(dir, '.dsh/sessions'))}\n    compression: none\n`)
  const harness = new DeepSeekHarness({ profile: 'sdk', patches: [patch], dshHome: join(dir, '.dsh'), processCwd: root, cwd: dir, provider: 'fixture', model: 'fixture', env: { ...process.env, DSH_SOURCE_ROOT: root, DSH_NATIVE_RECOVERY_DIR: dir }, initializeTimeoutMs: 60000 })
  const notifications = harness.client.subscribeSessionTree('native-recovery-root')
  try {
    harness.client.start()
    const loadDeadline = Date.now() + 60000
    let loaded = false
    while (Date.now() < loadDeadline) {
      try { await readFile(join(dir, 'loaded')); loaded = true; break } catch (error) { if (error.code !== 'ENOENT') throw error }
      await delay(20)
    }
    assert.ok(loaded, 'profile did not activate the fixture adapter')
    await harness.start()
    await writeFile(join(dir, 'start'), '')
    const deadline = Date.now() + 60000
    let result
    while (Date.now() < deadline) {
      try { result = JSON.parse(await readFile(join(dir, 'result.json'), 'utf8')); break } catch (error) { if (error.code !== 'ENOENT') throw error }
      await delay(20)
    }
    assert.ok(result, 'native recovery did not settle')
    assert.equal(result.error, undefined)
    assert.equal(result.accepted, true)
    assert.equal(result.duplicate, false)
    assert.equal(result.child, true)
    assert.equal(result.descriptors, 1)
    assert.deepEqual(result.childUserTexts, ['Finish the original child task'])
    assert.deepEqual(result.childTurns, ['interrupted', 'completed'])
    assert.equal(result.root.filter(event => event.type === 'user/message' && event.source === 'user').length, 1)
    const eventTypes = []
    for (let notification; (notification = notifications.tryNext()) !== undefined;) {
      const event = notification.params.event
      if (['turn/start', 'step/start', 'assistant/message', 'step/end', 'turn/end'].includes(event?.type)
        || (event?.type === 'user/message' && ['user', 'agent'].includes(event.data.source.kind))) eventTypes.push(event.type)
    }
    assert.ok(eventTypes.includes('assistant/message'))
    assert.ok(eventTypes.includes('turn/end'))
    const captured = { ...result, sdkEventTypes: eventTypes }
    const expected = new URL('./expected/native-recovery-sdk.json', import.meta.url)
    if (process.env.DSH_SNAPSHOT === 'refresh') await writeFile(expected, JSON.stringify(captured, null, 2) + '\n')
    assert.deepEqual(captured, JSON.parse(await readFile(expected, 'utf8')))
  } catch (error) {
    throw new Error(`${error.message}\n${harness.client.stderrTail?.join('\n') ?? ''}`, { cause: error })
  } finally {
    notifications.close()
    await harness.close()
    await removeFixture(dir)
  }
})

test('Python SDK profile 投影同一恢复过程，保留原输入和父子通知', { skip: !process.env.DSH_SOURCE_ROOT || process.platform !== 'win32', timeout: 120000 }, async () => {
  const root = process.env.DSH_SOURCE_ROOT
  const dir = await mkdtemp(join(tmpdir(), 'dsh-native-recovery-python-'))
  const fixture = fileURLToPath(new URL('./fixtures/native-recovery-runtime.mjs', import.meta.url))
  const patch = join(dir, 'cordis.patch.yml')
  await writeFile(patch, `- insert:\n    - id: native-recovery-fixture\n      name: ${JSON.stringify(fixture)}\n- id: session-persistence-jsonl\n  name: '@deepseek-ai/dsh-session-persistence-jsonl'\n  config:\n    root: ${JSON.stringify(join(dir, '.dsh/sessions'))}\n    compression: none\n`)
  try {
    await promisify(execFile)('python', [fileURLToPath(new URL('./fixtures/native-recovery-python.py', import.meta.url)), root, dir, patch], { env: { ...process.env, DSH_NODE_BIN: process.execPath }, timeout: 110000, windowsHide: true })
    const captured = JSON.parse(await readFile(join(dir, 'python-observed.json'), 'utf8'))
    const expected = new URL('./expected/native-recovery-python.json', import.meta.url)
    if (process.env.DSH_SNAPSHOT === 'refresh') await writeFile(expected, JSON.stringify(captured, null, 2) + '\n')
    assert.deepEqual(captured, JSON.parse(await readFile(expected, 'utf8')))
    assert.deepEqual(captured.root_user_texts, ['Finish the original root task'])
    assert.deepEqual(captured.child_user_texts, ['Finish the original child task'])
  } finally { await removeFixture(dir) }
})
