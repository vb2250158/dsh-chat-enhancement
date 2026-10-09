/** 通过正式 SDK profile 验证原会话恢复；只替换模型响应。 */
import { writeFileSync } from 'node:fs'
import { writeFile, access } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const load = path => import(pathToFileURL(join(process.env.DSH_SOURCE_ROOT, path)).href)
const { LlmAdapter, createUserMessage, createSystemMessage } = await load('packages/llm/llm/lib/index.js')
const { SessionId, SessionSeq } = await load('packages/core/session/lib/index.js')
const { SUBAGENT_DESCRIPTOR_VERSION } = await load('packages/subagent/subagent/lib/index.js')
export const inject = ['llm']

/** @param ctx - 正式 profile 提供的宿主服务。 */
export function apply(ctx) {
  const base = process.env.DSH_NATIVE_RECOVERY_DIR
  const abort = new AbortController()
  const responses = ['ROOT_CONTINUED', 'CHILD_CONTINUED', 'CHILD_RESULT_RECEIVED']
  const requests = []
  class RecordedAdapter extends LlmAdapter {
    async resolveModel(provider, model) { return { provider, id: model, name: model, contextWindow: 128000 } }
    async *stream(options) {
      requests.push(options.messages.filter(message => message.role === 'user' && ['user', 'agent'].includes(message.source.kind)).flatMap(message => message.content.filter(block => block.type === 'text').map(block => block.text)))
      const text = responses.shift()
      if (!text) throw new Error('Unexpected recovery model request')
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text }
      yield { type: 'block-end', index: 0, block: { type: 'text', text } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  ctx.effect(() => ctx.llm.registerAdapter(['fixture'], new RecordedAdapter()))
  writeFileSync(join(base, 'loaded'), 'ready')
  ctx.inject(['agents', 'agentLoop', 'sessions', 'sessionPersistence', 'subagents'], ctx => {
  const seed = async (id, text, meta = {}) => {
    const session = ctx.sessions.prepare(id, { meta: { cwd: base, ...meta } })
    const handle = await ctx.sessionPersistence.create(session.header)
    const events = [
      { type: 'turn/start', data: { turn: 1 } },
      ...(meta.origin ? [{ type: 'subagent/descriptor', data: { version: SUBAGENT_DESCRIPTOR_VERSION, provider: 'spawn', mode: 'continuable', label: 'original child', agentProvider: 'fixture', agentModel: 'fixture' } }] : []),
      { type: 'step/start', data: { turn: 1, step: 1 } },
      { type: 'system/message', surfaceOp: 'append', data: { turn: 1, step: 1, message: createSystemMessage('') } },
      { type: 'user/message', surfaceOp: 'append', data: createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }) },
      { type: 'step/end', data: { turn: 1, step: 1 } },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'interrupted' } } },
    ]
    try { await handle.append(events.map((event, index) => ({ ...event, seq: SessionSeq(index), time: index + 1 }))) }
    finally { await handle.close() }
  }
  const transcript = session => session.snapshotEvents().flatMap(event => {
    if (event.type === 'user/message' && ['user', 'agent'].includes(event.data.source.kind)) return [{ type: event.type, source: event.data.source.kind, text: event.data.content.filter(block => block.type === 'text').map(block => block.text).join('') }]
    if (event.type === 'assistant/message') return [{ type: event.type, text: event.data.message.content.filter(block => block.type === 'text').map(block => block.text).join('') }]
    if (event.type === 'turn/end') return [{ type: event.type, turn: event.data.turn, reason: event.data.reason.kind }]
    return []
  })
  const run = async () => {
    while (true) {
      abort.signal.throwIfAborted()
      try { await access(join(base, 'start')); break } catch (error) { if (error.code !== 'ENOENT') throw error }
      await delay(20, undefined, { signal: abort.signal })
    }
    const rootId = SessionId('native-recovery-root'), childId = SessionId('native-recovery-child')
    await seed(rootId, 'Finish the original root task')
    const root = await ctx.agents.resume({ resumeSessionId: rootId, agentOptions: { provider: 'fixture', model: 'fixture' } })
    try {
      const accepted = root.agent.continueInterrupted(0)
      const duplicate = root.agent.continueInterrupted(0)
      await root.agent.whenIdle()
      await seed(childId, 'Finish the original child task', { origin: 'subagent', parentSession: rootId, delegationDepth: 1 })
      const child = await ctx.subagents.continueInterrupted(root.agent, childId, 0, abort.signal)
      while (ctx.agents.get(childId)) await delay(20, undefined, { signal: abort.signal })
      await root.agent.whenIdle()
      const stored = await ctx.sessionPersistence.open(childId, 'read')
      let childEvents
      try { childEvents = (await stored.read()).events } finally { await stored.close() }
      const result = { accepted, duplicate, child, requests, root: transcript(root.agent.session), childTurns: childEvents.filter(event => event.type === 'turn/end').map(event => event.data.reason.kind), childUserTexts: childEvents.filter(event => event.type === 'user/message' && event.data.source.kind === 'user').map(event => event.data.content[0].text), descriptors: childEvents.filter(event => event.type === 'subagent/descriptor').length }
      await writeFile(join(base, 'result.json'), JSON.stringify(result))
    } finally { await root.dispose() }
  }
  ctx.effect(() => {
    const work = run().catch(async error => { if (!abort.signal.aborted) await writeFile(join(base, 'result.json'), JSON.stringify({ error: error.stack })) })
    return async () => { abort.abort(); await work }
  })
  })
}
