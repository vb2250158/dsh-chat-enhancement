import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createGoalMetricsProjection } from '../src/goal-metrics.js'
import { goalDuration, goalActivationSource } from '../src/goal-metrics-client.js'

const require = createRequire(join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'profiles/web/package.json'))
const { z } = require('zod')
const { lastAssistantStreamChunk } = require('@deepseek-ai/dsh-llm')
const projection = createGoalMetricsProjection(z, lastAssistantStreamChunk)
const change = (operation, id = 'a', time = 1000) => ({ type: 'goal/change', time,
  data: { operation, goal: { id, phase: operation === 'complete' ? 'complete' : 'active' }, createdAt: 1000, updatedAt: time } })
const message = (id, turn, step, usage) => ({ type: 'assistant/message', time: 2000,
  data: { turn, step, message: { id }, stream: [], ...(usage ? { usage } : {}) } })
const start = turn => ({ type: 'turn/start', data: { turn }, time: 0 })
const end = (turn, time) => ({ type: 'turn/end', data: { turn, reason: { kind: 'completed' } }, time })
const fold = events => events.reduce((state, event) => projection.stateSchema.parse(projection.apply(state, event)), projection.init())
const usage = { inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40, reasoningTokens: 15 }

test('完整目标跨轮累加，完成仅归属收尾回复，后续对话及新目标保留旧摘要', () => {
  const state = fold([start(0), message('before', 0, 0, usage), change('create'), message('first', 0, 1, usage),
    end(0, 3000), change('edit', 'a', 4000), start(1), message('tools', 1, 0, usage), change('complete', 'a', 5000),
    message('final', 1, 1, { ...usage, totalTokens: 80 }), end(1, 6000), start(2), message('later', 2, 0, usage), end(2, 7000),
    change('clear'), change('create', 'b', 8000)])
  assert.deepEqual(state.completed, { final: { id: 'a', createdAt: 1000, completedAt: 6000, tokens: 280, missing: 0 } })
  assert.equal(state.current.id, 'b')
  assert.equal(state.current.tokens, 0)
})

test('同请求用量替换而非重复累计，失败重试独立计费，流内样本受支持', () => {
  const attempt = { type: 'assistant/attempt', data: { turn: 1, step: 1,
    stream: [{ type: 'chunk', chunk: { type: 'usage', usage } }] } }
  const state = fold([start(1), change('create'), attempt, message('settled', 1, 1, usage),
    { type: 'llm/retry-started', data: { turn: 1, step: 1 } }, attempt])
  assert.equal(state.current.tokens, 200)
  assert.equal(state.current.missing, 0)
})

test('缺失用量标记不完整，后续同请求补齐消除缺失，暂停及受阻不标完成', () => {
  let state = fold([start(1), change('create'), message('unknown', 1, 0), change('pause'), end(1, 3000)])
  assert.equal(state.current.missing, 1)
  assert.deepEqual(state.completed, {})
  state = projection.apply(state, message('known', 1, 0, usage))
  assert.equal(state.current.missing, 0)
  assert.equal(state.current.tokens, 100)
})

test('耗时跨小时、跨天且负值归零', () => {
  assert.equal(goalDuration(61000), '1分1秒')
  assert.equal(goalDuration(3661000), '1小时1分')
  assert.equal(goalDuration(90061000), '25小时1分')
  assert.equal(goalDuration(-1000), '0秒')
})

test('较旧远程读不覆盖实时激活事件，卸载释放监听', async () => {
  let resolveRead, activationListener, disposed = 0
  const observable = { getSnapshot: () => ({ running: false }), subscribe: () => () => { disposed++ } }
  const remote = { goals: { get: () => new Promise(resolve => { resolveRead = resolve }) },
    $on: (_name, listener) => { activationListener = listener; return () => { disposed++ } } }
  const source = goalActivationSource({ session: { ...observable, projections: { faceOf: () => observable } } }, remote, 's', () => () => { disposed++ })
  const unsubscribe = source.subscribe(() => {})
  activationListener({ sessionId: 's', goal: { id: 'a', revision: 2, activation: 'armed' } })
  resolveRead({ ok: true, value: { id: 'a', revision: 1, activation: 'disarmed' } })
  await Promise.resolve()
  assert.equal(source.getSnapshot().revision, 2)
  unsubscribe()
  assert.equal(disposed, 4)
})
