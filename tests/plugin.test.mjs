import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const root = new URL('..', import.meta.url)

test('generated preview preserves native image priority over text media markers', async () => {
  const bundle = await readFile(new URL('./lib/client.js', root), 'utf8')
  let entry
  vm.runInNewContext(bundle.replace('return { inject, apply, createMediaAutoplayGate, modelForMessage }', 'return { previewFromBlock }'), {
    window: { __ModuleLoader__: { load(value) { entry = value } } },
  })
  const { previewFromBlock } = entry.factory(() => ({}))
  const attachment = { id: 'fixture-image' }
  for (const type of ['audio', 'video']) {
    const result = previewFromBlock({ kind: 'result', content: [
      { type: 'text', text: JSON.stringify({ type: `dsh-chat-enhancement/${type}`, token: 'fixture-token', mediaType: `${type}/fixture`, name: 'fixture' }) },
      { type: 'image', attachment },
    ] })
    assert.equal(result.kind, 'image')
    assert.equal(result.attachment, attachment)
    assert.equal(result.path, null)
  }
})

async function loadBrowserPlugin() {
  const client = await readFile(new URL('./lib/client.js', root), 'utf8')
  let loaderEntry
  vm.runInNewContext(client, {
    window: { __ModuleLoader__: { load(entry) { loaderEntry = entry } } },
  })
  return loaderEntry.factory((name) => {
    if (name === 'react') return { createElement() {}, useState() { return [false, () => {}] }, useEffect() {} }
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return { MarkdownText() {}, Button() {}, Menu() {}, IconChevronDownOutline14() {} }
    throw new Error(`unexpected browser dependency: ${name}`)
  })
}

/** 加载 bundle 并暴露纯逻辑辅助函数，供不依赖 DOM 的单元测试直接调用。 */
async function loadBrowserHelpers() {
  const client = await readFile(new URL('./lib/client.js', root), 'utf8')
  let loaderEntry
  vm.runInNewContext(client, {
    window: { __ModuleLoader__: { load(entry) { loaderEntry = entry } } },
  })
  return loaderEntry.factory((name) => {
    if (name === 'react') return { createElement() {}, useState() { return [false, () => {}] }, useEffect() {} }
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return { MarkdownText() {}, Button() {}, Menu() {}, IconChevronDownOutline14() {} }
    throw new Error(`unexpected browser dependency: ${name}`)
  })
}

