/** Host entry for the chat-enhancement DSH bundle. */

import { randomUUID } from 'node:crypto'
import { basename, extname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { createGoalMetricsProjection } from './goal-metrics.js'
import {
  AUTO_LANGUAGE,
  DEFAULT_ANCHOR_MODE,
  LANGUAGE_ANCHOR_MODES,
  languageAnchor,
  languageAnchorMode,
  languageInstruction,
} from './languages.js'

const IMAGE_MEDIA_TYPES = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const VIDEO_MEDIA_TYPES = { '.mp4': 'video/mp4', '.webm': 'video/webm' }
const AUDIO_MEDIA_TYPES = {
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
}
const DEFAULT_MAX_AUDIO_BYTES = 50 * 1024 * 1024
const DEFAULT_MAX_VIDEO_BYTES = 50 * 1024 * 1024
const DEFAULT_MAX_MARKDOWN_BYTES = 2 * 1024 * 1024
const CHAT_ENHANCEMENT_SETTINGS_NAMESPACE = 'chat-enhancement'
/**
 * Prompt-section order: deliberately near the END of the assembled prompt
 * (`DELIVERABLE_FILE_REFERENCES` 9000, `STRUCTURED_OUTPUT` 9900), not with the
 * deployment instructions at 25–30 where it started life.
 *
 * Measured 2026-09-16: at order 30 the section was ignored and the model kept
 * reasoning in English. Language is an output-shaping rule competing with a
 * prompt whose every other line — and the whole tool transcript — is English,
 * so it has to be among the last things read. The harness places its own
 * persona suffix last (10200) for the same reason.
 *
 * Moved past the remaining English tail (`STRUCTURED_OUTPUT` 9900,
 * `HARNESS_SOURCE` 10000, `WEB_SURFACE` 10100, `DEPLOYMENT_PERSONA_SUFFIX`
 * 10200) so nothing but the persona suffix follows it. This is a no-op for a
 * single step — 2026-09-18 A/B measured no difference — but it is free, and on
 * a long context the section is no longer read before ~1.9k characters of
 * English. The drift that survives both placements is what the anchor below
 * addresses.
 */
const LANGUAGE_SECTION_ORDER = 10300

/**
 * Below this CJK share, the last assistant reply counts as drifted.
 *
 * Measured on a real `zh-CN` session: ordinary Chinese replies land at 0.4–0.9
 * (identifiers, paths and commands are legitimately Latin, so a fully Chinese
 * answer is nowhere near 1.0), while a drifted English reply measures 0.00–0.03.
 * The gap is wide, so the exact cut is not delicate.
 */
const DRIFT_THRESHOLD = 0.2

const imageMediaTypeFor = (filePath) => IMAGE_MEDIA_TYPES[extname(filePath).toLowerCase()]
const audioMediaTypeFor = (filePath) => AUDIO_MEDIA_TYPES[extname(filePath).toLowerCase()]
const videoMediaTypeFor = (filePath) => VIDEO_MEDIA_TYPES[extname(filePath).toLowerCase()]
const isMarkdownPath = (filePath) => ['.md', '.markdown'].includes(extname(filePath).toLowerCase())

function resolveConfig(config = {}) {
  const maxAudioBytes = config.maxAudioBytes ?? DEFAULT_MAX_AUDIO_BYTES
  if (!Number.isSafeInteger(maxAudioBytes) || maxAudioBytes < 1) throw new TypeError('maxAudioBytes must be a positive safe integer.')
  const maxVideoBytes = config.maxVideoBytes ?? DEFAULT_MAX_VIDEO_BYTES
  if (!Number.isSafeInteger(maxVideoBytes) || maxVideoBytes < 1) throw new TypeError('maxVideoBytes must be a positive safe integer.')
  const maxMarkdownBytes = config.maxMarkdownBytes ?? DEFAULT_MAX_MARKDOWN_BYTES
  if (!Number.isSafeInteger(maxMarkdownBytes) || maxMarkdownBytes < 1) throw new TypeError('maxMarkdownBytes must be a positive safe integer.')
  return { maxAudioBytes, maxVideoBytes, maxMarkdownBytes }
}

const imagePreviewMarker = (value) => JSON.stringify({ type: 'dsh-chat-enhancement/image', path: value.path, attachment: value.image })
const mediaPreviewMarker = (kind, value) => JSON.stringify({ type: `dsh-chat-enhancement/${kind}`, token: value.token, mediaType: value.mediaType, name: value.name, bytes: value.bytes })

function imageOutputSchema() {
  return { type: 'object', additionalProperties: false, required: ['path', 'image'], properties: {
    path: { type: 'string' },
    image: { type: 'object', additionalProperties: false, required: ['attachmentId', 'mediaType', 'bytes', 'width', 'height'], properties: {
      attachmentId: { type: 'string' }, mediaType: { type: 'string' }, bytes: { type: 'integer' },
      width: { type: 'integer' }, height: { type: 'integer' }, name: { type: 'string' },
    } },
  } }
}

function mediaOutputSchema() {
  return { type: 'object', additionalProperties: false, required: ['token', 'mediaType', 'name', 'bytes'], properties: {
    token: { type: 'string' }, mediaType: { type: 'string' }, name: { type: 'string' }, bytes: { type: 'integer' },
  } }
}

function filePathParameters(description) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['file_path'],
    properties: { file_path: { type: 'string', description } },
  }
}

