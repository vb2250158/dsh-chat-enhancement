/** 运维 CLI：调用网页同一恢复批次；凭据仅在内存用于本机同源认证。 */
import { readFileSync } from 'node:fs'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'

/** 等待异步检查结束；recover 只确认一次，共享批次负责去重。 */
export async function runRecovery(read, { action, targets, timeoutMs = 600000, now = Date.now, wait = delay }) {
  if (!['check', 'recover', 'recover-quota'].includes(action)) throw new Error('命令必须为 check、recover 或 recover-quota')
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('超时必须为正整数毫秒')
  const deadline = now() + timeoutMs
  const poll = async state => {
    while (['idle', 'checking', 'recovering'].includes(state.phase)) {
      const remaining = deadline - now()
      if (remaining <= 0) throw new Error('恢复检查超时；可重新运行 check 查看原批次')
      await wait(Math.min(state.pollIntervalMs, remaining))
      state = await read({ action: 'check' })
    }
    return state
  }
  let state = await poll(await read({ action: 'check' }))
  if (action === 'recover' && ['ready', 'failed'].includes(state.phase)) {
    state = await poll(await read({ action: 'recover', batchId: state.batchId }))
  }
  if (action === 'recover-quota') state = await poll(await read({ action, batchId: state.batchId, targets }))
  return state
}

/** 仅向显式指定的本机 HTTP(S) 地址提交同源请求，不打印认证内容。 */
export function localRecoveryReader({ baseUrl, dshHome, requestTimeoutMs = 30000 }) {
  const url = new URL(baseUrl)
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('--base-url 必须为本机 DSH 的 HTTP(S) 根地址')
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs <= 0) throw new Error('请求超时必须为正整数毫秒')
  const require = createRequire(join(dshHome, 'profiles', 'web', 'package.json'))
  const { parse } = require('yaml')
  return async request => {
    const records = parse(readFileSync(join(dshHome, '.credentials.yaml'), 'utf8')).records
    const secret = records?.['client-connection/browser-session']?.payload?.secret
    if (typeof secret !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(secret)) throw new Error('缺少本机浏览器会话凭据')
    const issuedAt = Date.now()
    const body = Buffer.from(JSON.stringify({ version: 1, authority: url.host, issuedAt, expiresAt: issuedAt + requestTimeoutMs + 60000 })).toString('base64url')
    const name = 'dsh-auth-' + createHash('sha256').update(url.host).digest('base64url')
    const signature = createHmac('sha256', Buffer.from(secret, 'base64url')).update(body).digest('base64url')
    const method = 'chatRecovery/read'
    const response = await fetch(new URL('/api/' + method, url), {
      method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json', Origin: url.origin, Cookie: `${name}=v1.${body}.${signature}` },
      body: JSON.stringify({ type: 'client-request', rpcId: randomUUID(), method, payload: { args: { request } } }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    })
    if (!response.ok) throw new Error(`恢复接口 HTTP ${response.status}`)
    const envelope = await response.json()
    if (!envelope.result?.ok) throw new Error('恢复接口拒绝请求；检查插件版本及 Host 状态')
    const state = envelope.result.value
    if (!state || typeof state.batchId !== 'string' || !['idle', 'checking', 'ready', 'recovering', 'done', 'failed', 'dismissed'].includes(state.phase) || !Number.isSafeInteger(state.pollIntervalMs) || state.pollIntervalMs <= 0) throw new Error('恢复接口返回无效状态')
    return state
  }
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { targets: { type: 'string' }, 'base-url': { type: 'string' }, 'dsh-home': { type: 'string' }, 'timeout-ms': { type: 'string' }, 'request-timeout-ms': { type: 'string' } } })
  if (positionals.length !== 1 || !values['base-url']) throw new Error('用法：node recover-sessions.mjs <check|recover|recover-quota> --base-url <本机 DSH URL> [--targets <JSON 文件>] [--dsh-home <Home>] [--timeout-ms <毫秒>]')
  const read = localRecoveryReader({ baseUrl: values['base-url'], dshHome: resolve(values['dsh-home'] || process.env.DSH_HOME || join(homedir(), '.dsh')), requestTimeoutMs: Number(values['request-timeout-ms'] || 30000) })
  const targets = values.targets ? JSON.parse(readFileSync(resolve(values.targets), 'utf8').replace(/^\uFEFF/u, '')) : undefined
  const state = await runRecovery(read, { action: positionals[0], targets, timeoutMs: Number(values['timeout-ms'] || 600000) })
  console.log(JSON.stringify(state))
  if (state.phase === 'failed') process.exitCode = 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