test('declares the media bundle, browser previews, and bounded Markdown reader', async () => {
  const manifest = JSON.parse(await readFile(new URL('./package.json', root), 'utf8'))
  const client = await readFile(new URL('./lib/client.js', root), 'utf8')
  // 归一化换行：断言里写的是 LF，而 checkout 可能是 CRLF（core.autocrlf）。
  const host = (await readFile(new URL('./src/index.js', root), 'utf8')).replace(/\r\n/gu, '\n')
  const typertHost = await readFile(new URL('./src/typert.host.js', root), 'utf8')

  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings'))
  assert.equal(manifest.exports['./typert'], './lib/typert.host.js')
  assert.doesNotMatch(client, /\['read_image', 'show_image', 'show_video', 'show_audio'\]/)
  assert.match(client, /show_image.*show_video.*show_audio/s)
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
  // 本插件只占一个设置导航项：id `chat-enhancement`，标签「对话增强」。
  assert.match(client, /id: 'chat-enhancement', order: 65, label: \(\) => '对话增强'/)
  assert.match(client, /ChatEnhancementSettingsSection/)
  assert.match(client, /LanguagePicker/)
  assert.match(client, /onSelect: \(id\) => \{ setOpen\(false\); void chatSettings\.set\('language', id\) \}/)
  // 原生 <select> 的弹层由系统绘制，`--dsw-*` 令牌管不到它，所以必须走 Menu 原语。
  assert.doesNotMatch(client, /createElement\('select'/)
  assert.doesNotMatch(client, /languageSelectStyle/)
  assert.match(client, /const \{ MarkdownText, Button, Menu, IconChevronDownOutline14 \} = require\('@deepseek-ai\/dsh-client-ui-primitives'\)/)
  assert.match(client, /variant: 'outline'/)
  assert.match(client, /aria-haspopup': 'menu'/)
  assert.match(client, /audioAutoplay/)
  assert.match(client, /videoAutoplay/)
  assert.match(client, /toolDescriptions/)
  assert.match(client, /显示模型自述的本次调用说明/)
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
  assert.match(host, /settingsCtx\.settings\.register\(CHAT_ENHANCEMENT_SETTINGS_NAMESPACE/)
  assert.match(host, /audioAutoplay: z\.boolean\(\)\.default\(false\)/)
  assert.match(host, /videoAutoplay: z\.boolean\(\)\.default\(false\)/)
  assert.match(host, /language: z\.string\(\)\.default\(AUTO_LANGUAGE\)/)
  assert.match(host, /import \{ AUTO_LANGUAGE, languageInstruction \} from '\.\/languages\.js'/)
  // 语言分区必须读求值函数而不是常量，否则改设置要重启才生效。
  assert.match(host, /name: 'private:chat-enhancement-language'/)
  assert.match(host, /text: \(\) => languageInstruction\(settings\.get\(\)\.language\)/)
  // 分区必须排在提示词末尾附近：language 是与满屏英文指令和英文工具输出竞争的输出规则，
  // 排在 25–30 那段部署指令里时实测被模型忽略。
  assert.match(host, /const LANGUAGE_SECTION_ORDER = (\d+)/)
  assert.ok(Number(/const LANGUAGE_SECTION_ORDER = (\d+)/.exec(host)[1]) > 9000)
  // 语言名只写在 languages.js；Host 入口不得再抄一份。
  assert.doesNotMatch(host, /Simplified Chinese/)
  assert.doesNotMatch(host, /## Language Preference/)
  // 工具行自述：模型侧靠装配期注入属性，显示侧靠 patches/ 里的官方补丁。
  assert.match(host, /toolDescriptions: z\.boolean\(\)\.default\(true\)/)
  assert.match(host, /settingsCtx\.on\('system-prompt\/assemble'/)
  assert.match(host, /return describeTools\(assembly, toolDescriptionHint\(current\.language\)\)/)
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
  const plugin = await loadBrowserPlugin()
  const registrations = []
  const context = {
    effect(callback) { callback() },
    locale: { register(namespace, dictionaries) { assert.equal(namespace, 'chat-enhancement-annotations'); assert.ok(dictionaries.en); return () => {} } },
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
  const autoplayController = registrations.find(({ options }) => options.id === 'chat-enhancement-media-autoplay-session')
  assert.equal(autoplayController.options.name, 'conversation.input.dock')
  assert.equal(autoplayController.component.name, 'MediaAutoplaySessionController')
  const groupController = registrations.find(({ options }) => options.id === 'chat-enhancement-tool-groups')
  assert.equal(groupController.options.name, 'conversation.input.dock')
  assert.equal(groupController.component.name, 'ToolCallGroupController')
  const thinkingController = registrations.find(({ options }) => options.id === 'chat-enhancement-thinking-groups')
  assert.equal(thinkingController.options.name, 'conversation.input.dock')
  assert.equal(thinkingController.component.name, 'ThinkingGroupController')
  const audioView = registrations.find(({ options }) => options.key === 'show_audio')
  assert.equal(audioView.options.name, 'tool.call.toolview')
  // 本插件在设置菜单里只注册一个分区：全部偏好都装在「对话增强」里面。
  const sections = registrations.filter(({ options }) => options.name === 'settings.section')
  assert.equal(sections.length, 1)
  assert.equal(sections[0].options.id, 'chat-enhancement')
  assert.equal(sections[0].options.label(), '对话增强')
  assert.equal(sections[0].component.name, 'ChatEnhancementSettingsSection')
})

test('autoplay gate ignores restored history and only accepts a newly settled Agent display', async () => {
  const { createMediaAutoplayGate } = await loadBrowserPlugin()
  const gate = createMediaAutoplayGate()

  assert.equal(gate.observe('historical-audio', 100, true, false), false)
  assert.equal(gate.observe('historical-video', 200, true, true), false)

  gate.markReady(1_000)

  assert.equal(gate.observe('historical-audio', 100, true, true), false)
  assert.equal(gate.observe('late-hydrated-history', 999, true, true), false)
  assert.equal(gate.observe('new-audio-after-turn', 1_001, true, false), false)
  assert.equal(gate.observe('new-audio-after-turn', 1_001, true, true), false)
  assert.equal(gate.observe('new-video-while-agent-runs', 1_002, true, true), true)
  assert.equal(gate.observe('new-video-while-agent-runs', 1_002, true, true), false)
  assert.equal(gate.observe('autoplay-disabled', 1_003, false, true), false)
})

test('turn model badge reads the assistant node requestConfig by message id', async () => {
  const { modelForMessage } = await loadBrowserHelpers()
  const nodes = [
    { kind: 'user', messageId: 'm-user' },
    { kind: 'assistant', messageId: 'm-1', requestConfig: { provider: 'codex', model: 'gpt-6-astra', reasoningEffort: 'medium' } },
    { kind: 'assistant', messageId: 'm-2', requestConfig: { provider: 'deepseek', model: 'deepseek-v4' } },
    { kind: 'assistant' },
  ]
  // vm 跨 realm 的对象原型不同，逐字段断言而不是 deepEqual。
  const second = modelForMessage(nodes, 'm-2')
  assert.equal(second.model, 'deepseek-v4')
  assert.equal(second.provider, 'deepseek')
  const first = modelForMessage(nodes, 'm-1')
  assert.equal(first.model, 'gpt-6-astra')
  assert.equal(first.provider, 'codex')
  assert.equal(first.reasoningEffort, 'medium')
  // 无 requestConfig 的节点、缺失的 messageId、非数组输入都退回 null，而不是抛错或渲染空壳。
  assert.equal(modelForMessage(nodes, 'm-user'), null)
  assert.equal(modelForMessage(nodes, 'missing'), null)
  assert.equal(modelForMessage(undefined, 'm-1'), null)
  assert.equal(modelForMessage([null, 42], 'm-1'), null)
})

test('every assembled tool schema advertises the optional description property', async () => {
  const { describeTools } = await import(new URL('./lib/index.js', root))
  const hint = '一句话说明本次调用要做什么'
  const assembly = {
    sections: [{ name: 'a', text: 'x' }],
    contexts: [],
    variables: { v: '1' },
    tools: [
      { name: 'edit', description: 'Edit a file', parameters: { type: 'object', required: ['file_path'], properties: { file_path: { type: 'string' } } } },
      { name: 'bash', description: 'Run a command', parameters: { type: 'object', properties: { command: { type: 'string' }, description: { type: 'string' } } } },
      { name: 'weird', description: 'No parameters', parameters: null },
    ],
  }
  const next = describeTools(assembly, hint)
  const edit = next.tools.find(tool => tool.name === 'edit')
  // 属性必须排在最前：客户端对未知工具的摘要回退是按位置取「第一个字符串参数」。
  assert.deepEqual(Object.keys(edit.parameters.properties), ['description', 'file_path'])
  assert.deepEqual(edit.parameters.properties.description, { type: 'string', description: hint })
  // 原有参数与 required 不受影响。
  assert.deepEqual(edit.parameters.required, ['file_path'])
  // 自己声明了 description 的工具保持原对象（bash 的措辞比通用提示具体）。
  assert.equal(next.tools.find(tool => tool.name === 'bash'), assembly.tools[1])
  // 参数不是对象就跳过，不能抛。
  assert.equal(next.tools.find(tool => tool.name === 'weird'), assembly.tools[2])
  // 其它字段原样带过，且不修改传入的装配对象。
  assert.deepEqual(next.sections, assembly.sections)
  assert.deepEqual(next.variables, assembly.variables)
  assert.equal(Object.hasOwn(assembly.tools[0].parameters.properties, 'description'), false)
})

test('describeTools returns the identical assembly when nothing needs adding', async () => {
  const { describeTools } = await import(new URL('./lib/index.js', root))
  const declared = { sections: [], contexts: [], variables: {}, tools: [{ name: 'bash', parameters: { properties: { description: { type: 'string' } } } }] }
  assert.equal(describeTools(declared, 'hint'), declared)
  const empty = { sections: [], contexts: [], variables: {}, tools: [] }
  assert.equal(describeTools(empty, 'hint'), empty)
})

test('turn model badge declares its slot registration and stays read-only', async () => {
  const client = await readFile(new URL('./lib/client.js', root), 'utf8')
  assert.match(client, /conversation\.chat\.assistant-actions/)
  assert.match(client, /chat-enhancement-turn-model/)
  assert.match(client, /TurnModelBadge/)
  // 徽章不得注册进 chain 槽位：chain 是单选选举，会顶掉 ui-deliverables。
  assert.doesNotMatch(client, /name: 'conversation\.chat\.turnTail'/)
  assert.match(client, /useTrajectory/)
  assert.match(client, /--dsw-alias-label-tertiary/)
})

test('the language catalog is the single source for both bundle halves', async () => {
  const { LANGUAGES, AUTO_LANGUAGE, languageEntry, languageInstruction } = await import(new URL('./src/languages.js', root))
  const client = await readFile(new URL('./lib/client.js', root), 'utf8')
  const host = (await readFile(new URL('./src/index.js', root), 'utf8')).replace(/\r\n/gu, '\n')

  assert.equal(AUTO_LANGUAGE, 'auto')
  assert.equal(LANGUAGES[0].id, AUTO_LANGUAGE)
  assert.equal(new Set(LANGUAGES.map(language => language.id)).size, LANGUAGES.length)
  assert.ok(LANGUAGES.length >= 20)
  // 浏览器下拉和 Host 指令来自同一份目录：目录只声明一次，且每个选项文案都进了产物。
  assert.equal(client.match(/const LANGUAGES = \[/gu)?.length, 1)
  for (const language of LANGUAGES) {
    assert.ok(client.includes(language.label), `the bundle is missing the ${language.id} option`)
  }
  assert.match(client, /## Language Preference/)
})

test('only a concrete language contributes a prompt section', async () => {
  const { LANGUAGES, AUTO_LANGUAGE, languageEntry, languageInstruction } = await import(new URL('./src/languages.js', root))

  // 「跟随对话」和本版本不认识的 id 都必须返回空文本：renderPrompt 会丢弃零长度分区，
  // 未配置该偏好的部署因此装配出与升级前完全相同的系统提示。
  assert.equal(languageInstruction(AUTO_LANGUAGE), '')
  assert.equal(languageInstruction('kl-GL'), '')
  assert.equal(languageInstruction(undefined), '')
  assert.equal(languageEntry('kl-GL').id, AUTO_LANGUAGE)
  assert.equal(languageEntry(undefined).id, AUTO_LANGUAGE)
  assert.equal(languageEntry('ja').label, '日本語')

  // 每个可选语言都必须自带母语祈使句：英文写的「请用中文思考」会被模型忽略，
  // 因此 native 缺一条就等于那个语言选了没用。
  for (const language of LANGUAGES.slice(1)) {
    assert.equal(typeof language.name, 'string', `${language.id} has no prompt name`)
    assert.equal(typeof language.native, 'string', `${language.id} has no native imperative`)
    assert.ok(language.native.length > 0, `${language.id} has an empty native imperative`)
  }

  const chinese = languageInstruction('zh-CN')
  // 母语那一句必须排在最前，指令本身就已经是目标语言。
  assert.ok(chinese.startsWith('## Language Preference\n始终用简体中文思考和回复。'), chinese)
  assert.ok(chinese.indexOf('始终用简体中文思考和回复。') < chinese.indexOf('Your reasoning'))
  // 语言名以「英文名 + 母语写法」出现，模型才知道要产出哪一种。
  assert.match(chinese, /Simplified Chinese \(简体中文\)/)
  // 明确点名 reasoning，并堵掉「上下文全是英文所以我用英文想」这条退路。
  assert.match(chinese, /Your reasoning and every user-visible reply must be in Simplified Chinese/)
  assert.match(chinese, /Do not fall back to English for thinking/)
  assert.match(chinese, /Never translate code, identifiers, file paths, shell commands, log output, error text, or quoted text/)
  assert.notEqual(languageInstruction('en'), languageInstruction('ja'))
  assert.match(languageInstruction('ja'), /常に日本語で考え、日本語で回答してください。/)
  assert.match(languageInstruction('ar'), /Arabic \(العربية\)/)
  assert.match(languageInstruction('ar'), /فكّر وأجب دائمًا بالعربية\./)
})