async function resolveRegularTarget(ctx, args, exec) {
  const target = await ctx.fs.resolve(args.file_path, {
    ...(exec.agent?.session.header.cwd === undefined ? {} : { cwd: exec.agent.session.header.cwd }),
    signal: exec.signal,
  })
  const info = await ctx.fs.stat(target, exec.signal)
  if (info === undefined) throw new Error(`cannot show "${target.displayPath}": file not found`)
  if (info.type !== 'file') throw new Error(`cannot show "${target.displayPath}": not a regular file`)
  return target
}

/** Ephemeral per-session audio and video bytes, addressed only by opaque tool-result tokens. */
class MediaStore {
  #entries = new Map()

  constructor(maxAudioBytes, maxVideoBytes) {
    this.maxAudioBytes = maxAudioBytes
    this.maxVideoBytes = maxVideoBytes
  }

  async #add(ctx, args, exec, definition) {
    const mediaType = definition.mediaTypeFor(args.file_path)
    if (mediaType === undefined) throw new Error(definition.invalidTypeMessage)
    if (exec.agent === undefined) throw new Error(`${definition.toolName} requires an active Agent session.`)
    const target = await resolveRegularTarget(ctx, args, exec)
    const data = await ctx.fs.readBytes(target, exec.signal, definition.maxBytes)
    const token = randomUUID()
    const name = basename(target.displayPath)
    this.#entries.set(token, { sessionId: String(exec.agent.id), data, mediaType, name })
    return { token, mediaType, name, bytes: data.byteLength }
  }

  async addAudio(ctx, args, exec) {
    return await this.#add(ctx, args, exec, {
      toolName: 'show_audio',
      mediaTypeFor: audioMediaTypeFor,
      maxBytes: this.maxAudioBytes,
      invalidTypeMessage: 'show_audio accepts MP3, WAV, M4A, AAC, OGG, Opus, or FLAC files only.',
    })
  }

  async addVideo(ctx, args, exec) {
    return await this.#add(ctx, args, exec, {
      toolName: 'show_video',
      mediaTypeFor: videoMediaTypeFor,
      maxBytes: this.maxVideoBytes,
      invalidTypeMessage: 'show_video accepts MP4 or WebM files only.',
    })
  }

  read(request) {
    if (request === null || typeof request !== 'object' || Array.isArray(request)) throw new TypeError('media preview request is invalid.')
    const { sessionId, token } = request
    if (typeof sessionId !== 'string' || sessionId === '' || typeof token !== 'string' || token === '') throw new TypeError('media preview request is invalid.')
    const entry = this.#entries.get(token)
    if (entry === undefined || entry.sessionId !== sessionId) throw new Error('媒体预览已失效或不属于当前会话。')
    return { mediaType: entry.mediaType, name: entry.name, dataBase64: Buffer.from(entry.data).toString('base64') }
  }

  clear() { this.#entries.clear() }
}

function createMediaService(protocol, mediaStore) {
  const initializers = []
  class ChatMediaService extends protocol.TypertRemoteService {
    constructor(ctx) {
      super(ctx, 'chatMedia')
      for (const initialize of initializers) initialize.call(this)
    }
    async read(request) { return mediaStore.read(request) }
  }
  protocol.Remote('read')(ChatMediaService.prototype.read, {
    private: false, static: false, name: 'read', addInitializer(initializer) { initializers.push(initializer) },
  })
  return ChatMediaService
}

