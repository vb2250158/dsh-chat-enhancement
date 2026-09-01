import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const root = new URL('..', import.meta.url)

test('declares the media bundle, browser previews, and bounded Markdown reader', async () => {
  const manifest = JSON.parse(await readFile(new URL('./package.json', root), 'utf8'))
  const client = await readFile(new URL('./lib/client.js', root), 'utf8')
  const host = await readFile(new URL('./src/index.js', root), 'utf8')
  const typertHost = await readFile(new URL('./src/typert.host.js', root), 'utf8')

  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings'))
  assert.equal(manifest.exports['./typert'], './lib/typert.host.js')
  assert.match(client, /read_image.*show_image.*show_video.*show_audio/s)
  assert.match(client, /React\.createElement\('audio'/)
  assert.match(client, /ImagePreviewDialog/)
  assert.match(client, /data-dsh-image-preview/)
  assert.match(client, /download: current\.name/)
  assert.match(client, /关闭图片预览/)
  assert.match(client, /aria-label': '上一张'/)
  assert.match(client, /aria-label': '下一张'/)
  assert.match(client, /imageFloatingStyle/)
  assert.match(client, /floatingHeightRatio/)
  assert.match(client, /调整悬浮预览高度/)
  assert.match(client, /Math\.min\(0\.78, Math\.max\(0\.2/)
  assert.match(client, /height: 'calc\(100% - 18px\)'/)
  assert.match(client, /controlsVisible/)
  assert.match(client, /隐藏图片预览控件/)
  assert.match(client, /Math\.abs\(distance\) > 50/)
  assert.match(client, /切换为悬浮预览/)
  assert.match(client, /followingLatest/)
  assert.match(client, /imageGallery\(sessionId\)\.at\(-1\)/)
  assert.match(client, /settingsScope/)
  assert.match(client, /chat-enhancement-media/)
  assert.match(client, /audioAutoplay/)
  assert.match(client, /videoAutoplay/)
  assert.match(client, /MarkdownText/)
  assert.match(client, /conversation\.input\.dock/)
  assert.match(client, /ToolCallGroupController/)
  assert.match(client, /chatFlowKind/)
  assert.match(client, /isGroupedActivity/)
  assert.match(client, /kind === 'context'/)
  assert.match(client, /已执行 \$\{count\} 项操作/)
  assert.match(client, /--dsw-alias-label-secondary/)
  assert.match(client, /ThinkingGroupController/)
  assert.match(client, /data-chat-flow-key/)
  assert.match(client, /think:\$\{index\}/)
  assert.match(client, /已完成 \$\{count\} 项思考/)
  assert.match(client, /parentNodes: \(\) => document\.querySelectorAll\('\[data-chat-flow-key\]'\)/)
  assert.match(client, /inlineTrailingActivity/)
  assert.match(client, /isDisplayToolRow/)
  assert.match(client, /data-dsh-chat-enhancement/)
  assert.match(client, /row\.insertBefore\(button, content\)/)
  assert.match(client, /MutationObserver/)
  assert.doesNotMatch(client, /key: 'tool-call', priority: -1/)
  assert.match(client, /readAttachment/)
  assert.doesNotMatch(client, /file:\/\//)
  assert.match(host, /name: 'show_image'/)
  assert.match(host, /name: 'show_video'/)
  assert.match(host, /name: 'show_audio'/)
  assert.match(host, /attachments\.saveImage/)
  assert.match(host, /chatMarkdown/)
  assert.match(host, /ctx\.fs\.contains/)
  assert.match(host, /maxMarkdownBytes/)
  assert.match(host, /settingsCtx\.settings\.register\(MEDIA_SETTINGS_NAMESPACE/)
  assert.match(host, /audioAutoplay: z\.boolean\(\)\.default\(false\)/)
  assert.match(host, /videoAutoplay: z\.boolean\(\)\.default\(false\)/)
  assert.ok(host.indexOf('const ChatMediaService = createMediaService') < host.indexOf("ctx.inject(['agents']"))
  assert.ok(host.indexOf('const ChatMarkdownService = createMarkdownService') < host.indexOf("ctx.inject(['agents']"))
  assert.match(host, /ctx\.inject\(\['agents'\], \(\) => \{\n    new ChatMediaService\(ctx\)\n    new ChatMarkdownService\(ctx\)/)
  assert.match(host, /required: \['token', 'mediaType', 'name', 'bytes'\]/)
  assert.doesNotMatch(host, /token: \{ type: 'string', required: true \}/)
  assert.match(typertHost, /chatMedia/)
  assert.match(typertHost, /chatMarkdown/)
  assert.match(typertHost, /typeSymbol: requestSymbol/)
})

test('show_image writes its managed attachment into the session tool result', async () => {
  const { apply } = await import(new URL('./lib/index.js', root))
  const tools = new Map()
  const context = {
    tools: { register(value) { tools.set(value.name, value) } },
    fs: {
      async resolve(filePath, options) {
        assert.ok(filePath === 'image.png' || filePath === 'clip.mp4' || filePath === 'track.mp3')
        assert.equal(options.cwd, 'C:/workspace')
        return { displayPath: `C:/workspace/${filePath}` }
      },
      async stat() { return { type: 'file' } },
      async readBytes(_target, _signal, maxBytes) {
        assert.ok(maxBytes === 1024 || maxBytes === 4 || maxBytes === 5)
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

  apply(context, { maxAudioBytes: 5, maxVideoBytes: 4 })
  const imageTool = tools.get('show_image')
  assert.equal(imageTool.name, 'show_image')
  assert.deepEqual(imageTool.parameters, {
    type: 'object',
    additionalProperties: false,
    required: ['file_path'],
    properties: { file_path: { type: 'string', description: 'Image path, resolved relative to the current session workspace.' } },
  })
  const value = await imageTool.execute({ file_path: 'image.png' }, { agent: { id: 'session-a', session: { header: { cwd: 'C:/workspace' } } }, signal: new AbortController().signal })
  const [marker, image] = imageTool.output.render({}, value)
  assert.equal(marker.type, 'text')
  assert.deepEqual(JSON.parse(marker.text), {
    type: 'dsh-chat-enhancement/image',
    path: 'C:/workspace/image.png',
    attachment: { attachmentId: 'sha256:test', mediaType: 'image/png', bytes: 3, width: 1, height: 1, name: 'image.png' },
  })
  assert.deepEqual(image, {
    type: 'image',
    attachment: { attachmentId: 'sha256:test', mediaType: 'image/png', bytes: 3, width: 1, height: 1, name: 'image.png' },
  })

  const videoTool = tools.get('show_video')
  assert.deepEqual(videoTool.parameters, {
    type: 'object',
    additionalProperties: false,
    required: ['file_path'],
    properties: { file_path: { type: 'string', description: 'Video path, resolved relative to the current session workspace.' } },
  })
  const video = await videoTool.execute({ file_path: 'clip.mp4' }, { agent: { id: 'session-a', session: { header: { cwd: 'C:/workspace' } } }, signal: new AbortController().signal })
  assert.equal(video.mediaType, 'video/mp4')
  assert.equal(video.bytes, 3)
  assert.match(videoTool.output.render({}, video)[0].text, /dsh-chat-enhancement\/video/)

  const audioTool = tools.get('show_audio')
  assert.deepEqual(audioTool.parameters, {
    type: 'object',
    additionalProperties: false,
    required: ['file_path'],
    properties: { file_path: { type: 'string', description: 'Audio path, resolved relative to the current session workspace.' } },
  })
  const audio = await audioTool.execute({ file_path: 'track.mp3' }, { agent: { id: 'session-a', session: { header: { cwd: 'C:/workspace' } } }, signal: new AbortController().signal })
  assert.equal(audio.mediaType, 'audio/mpeg')
  assert.equal(audio.bytes, 3)
  assert.deepEqual(JSON.parse(audioTool.output.render({}, audio)[0].text), {
    type: 'dsh-chat-enhancement/audio',
    token: audio.token,
    mediaType: 'audio/mpeg',
    name: 'track.mp3',
    bytes: 3,
  })
})

test('client groups original tool and context rows without replacing the tool-call node', async () => {
  const client = await readFile(new URL('./lib/client.js', root), 'utf8')
  let loaderEntry
  vm.runInNewContext(client, {
    window: { __ModuleLoader__: { load(entry) { loaderEntry = entry } } },
  })
  const plugin = loaderEntry.factory((name) => {
    if (name === 'react') return { createElement() {}, useState() { return [false, () => {}] }, useEffect() {} }
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return { MarkdownText() {} }
    throw new Error(`unexpected browser dependency: ${name}`)
  })
  const registrations = []
  const context = {
    remote: { async $mount() { return () => {} } },
    get(name) { return name === 'sessions' ? { binding() {} } : undefined },
    reflect: { get(name) {
      if (name === 'remote.chatMedia') return { async read() { return { ok: true, value: {} } } }
      if (name === 'remote.chatMarkdown') return { async read() { return { ok: true, value: {} } } }
      return undefined
    } },
    slots: {
      inject(_name, callback) { callback() },
      register(options, component) { registrations.push({ options, component }); return () => {} },
    },
    settingsScope: {
      bind(spec) {
        assert.equal(spec.namespace, 'chat-enhancement')
        return {
          getSnapshot() { return { status: 'ready', value: { audioAutoplay: false, videoAutoplay: false }, writable: true } },
          subscribe() { return () => {} },
          async set() {},
        }
      },
    },
  }

  await plugin.apply(context)
  assert.ok(plugin.inject.includes('settingsScope'))
  assert.equal(registrations.some(({ options }) => options.name === 'conversation.chat.node'), false)
  const groupController = registrations.find(({ options }) => options.id === 'chat-enhancement-tool-groups')
  assert.equal(groupController.options.name, 'conversation.input.dock')
  assert.equal(groupController.component.name, 'ToolCallGroupController')
  const thinkingController = registrations.find(({ options }) => options.id === 'chat-enhancement-thinking-groups')
  assert.equal(thinkingController.options.name, 'conversation.input.dock')
  assert.equal(thinkingController.component.name, 'ThinkingGroupController')
  const audioView = registrations.find(({ options }) => options.key === 'show_audio')
  assert.equal(audioView.options.name, 'tool.call.toolview')
  const mediaSettings = registrations.find(({ options }) => options.id === 'chat-enhancement-media')
  assert.equal(mediaSettings.options.name, 'settings.section')
  assert.equal(mediaSettings.options.label(), '媒体播放')
  assert.equal(mediaSettings.component.name, 'MediaSettingsSection')
})
