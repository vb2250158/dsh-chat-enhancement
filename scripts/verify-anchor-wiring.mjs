/**
 * Drives the registered `agent/pre-step` handler through the plugin's real
 * settings registration path.
 *
 * `plugin.test.mjs` covers the pure policy helpers. This script covers what
 * those cannot reach: that `registerSettings` wires the handler onto
 * `agent/pre-step`, that the handler reads the live setting on each step, that
 * it asks the profile for the real `createUserMessage`, and that the returned
 * decision carries the anchor where the harness consumes it — spliced into
 * `decision.messages`, the official `agent-instructions` shape, rather than
 * left in the inbox where the *following* step would be the first to see it.
 *
 * Only the settings-registration inject callback is exercised, so the stub
 * scope needs the two services it reads and nothing else. The media tools are
 * unrelated to this path and are not stubbed.
 *
 * Run: node scripts/verify-anchor-wiring.mjs
 *   DSH_SOURCE_ROOT must point at a harness checkout holding
 *   `@deepseek-ai/dsh-llm`, because the handler resolves it from the profile.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok) console.log(`     expected ${JSON.stringify(expected)}\n     actual   ${JSON.stringify(actual)}`)
}

const harnessRoot = [process.env.DSH_SOURCE_ROOT, 'C:\\Data\\CottonProject\\deepseek-harness']
  .find(root => typeof root === 'string' && existsSync(join(root, 'package.json')))
if (harnessRoot === undefined) {
  console.log('skip: set DSH_SOURCE_ROOT to a harness checkout to run this check')
  process.exit(0)
}
process.env.DSH_TEST_DEPENDENCY_ROOT ??= harnessRoot

const settings = { language: 'zh-CN', languageAnchor: 'onDrift', toolDescriptions: true }
const seen = { preStep: [], sections: [], namespaces: [], injects: [] }

// The stub scope: `registerSettings` only reaches for `on`, `settings.register`
// and `systemPrompt.section`. `apply`'s other injects are captured and skipped.
const scope = {
  on(event, handler) { if (event === 'agent/pre-step') seen.preStep.push(handler) },
  settings: {
    register(namespace, schema) {
      seen.namespaces.push(namespace)
      seen.schema = schema
      return { get: () => settings }
    },
  },
  systemPrompt: { section: section => seen.sections.push(section) },
}

const ctx = {
  inject(deps, run) {
    seen.injects.push(deps)
    // Only the settings group drives this path; the media/tool groups need a
    // full Cordis Context and are out of scope for this check.
    if (deps.includes('settings')) run(scope)
  },
  effect() { return () => {} },
  tools: { register() {} },
  fs: { contains: () => true },
}

const { apply } = await import(new URL('../lib/index.js', import.meta.url))
apply(ctx, {})

check('apply requests the settings group', seen.injects.some(deps => deps.includes('settings')), true)
check('apply registers exactly one pre-step handler', seen.preStep.length, 1)
check('apply registers the chat-enhancement settings namespace', seen.namespaces, ['chat-enhancement'])
check('apply registers the model-language prompt section', seen.sections.map(section => section.name), ['private:chat-enhancement-language'])

// The section must read the setting per assembly, not capture it once.
const section = seen.sections[0]
const promptText = section.text()
settings.language = 'en'
check('the prompt section follows the live setting', section.text() !== promptText && section.text().includes('English'), true)
settings.language = 'zh-CN'
check('the prompt section returns to the stored language', section.text(), promptText)

// --- Drive the handler with a real decision. ---------------------------------

const sessionFor = (texts) => {
  const events = texts.map(text => ({
    type: 'assistant/message',
    data: { message: { content: [{ type: 'text', text }] } },
  }))
  return {
    surface: { nodes: events.map((_, index) => index) },
    eventAt: index => events[index],
  }
}

const runStep = async (step, texts) => {
  const baseline = { kind: 'enter', messages: [], startsRequestSeries: true }
  const handler = seen.preStep[0]
  return handler({ agent: { session: sessionFor(texts) }, step, turn: 1, signal: undefined }, async () => baseline)
}

const drifted = await runStep(3, ['好的，先看看。', 'Now let me read the route config and check the allowed roots.'])
const clean = await runStep(3, ['好的，先看看。', '已读取路由配置并核对了允许的根目录。'])

check('a drifted step gains exactly one message', drifted.messages.length, 1)
check('the anchor is plugin-sourced', drifted.messages[0]?.source, { kind: 'plugin', plugin: 'chat-enhancement-language-anchor' })
check('the anchor is written in the target language', drifted.messages[0]?.content?.[0]?.text?.startsWith('继续用简体中文'), true)
check('a clean step gains nothing', clean.messages.length, 0)
check('the decision kind is preserved', drifted.kind, 'enter')
check('startsRequestSeries is preserved', drifted.startsRequestSeries, true)

// A step that already carries an anchor must be replaced, never accumulated:
// one stale anchor plus one fresh anchor is a duplicated rule every step after.
const carried = { kind: 'enter', messages: [drifted.messages[0]], startsRequestSeries: true }
const replaced = await seen.preStep[0]({ agent: { session: sessionFor(['Now let me read it again.']) }, step: 4, turn: 1 }, async () => carried)
check('an existing anchor is replaced, not duplicated', replaced.messages.length, 1)

// A rejected decision must not be rewritten: the step is not going to run.
const rejected = await seen.preStep[0]({ agent: { session: sessionFor(['Now go.']) }, step: 3, turn: 1 }, async () => ({ kind: 'reject' }))
check('a rejected step is passed through untouched', rejected, { kind: 'reject' })

// Every mode, read from the live setting rather than from the argument.
settings.languageAnchor = 'always'
check('always injects on a clean step', (await runStep(3, ['已读取路由配置并核对了允许的根目录。'])).messages.length, 1)
settings.languageAnchor = 'off'
check('off injects nothing even when drifted', (await runStep(3, ['Now let me read the route config.'])).messages.length, 0)
settings.languageAnchor = 'onDrift'
settings.language = 'auto'
check('auto injects nothing', (await runStep(3, ['Now let me read the route config.'])).messages.length, 0)
settings.language = 'zh-CN'
check('step 1 never injects', (await runStep(1, ['Now let me read the route config.'])).messages.length, 0)

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`)
process.exit(failures === 0 ? 0 : 1)