function parseMarkdownRequest(request) {
  if (request === null || typeof request !== 'object' || Array.isArray(request)) throw new TypeError('Markdown preview request is invalid.')
  const { sessionId, path } = request
  if (typeof sessionId !== 'string' || sessionId === '' || typeof path !== 'string' || path.trim() === '') {
    throw new TypeError('Markdown preview request is invalid.')
  }
  if (!isMarkdownPath(path)) throw new Error('Markdown preview accepts .md or .markdown files only.')
  return { sessionId, path }
}

async function readMarkdown(ctx, maxMarkdownBytes, request) {
  const { sessionId, path } = parseMarkdownRequest(request)
  const agent = ctx.agents.get(sessionId)
  if (agent === undefined) throw new Error('当前会话未加载，无法预览 Markdown。')
  const cwd = agent.session.header.cwd
  if (cwd === undefined) throw new Error('当前会话没有工作目录，无法预览 Markdown。')
  const [workspace, target] = await Promise.all([
    ctx.fs.resolve('.', { cwd }),
    ctx.fs.resolve(path, { cwd }),
  ])
  if (!ctx.fs.contains(workspace, target)) throw new Error('Markdown 预览只能读取当前会话工作目录内的文件。')
  const info = await ctx.fs.stat(target)
  if (info === undefined) throw new Error(`cannot preview "${target.displayPath}": file not found`)
  if (info.type !== 'file') throw new Error(`cannot preview "${target.displayPath}": not a regular file`)
  const bytes = await ctx.fs.readBytes(target, undefined, maxMarkdownBytes)
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('Markdown preview requires UTF-8 text.')
  }
  return { name: basename(target.displayPath), text }
}

function createMarkdownService(protocol, ctx, maxMarkdownBytes) {
  const initializers = []
  class ChatMarkdownService extends protocol.TypertRemoteService {
    constructor(agentCtx) {
      super(agentCtx, 'chatMarkdown')
      for (const initialize of initializers) initialize.call(this)
    }
    async read(request) { return await readMarkdown(ctx, maxMarkdownBytes, request) }
  }
  protocol.Remote('read')(ChatMarkdownService.prototype.read, {
    private: false, static: false, name: 'read', addInitializer(initializer) { initializers.push(initializer) },
  })
  return ChatMarkdownService
}

let cachedProfileProtocol
let cachedProfileRequire

function profileRequire() {
  if (cachedProfileRequire !== undefined) return cachedProfileRequire
  const dshHome = resolve(process.env.DSH_HOME?.trim() || join(homedir(), '.dsh'))
  cachedProfileRequire = createRequire(join(dshHome, 'profiles', 'web', 'package.json'))
  return cachedProfileRequire
}

function profileProtocol() {
  if (cachedProfileProtocol !== undefined) return cachedProfileProtocol
  const protocol = profileRequire()('@deepseek-ai/dsh-typert-protocol')
  if (typeof protocol.TypertRemoteService !== 'function' || typeof protocol.Remote !== 'function') throw new Error('dsh-chat-enhancement requires the profile Typert protocol.')
  cachedProfileProtocol = protocol
  return cachedProfileProtocol
}

/**
 * Per-language wording for the injected `description` property.
 *
 * The hint is a schema annotation the model reads on every call, so it is
 * written in the language the deployment already asked the model to answer in
 * — the same reasoning as the language section.
 */
const TOOL_DESCRIPTION_HINTS = {
  zh: '一句话说明本次调用要做什么（动宾短语，5~15 字，例如「补充 skill 目录约定」）。显示在对话界面的工具行上，不参与执行。',
  en: 'One short sentence (5-15 words, active voice) naming what this call does, e.g. "Add the skill directory convention". Shown on the tool row in the UI; not used during execution.',
}

/** Languages whose hint is written in Chinese; `auto` and the rest take English. */
const CHINESE_LANGUAGES = new Set(['zh-CN', 'zh-TW'])

/**
 * Resolve the hint for one stored language id.
 * @param language - the persisted language id.
 * @returns the hint text in that language, or English for `auto` and unknowns.
 */
function toolDescriptionHint(language) {
  return CHINESE_LANGUAGES.has(language) ? TOOL_DESCRIPTION_HINTS.zh : TOOL_DESCRIPTION_HINTS.en
}

