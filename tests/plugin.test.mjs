import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('..', import.meta.url)

test('declares the media bundle, browser previews, and bounded Markdown reader', async () => {
  const manifest = JSON.parse(await readFile(new URL('./package.json', root), 'utf8'))
  const client = await readFile(new URL('./lib/client.js', root), 'utf8')
  const host = await readFile(new URL('./src/index.js', root), 'utf8')

  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.match(client, /'read_image', 'show_image', 'show_video'/)
  assert.match(client, /MarkdownText/)
  assert.match(client, /conversation\.input\.dock/)
  assert.match(client, /readAttachment/)
  assert.doesNotMatch(client, /file:\/\//)
  assert.match(host, /name: 'show_image'/)
  assert.match(host, /name: 'show_video'/)
  assert.match(host, /attachments\.saveImage/)
  assert.match(host, /chatMarkdown/)
  assert.match(host, /ctx\.fs\.contains/)
  assert.match(host, /maxMarkdownBytes/)
  assert.match(host, /required: \['token', 'mediaType', 'name', 'bytes'\]/)
  assert.doesNotMatch(host, /token: \{ type: 'string', required: true \}/)
})

test('show_image stores an attachment and returns only its reference', async () => {
  const { apply } = await import(new URL('./lib/index.js', root))
  const tools = new Map()
  const context = {
    tools: { register(value) { tools.set(value.name, value) } },
    fs: {
      async resolve(filePath, options) {
        assert.ok(filePath === 'image.png' || filePath === 'clip.mp4')
        assert.equal(options.cwd, 'C:/workspace')
        return { displayPath: `C:/workspace/${filePath}` }
      },
      async stat() { return { type: 'file' } },
      async readBytes(_target, _signal, maxBytes) {
        assert.ok(maxBytes === 1024 || maxBytes === 4)
        return Uint8Array.of(1, 2, 3)
      },
    },
    attachments: {
      imageLimits: { maxImageBytes: 1024 },
      async saveImage(input) {
        assert.deepEqual([...input.data], [1, 2, 3])
        return { attachmentId: 'sha256:test', mediaType: input.mediaType, bytes: 3, width: 1, height: 1, name: input.name }
      },
    },
    effect() {},
    inject(services, callback) {
      if (services.includes('attachments')) callback(this)
    },
  }

  apply(context, { maxVideoBytes: 4 })
  const imageTool = tools.get('show_image')
  assert.equal(imageTool.name, 'show_image')
  const value = await imageTool.execute({ file_path: 'image.png' }, { agent: { id: 'session-a', session: { header: { cwd: 'C:/workspace' } } }, signal: new AbortController().signal })
  const [content] = imageTool.output.render({}, value)
  assert.equal(content.type, 'text')
  assert.deepEqual(JSON.parse(content.text), {
    type: 'dsh-chat-enhancement/image',
    path: 'C:/workspace/image.png',
    attachment: { attachmentId: 'sha256:test', mediaType: 'image/png', bytes: 3, width: 1, height: 1, name: 'image.png' },
  })

  const videoTool = tools.get('show_video')
  const video = await videoTool.execute({ file_path: 'clip.mp4' }, { agent: { id: 'session-a', session: { header: { cwd: 'C:/workspace' } } }, signal: new AbortController().signal })
  assert.equal(video.mediaType, 'video/mp4')
  assert.equal(video.bytes, 3)
  assert.match(videoTool.output.render({}, video)[0].text, /dsh-chat-enhancement\/video/)
})
