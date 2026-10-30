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
    document: { createElement: () => ({ remove() {} }), head: { appendChild() {} } },
  })
  return loaderEntry.factory((name) => {
    if (name === '@deepseek-ai/dsh-client-ui-goal') return {}
    if (name === 'react') return { createElement() {}, useState() { return [false, () => {}] }, useEffect() {} }
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return { MarkdownText() {}, Button() {}, Menu() {}, IconChevronDownOutlineRegular() {} }
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
    if (name === '@deepseek-ai/dsh-client-ui-goal') return {}
    if (name === 'react') return { createElement() {}, useState() { return [false, () => {}] }, useEffect() {} }
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return { MarkdownText() {}, Button() {}, Menu() {}, IconChevronDownOutlineRegular() {} }
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
  assert.doesNotMatch(client, /展示图片 ·/)
  assert.doesNotMatch(client, /attachment\.width\} ×/)
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
  assert.match(client, /configForms/)
  assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-plugin-manager'))
  assert.match(client, /ChatEnhancementSettingsSection/)
  // 语言与漂移提醒两行都走同一个枚举选择器；断言到驱动它的 field，
  // 而不是组件名——组件是内部实现，重命名不该让这条契约失败。
  assert.match(client, /SettingPicker/)
  assert.match(client, /field: 'language'/)
  assert.match(client, /field: 'languageAnchor'/)
  assert.match(client, /onSelect: \(id\) => \{ setOpen\(false\); void chatSettings\.set\(field, id\) \}/)
  // 原生 <select> 的弹层由系统绘制，`--dsw-*` 令牌管不到它，所以必须走 Menu 原语。
  assert.doesNotMatch(client, /createElement\('select'/)
  assert.doesNotMatch(client, /languageSelectStyle/)
  assert.match(client, /const \{ CodeBlock, MarkdownText, Modal, Pill, IconGaugeOutlineRegular, Button, Menu, MenuItemButton, IconSparkleRegular, IconChevronDownOutlineRegular, StateDot, Tooltip, Switch \} = require\('@deepseek-ai\/dsh-client-ui-primitives'\)/)
  assert.match(client, /variant: 'outline'/)
  assert.match(client, /aria-haspopup': 'menu'/)
  assert.match(client, /audioAutoplay/)
  assert.match(client, /videoAutoplay/)
  assert.match(client, /toolDescriptions/)
  assert.match(client, /显示模型自述的本次调用说明/)
  assert.doesNotMatch(client, /chat-enhancement-(?:tool-groups|thinking-groups|reasoning-auto-expand)/)
  assert.doesNotMatch(client, /expandReasoningWhileRunning|reasoningCollapseDelayMs|createActivityGroupController/)
  assert.match(client, /readAttachment/)
  assert.doesNotMatch(client, /file:\/\//)
  assert.match(host, /name: 'show_image'/)
  assert.match(host, /name: 'show_video'/)
  assert.match(host, /name: 'show_audio'/)
  assert.match(host, /attachments\.saveImage/)
  assert.match(host, /chatMarkdown/)
  assert.doesNotMatch(host, /ctx\.fs\.contains/)
  assert.match(host, /maxMarkdownBytes/)
  assert.match(host, /settingsCtx\.settings\.configure/)
  assert.match(host, /audioAutoplay: z\.boolean\(\)\.default\(false\)/)
  assert.match(host, /videoAutoplay: z\.boolean\(\)\.default\(false\)/)
  assert.match(host, /language: z\.string\(\)\.default\(AUTO_LANGUAGE\)/)
  // 只断言语言目录是唯一来源与两个必需符号，不锁死 import 列表——
  // 新增符号（如 languageAnchor）不该让每个消费者测试跟着改。
  assert.match(host, /import \{([^}]*)\} from '\.\/languages\.js'/u)
  {
    const imported = /import \{([^}]*)\} from '\.\/languages\.js'/u.exec(host)[1]
      .split(',')
      .map(symbol => symbol.trim())
    assert.ok(imported.includes('AUTO_LANGUAGE'))
    assert.ok(imported.includes('languageInstruction'))
  }
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
  assert.doesNotMatch(host, /expandReasoningWhileRunning|reasoningCollapseDelayMs/)
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
    on() { return () => {} },
    agents: { list: () => [] },
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

test('describeTools preserves rc.3 prompt presentation without executor-owned schemas', async () => {
  const { describeTools } = await import(new URL('./lib/index.js', root))
  const presentation = { sections: [], contexts: [], variables: {} }
  assert.equal(describeTools(presentation, 'hint'), presentation)
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

test('language anchors fire only when the reply language has actually drifted', async () => {
  const { cjkRatio, shouldAnchorLanguage } = await import(new URL('./lib/index.js', root))
  // 阈值判定的是「汉字在全部字母/汉字里占多少」——代码标识符越多，汉字回复的
  // 比例就越低，所以中文样例的期望值必须按含代码密度分档，不能一律取高值。
  assert.ok(cjkRatio('现在读取计划详情与相关源码。') > 0.9)
  // 含路径的短句：汉字约 7 字、拉丁字母约 27 个，比例落在 0.2 附近。
  assert.ok(cjkRatio('已修复 packages/core/agent/src/agent.ts 里的问题。') > 0.15)
  // 漂移的英文回复实测 0.00–0.03。
  assert.ok(cjkRatio('Now let me check the route config for allowedFileRoots...') < 0.05)
  // 没有字母也没有汉字（纯数字、标点、emoji）不构成漂移证据。
  assert.equal(cjkRatio('12345 ... 🙂🙂'), undefined)
  assert.equal(cjkRatio(''), undefined)

  // off：任何步骤都不注入。
  assert.equal(shouldAnchorLanguage('off', 5, 'all english here'), false)
  // always：第一步之后每步都注入。
  assert.equal(shouldAnchorLanguage('always', 2, '全部中文的一段回复。'), true)
  // 第一步没有可判断的产物，即便 always 也不注入。
  assert.equal(shouldAnchorLanguage('always', 1, ''), false)
  assert.equal(shouldAnchorLanguage('onDrift', 1, 'all english here'), false)
  // onDrift：中文正常不注入，漂移才注入。
  assert.equal(shouldAnchorLanguage('onDrift', 3, '已读取配置并核对路径。'), false)
  assert.equal(shouldAnchorLanguage('onDrift', 3, 'Now let me check the route config...'), true)
  // 无法判断（无字母汉字）时不注入，避免把纯代码片段误判成漂移。
  assert.equal(shouldAnchorLanguage('onDrift', 3, '12345 🙂'), false)
  // 没有历史（首轮工具步骤）同样不注入。
  assert.equal(shouldAnchorLanguage('onDrift', 3, undefined), false)
})

test('the latest assistant text is read from the session surface, skipping empty steps', async () => {
  const { latestAssistantText } = await import(new URL('./lib/index.js', root))
  const text = value => ({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: value }] } } })
  const toolOnly = { type: 'assistant/message', data: { message: { content: [{ type: 'tool-call', name: 'read' }] } } }
  const session = nodes => ({
    surface: { nodes: [...nodes.keys()] },
    eventAt: index => [...nodes.values()][index],
  })
  // 最新一条是纯工具调用时，继续往前找模型最后说过的内容，
  // 而不是把它当成「空回复」判成漂移。
  assert.equal(latestAssistantText(session([{ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '已读取配置。' }] } } }, toolOnly])), '已读取配置。')
  // 多文本块按顺序拼接。
  const multi = { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '第一段' }, { type: 'text', text: '第二段' }] } } }
  assert.equal(latestAssistantText(session([multi, toolOnly])), '第一段\n第二段')
  // 会话里还没有助手输出。
  assert.equal(latestAssistantText(session([{ type: 'user/message', data: { message: { content: [{ type: 'text', text: 'hi' }] } } }])), undefined)
  assert.equal(latestAssistantText(session([])), undefined)
  // 形态异常不得抛：宿主插件跑在真实会话上，宁可放弃判断。
  assert.equal(latestAssistantText({}), undefined)
  assert.equal(latestAssistantText(session([{ type: 'assistant/message', data: { message: { content: null } } }])), undefined)
  assert.equal(latestAssistantText(session([text('   ')])), undefined)
})