/**
 * Advertise an optional `description` on every assembled tool schema.
 *
 * A tool row's summary is the call's `description` argument whenever the call
 * carries one — bash has declared that parameter from the beginning, which is
 * why its rows have always read as a sentence. Every other tool cannot produce
 * one, because its schema never offered it; adding the property to the
 * assembled schemas is what makes the model write it.
 *
 * Injecting into the assembly rather than into each official tool definition
 * keeps this half plugin-only, and the copy stays shallow: a tool that already
 * declares `description` (bash and the PowerShell twin) keeps its own wording
 * and the hint is spent nowhere.
 *
 * Execution tolerates the extra key. `parameterSchemaSpecToJsonSchema` leaves
 * the parameter root without `additionalProperties`, which JSON Schema reads as
 * open, and each tool's own parser picks only the keys it knows — so a call
 * carrying a description behaves exactly like one without it.
 *
 * The property leads the map because the client's summary fallbacks are
 * positional (`deriveSummary` takes the first string argument for an unknown
 * tool), and models tend to emit arguments in schema order.
 * @param assembly - the assembly returned by the rest of the waterfall.
 * @param hint - the property annotation for the deployment's language.
 * @returns the same assembly when every tool already declares one, otherwise a copy with the property added.
 */
export function describeTools(assembly, hint) {
  let changed = false
  const tools = assembly.tools.map((tool) => {
    const parameters = tool.parameters
    if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) return tool
    const properties = parameters.properties
    if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) return tool
    if (Object.hasOwn(properties, 'description')) return tool
    changed = true
    return {
      ...tool,
      parameters: {
        ...parameters,
        properties: { description: { type: 'string', description: hint }, ...properties },
      },
    }
  })
  return changed ? { ...assembly, tools } : assembly
}

/** Fraction of CJK ideographs among the letters in one string. */
export function cjkRatio(text) {
  const cjk = (text.match(/[\u4e00-\u9fff]/gu) ?? []).length
  const latin = (text.match(/[A-Za-z]/gu) ?? []).length
  // Nothing to measure: an empty reply, or one that is all digits, punctuation
  // and emoji. Neither is evidence of drift, so say so instead of scoring 0.
  return cjk + latin === 0 ? undefined : cjk / (cjk + latin)
}

/**
 * The most recent assistant text the model has already produced.
 *
 * Walks the session surface from the newest node: only `assistant/message`
 * carries visible model output, and a step that ended in tool calls still has
 * its narration there, which is exactly the text that drifts first. A step
 * with no text block (a pure tool call) is skipped rather than treated as
 * "empty and therefore drifted", so the check keeps looking back at the last
 * thing the model actually said.
 * @param session - the live Agent session.
 * @returns the joined text, or undefined when the session has none yet.
 */
export function latestAssistantText(session) {
  const nodes = session?.surface?.nodes
  if (nodes === undefined) return undefined
  for (const seq of nodes.toReversed()) {
    // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read.
    const event = session.eventAt(seq)
    if (event?.type !== 'assistant/message') continue
    const content = event.data?.message?.content
    if (!Array.isArray(content)) continue
    const text = content
      .filter(block => block?.type === 'text' && typeof block.text === 'string')
      .map(block => block.text)
      .join('\n')
    if (text.trim() !== '') return text
  }
  return undefined
}

/**
 * Whether this step should carry a language anchor.
 *
 * Split out from the event handler so the policy is testable without standing
 * up a plugin host: `off` never fires, `always` fires every step past the
 * first, and `onDrift` fires only when the last reply measured as drifted.
 * `auto` is the caller's concern (there is no language to anchor to).
 * @param mode - the stored `languageAnchor` setting.
 * @param step - the step about to run.
 * @param lastText - the previous assistant text, when the session has one.
 * @returns whether an anchor belongs on this step.
 */
export function shouldAnchorLanguage(mode, step, lastText) {
  if (mode === 'off') return false
  // The first step has no prior model output to judge and nothing to correct.
  if (step <= 1) return false
  if (mode !== 'onDrift') return true
  const ratio = cjkRatio(lastText ?? '')
  return ratio !== undefined && ratio < DRIFT_THRESHOLD
}

/**
 * Re-assert the reply language whenever the model has drifted out of it.
 *
 * A soft prompt section loses to a long English transcript: one step slips,
 * that English reply becomes history, and every later step reads a context
 * that is now mostly English — the measured failure reached a 157-step session
 * that never returned to Chinese. Repeating the rule at the drift site is what
 * breaks the self-reinforcement, and the reminder is written in the target
 * language because an English sentence asking for Chinese is the very thing
 * the model follows into English.
 *
 * The anchor enters as a plugin-sourced user message the step actually
 * consumes — the official `agent-instructions` pattern, which splices into
 * `decision.messages` rather than leaving a message in the inbox. A prepend to
 * `nextStep` would only be claimed by the *following* step, one step too late
 * to stop the drift it just detected.
 *
 * Only one anchor is pending at a time: a fresh one replaces the previous, and
 * it only survives while the model is still drifting.
 * @param settingsCtx - the scope that owns the plugin's settings.
 * @param settings - the registered settings handle.
 */
