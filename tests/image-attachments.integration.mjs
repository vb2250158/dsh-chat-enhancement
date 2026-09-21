/** 使用已构建的官方包验证真实保存和读取；DSH_SOURCE_ROOT 指向宿主源码。 */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire, registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

const root = process.env.DSH_SOURCE_ROOT
assert.ok(root, '需要 DSH_SOURCE_ROOT 指向已构建的宿主源码')
const packageRoot = resolve(root, 'packages/attachment/attachment-local')
const require = createRequire(join(packageRoot, 'package.json'))
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@deepseek-ai/dsh-attachment-local') {
    return { url: pathToFileURL(join(packageRoot, 'lib/index.js')).href, shortCircuit: true }
  }
  return next(specifier, context)
} })
const { default: Store } = await import('../src/image-attachments.js')
const { default: OriginalStore } = await import('@deepseek-ai/dsh-attachment-local')
const { Context } = require('@deepseek-ai/cordis')
const sharp = require('sharp')

test('Cordis 通过插件生命周期注册附件服务并保留配置', async () => {
  const ctx = new Context()
  const fork = ctx.plugin(Store, { maxImageBytes: 12345 })
  await fork
  assert.equal(ctx.attachments.imageLimits.maxImageBytes, 12345)
  await fork.dispose()
  assert.equal(ctx.attachments, undefined)
})

test('错误扩展名图片经真实上传准入保存，历史读回正常', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-image-type-'))
  const ctx = new Context()
  try {
    const store = new Store(ctx, { dshHome: home })
    for (const format of ['jpeg', 'png', 'webp', 'gif']) {
      const data = await sharp({ create: { width: 8, height: 6, channels: 3, background: '#123456' } }).toFormat(format).toBuffer()
      const [part] = await store.admitPromptContent([{ type: 'image', mediaType: format === 'png' ? 'image/jpeg' : 'image/png', data: data.toString('base64'), name: 'QQ图片.png' }])
      assert.equal(part.type, 'image')
      assert.equal(part.attachment.name, 'QQ图片.png')
      const saved = await store.readImage(part.attachment)
      assert.equal((await sharp(saved.data).metadata()).width, 8)
      await store.validateImage({ data, mediaType: 'image/png' })
      await store.saveImage({ data, mediaType: 'image/png' })
    }
    const file = await store.saveFile({ data: Buffer.from('普通文件'), name: 'note.txt' })
    const chunks = []
    for await (const chunk of store.readFileStream(file)) chunks.push(chunk)
    assert.equal(Buffer.concat(chunks).toString(), '普通文件')
    const before = await readdir(home, { recursive: true })
    const valid = await sharp({ create: { width: 9, height: 7, channels: 3, background: '#654321' } }).jpeg().toBuffer()
    await assert.rejects(store.saveImages([
      { data: valid, mediaType: 'image/png' },
      { data: Buffer.from([255, 216, 255]), mediaType: 'image/png' },
    ]))
    assert.deepEqual(await readdir(home, { recursive: true }), before)
    await assert.rejects(store.saveImages(Array.from({ length: 21 }, () => ({ data: Buffer.from([255, 216, 255]), mediaType: 'image/png' }))), { code: 'TOO_MANY_IMAGES' })
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('继承配置的图片大小和像素限制仍然生效', async () => {
  const data = await sharp({ create: { width: 8, height: 6, channels: 3, background: '#123456' } }).jpeg().toBuffer()
  assert.equal(Store.Config, OriginalStore.Config)
  for (const config of [{ maxImageBytes: 1 }, { maxImagePixels: 1 }, { maxImageDimension: 1 }, { maxMessageImageBytes: 1 }]) {
    const home = await mkdtemp(join(tmpdir(), 'dsh-image-limit-'))
    try {
      const store = new Store(new Context(), { dshHome: home, ...config })
      await assert.rejects(store.saveImages([{ data, mediaType: 'image/png' }]))
      assert.deepEqual(await readdir(home), [])
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  }
})

test('实际附件可用同一准入路径识别和保存', { skip: !process.env.DSH_IMAGE_SAMPLE }, async () => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-image-sample-'))
  const ctx = new Context()
  try {
    const store = new Store(ctx, { dshHome: home })
    const data = await readFile(process.env.DSH_IMAGE_SAMPLE)
    const original = new OriginalStore(new Context(), { dshHome: home })
    await assert.rejects(original.validateImage({ data, mediaType: 'image/png' }), { code: 'IMAGE_TYPE_MISMATCH' })
    const [part] = await store.admitPromptContent([{ type: 'image', mediaType: 'image/png', data: data.toString('base64'), name: 'sample.png' }])
    const saved = await store.readImage(part.attachment)
    assert.equal((await sharp(saved.data).metadata()).width, 2360)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})