test('anchors are identified by their plugin source, not by content', async () => {
  const { isLanguageAnchor } = await import(new URL('./lib/index.js', root))
  assert.equal(isLanguageAnchor({ source: { kind: 'plugin:chat-enhancement-language-anchor' } }), true)
  // 普通用户消息、别的插件、以及我们自己别的注入都不算锚点。
  assert.equal(isLanguageAnchor({ source: { kind: 'user' } }), false)
  assert.equal(isLanguageAnchor({ source: { kind: 'plugin:other' } }), false)
  assert.equal(isLanguageAnchor({ source: { kind: 'agent-instructions' } }), false)
  assert.equal(isLanguageAnchor({}), false)
  assert.equal(isLanguageAnchor(null), false)
  assert.equal(isLanguageAnchor(undefined), false)
})

test('every language that constrains output also carries a native anchor', async () => {
  const { languageAnchor, languageInstruction, LANGUAGES } = await import(new URL('../src/languages.js', import.meta.url))
  const configured = LANGUAGES.filter(entry => entry.native !== null)
  assert.ok(configured.length > 10, '目录里应有多语言条目')
  for (const entry of configured) {
    const anchor = languageAnchor(entry.id)
    // 锚点必须非空（缺专用文案时回退到目录里的母语祈使句），
    // 否则漂移时注入不了任何东西。
    assert.notEqual(anchor, '', `${entry.id} 缺少锚点文案`)
    // 锚点进消息历史，必须比系统提示那条短得多。
    assert.ok(anchor.length <= 120, `${entry.id} 的锚点过长：${anchor.length}`)
  }
  // auto 不约束语言，也没有锚点。
  assert.equal(languageAnchor('auto'), '')
  assert.equal(languageInstruction('auto'), '')
  // 未知 id 走 auto 语义。
  assert.equal(languageAnchor('nope'), '')
})