function registerLanguageAnchor(settingsCtx, settings) {
  settingsCtx.on('agent/pre-step', async ({ agent, step }, next) => {
    const decision = await next()
    if (decision.kind === 'reject') return decision
    const current = settings.get()
    if (current.language === AUTO_LANGUAGE) return decision
    if (!shouldAnchorLanguage(languageAnchorMode(current.languageAnchor), step, latestAssistantText(agent.session))) return decision
    const text = languageAnchor(current.language)
    if (text === '') return decision
    const { createUserMessage } = profileRequire()('@deepseek-ai/dsh-llm')
    const message = createUserMessage({
      content: [{ type: 'text', text }],
      source: { kind: 'plugin', plugin: 'chat-enhancement-language-anchor' },
    })
    // Keep the anchor last: the rule belongs immediately before the model, and
    // re-inserting an identical payload would otherwise pile up one per step.
    const retained = decision.messages.filter(entry => !isLanguageAnchor(entry))
    return { ...decision, messages: [...retained, message] }
  })
}

/** Identity test for the anchor messages this plugin injects. */
export const isLanguageAnchor = message => message?.source?.kind === 'plugin'
  && message?.source?.plugin === 'chat-enhancement-language-anchor'

/**
 * Register the plugin's settings namespace, the model-language prompt section,
 * and the per-call tool description property.
 *
 * The section text is a provider rather than a constant, so assembly reads the
 * resolved setting on every model step: switching the language reaches the very
 * next step of an already-running session, with no re-registration and no DSH
 * restart. `auto` resolves to empty text, which `renderPrompt` drops, so an
 * unconfigured deployment assembles the exact prompt it had before.
 */
function registerSettings(ctx) {
  ctx.inject(['systemPrompt', 'settings'], (settingsCtx) => {
    const z = profileRequire()('@deepseek-ai/schemastery')
    const settings = settingsCtx.settings.register(CHAT_ENHANCEMENT_SETTINGS_NAMESPACE, z.object({
      audioAutoplay: z.boolean().default(false),
      videoAutoplay: z.boolean().default(false),
      // Purely presentational: the browser half drives DSH's own Think-row
      // disclosure while reasoning streams. The Host only persists it, because
      // a browser-local store would not survive a reload or reach another tab.
      expandReasoningWhileRunning: z.boolean().default(false),
      reasoningCollapseDelayMs: z.number().min(0).step(1).default(3000),
      codeReferenceHighlightMs: z.number().min(100).max(10000).step(1).default(1600),
      language: z.string().default(AUTO_LANGUAGE),
      // The allowed ids come from the shared catalog, so the browser picker and
      // this validator cannot disagree about what a valid mode is. The Host
      // still falls back through `languageAnchorMode` for hand-edited documents,
      // because schemastery rejects an unknown value rather than defaulting it.
      languageAnchor: z.union(LANGUAGE_ANCHOR_MODES.map(mode => z.const(mode.id))).default(DEFAULT_ANCHOR_MODE),
      toolDescriptions: z.boolean().default(true),
    }))
    settingsCtx.systemPrompt.section({
      name: 'private:chat-enhancement-code-references',
      order: 9040,
      text: () => '引用本地代码时，将行范围写成 Markdown 链接：[73–74 行](<C:/workspace/project/file.js#L73-L74>)。使用真实文件路径和已核验的行号（从 1 开始）；单行写 #L73，路径也可相对当前会话工作区。点击后会在 DSH 原有右侧代码预览器中定位并短暂高亮。不要编造行号，也不要依靠前文文件名解释裸行号。HTTP 链接仍按普通网页链接处理。',
    })
    settingsCtx.systemPrompt.section({
      name: 'private:chat-enhancement-language',
      order: LANGUAGE_SECTION_ORDER,
      text: () => languageInstruction(settings.get().language),
    })
    settingsCtx.on('system-prompt/assemble', async (_assembly, _context, next) => {
      const assembly = await next()
      const current = settings.get()
      if (current.toolDescriptions === false) return assembly
      return describeTools(assembly, toolDescriptionHint(current.language))
    })
    registerLanguageAnchor(settingsCtx, settings)
  })
}

