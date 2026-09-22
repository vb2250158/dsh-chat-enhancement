import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { join, resolve, basename } from 'node:path'
import { apply } from '../lib/index.js'

test('Markdown 服务读取工作区内外文件并保留内容校验', async () => {
  const require = createRequire(join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'profiles/web/package.json'))
  const { Context } = require('@deepseek-ai/cordis')
  const fixture = await mkdtemp(join(tmpdir(), 'dsh-markdown-paths-'))
  const cwd = join(fixture, 'workspace')
  await mkdir(cwd)
  await writeFile(join(cwd, 'inside.md'), '# 工作区内')
  const outside = join(fixture, '工作区外 SKILL.md')
  await writeFile(outside, '# 工作区外')
  await mkdir(join(fixture, 'directory.md'))
  await writeFile(join(fixture, 'invalid.md'), Uint8Array.of(255))
  await writeFile(join(fixture, 'large.md'), 'x'.repeat(65))
  const ctx = new Context()
  for (const key of ['tools', 'fs', 'agents']) ctx.provide(key)
  ctx.set('tools', { register() {} })
  ctx.set('agents', { get(id) { return id === 'missing' ? undefined : { session: { header: { cwd: id === 'without-cwd' ? undefined : cwd } } } } })
  ctx.set('fs', {
    async resolve(path, options) { return { displayPath: resolve(options?.cwd || fixture, path) } },
    async stat(target) { try { const info = await stat(target.displayPath); return { type: info.isFile() ? 'file' : 'directory' } } catch (error) { if (error.code === 'ENOENT') return undefined; throw error } },
    async readBytes(target, signal, maxBytes) { assert.equal(maxBytes, 64); const bytes = await readFile(target.displayPath); if (bytes.length > maxBytes) throw new Error('file exceeds limit'); return bytes },
  })
  const fork = ctx.plugin({ apply(scope) { apply(scope, { maxMarkdownBytes: 64, recoveryAutoResume: false }) } })
  try {
    await fork
    const service = ctx.get('chatMarkdown')
    assert.ok(service)
    for (const path of [outside, '../工作区外 SKILL.md']) assert.deepEqual(await service.read({ sessionId: 'active', path }), { name: basename(outside), text: '# 工作区外' })
    assert.equal((await service.read({ sessionId: 'active', path: 'inside.md' })).text, '# 工作区内')
    assert.equal((await service.read({ sessionId: 'without-cwd', path: outside })).text, '# 工作区外')
    await assert.rejects(service.read({ sessionId: 'without-cwd', path: 'inside.md' }), /相对/)
    await assert.rejects(service.read({ sessionId: 'missing', path: outside }), /未加载/)
    await assert.rejects(service.read({ sessionId: 'active', path: '../missing.md' }), /not found/)
    await assert.rejects(service.read({ sessionId: 'active', path: '../directory.md' }), /regular file/)
    await assert.rejects(service.read({ sessionId: 'active', path: '../invalid.md' }), /UTF-8/)
    await assert.rejects(service.read({ sessionId: 'active', path: '../large.md' }), /limit/)
    await assert.rejects(service.read({ sessionId: 'active', path: '../file.js' }), /only/)
  } finally { await fork.dispose(); await ctx.fiber.dispose(); await rm(fixture, { recursive: true, force: true }) }
})