/** Register the Agent-visible image presentation tool while attachments are available. */
function applyShowImageTool(ctx) {
  ctx.tools.register({
    name: 'show_image',
    description: 'Display a PNG, JPEG, WebP, or GIF image to the user in the chat. Use this when the user asks to see an existing image or when an image result should be presented visually. This tool does not modify the image.',
    parameters: filePathParameters('Image path, resolved relative to the current session workspace.'),
    output: {
      schema: imageOutputSchema(),
      render: (_args, value) => [
        { type: 'text', text: imagePreviewMarker(value) },
        { type: 'image', attachment: value.image },
      ],
    },
    async execute(args, exec) {
      const mediaType = imageMediaTypeFor(args.file_path)
      if (mediaType === undefined) throw new Error('show_image accepts PNG, JPEG, WebP, or GIF files only.')
      const target = await resolveRegularTarget(ctx, args, exec)
      const data = await ctx.fs.readBytes(target, exec.signal, ctx.attachments.imageLimits.maxImageBytes)
      const attachment = await ctx.attachments.saveImage({ data, mediaType, name: basename(target.displayPath) })
      return { path: target.displayPath, image: { attachmentId: attachment.attachmentId, mediaType: attachment.mediaType, bytes: attachment.bytes, width: attachment.width, height: attachment.height, ...(attachment.name === undefined ? {} : { name: attachment.name }) } }
    },
  })
}

function applyShowVideoTool(ctx, mediaStore) {
  ctx.tools.register({
    name: 'show_video',
    description: 'Display an MP4 or WebM video to the user in the chat. Use this when the user asks to watch an existing video or when a video result should be presented visually. The video is available only to the current session while DSH remains running.',
    parameters: filePathParameters('Video path, resolved relative to the current session workspace.'),
    output: { schema: mediaOutputSchema(), render: (_args, value) => [{ type: 'text', text: mediaPreviewMarker('video', value) }] },
    execute: (args, exec) => mediaStore.addVideo(ctx, args, exec),
  })
}

function applyShowAudioTool(ctx, mediaStore) {
  ctx.tools.register({
    name: 'show_audio',
    description: 'Display an MP3, WAV, M4A, AAC, OGG, Opus, or FLAC audio file to the user in the chat. Use this when the user asks to listen to an existing audio file or when an audio result should be presented. The audio is available only to the current session while DSH remains running.',
    parameters: filePathParameters('Audio path, resolved relative to the current session workspace.'),
    output: { schema: mediaOutputSchema(), render: (_args, value) => [{ type: 'text', text: mediaPreviewMarker('audio', value) }] },
    execute: (args, exec) => mediaStore.addAudio(ctx, args, exec),
  })
}

import { installSessionRecovery, recoveryConfig } from './session-recovery.js'

export const name = 'chat-enhancement'
export const inject = ['tools', 'fs', 'agents']

/** Compose Agent media tools, the current-session media reader, and the language preference. */
export function apply(ctx, config = {}) {
  ctx.inject(['sessionProjections'], scope => {
    const { z } = profileRequire()('zod')
    const { lastAssistantStreamChunk } = profileRequire()('@deepseek-ai/dsh-llm')
    scope.effect(() => scope.sessionProjections.register(createGoalMetricsProjection(z, lastAssistantStreamChunk)))
  })
  recoveryConfig(config)
  const resolved = resolveConfig(config)
  registerSettings(ctx)
  const mediaStore = new MediaStore(resolved.maxAudioBytes, resolved.maxVideoBytes)
  const protocol = profileProtocol()
  ctx.inject(['sessionQuery', 'sessionController', 'subagents', 'goals'], scope => installSessionRecovery(scope, protocol, config))
  const ChatMediaService = createMediaService(protocol, mediaStore)
  const ChatMarkdownService = createMarkdownService(protocol, ctx, resolved.maxMarkdownBytes)
  ctx.effect(() => () => mediaStore.clear(), 'chat enhancement media cache')
  ctx.inject(['attachments'], applyShowImageTool)
  applyShowAudioTool(ctx, mediaStore)
  applyShowVideoTool(ctx, mediaStore)
  ctx.inject(['agents'], () => {
    new ChatMediaService(ctx)
    new ChatMarkdownService(ctx)
  })
}
