/** Host entry for the chat-enhancement DSH bundle. */

import { randomUUID } from 'node:crypto'
import { basename, extname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'

const IMAGE_MEDIA_TYPES = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const VIDEO_MEDIA_TYPES = { '.mp4': 'video/mp4', '.webm': 'video/webm' }
const DEFAULT_MAX_VIDEO_BYTES = 50 * 1024 * 1024
const DEFAULT_MAX_MARKDOWN_BYTES = 2 * 1024 * 1024

const imageMediaTypeFor = (filePath) => IMAGE_MEDIA_TYPES[extname(filePath).toLowerCase()]
const videoMediaTypeFor = (filePath) => VIDEO_MEDIA_TYPES[extname(filePath).toLowerCase()]
const isMarkdownPath = (filePath) => ['.md', '.markdown'].includes(extname(filePath).toLowerCase())

function resolveConfig(config = {}) {
  const maxVideoBytes = config.maxVideoBytes ?? DEFAULT_MAX_VIDEO_BYTES
  if (!Number.isSafeInteger(maxVideoBytes) || maxVideoBytes < 1) throw new TypeError('maxVideoBytes must be a positive safe integer.')
  const maxMarkdownBytes = config.maxMarkdownBytes ?? DEFAULT_MAX_MARKDOWN_BYTES
  if (!Number.isSafeInteger(maxMarkdownBytes) || maxMarkdownBytes < 1) throw new TypeError('maxMarkdownBytes must be a positive safe integer.')
  return { maxVideoBytes, maxMarkdownBytes }
}

const imagePreviewMarker = (value) => JSON.stringify({ type: 'dsh-chat-enhancement/image', path: value.path, attachment: value.image })
const videoPreviewMarker = (value) => JSON.stringify({ type: 'dsh-chat-enhancement/video', token: value.token, mediaType: value.mediaType, name: value.name, bytes: value.bytes })

function imageOutputSchema() {
  return { type: 'object', additionalProperties: false, required: ['path', 'image'], properties: {
    path: { type: 'string' },
    image: { type: 'object', additionalProperties: false, required: ['attachmentId', 'mediaType', 'bytes', 'width', 'height'], properties: {
      attachmentId: { type: 'string' }, mediaType: { type: 'string' }, bytes: { type: 'integer' },
      width: { type: 'integer' }, height: { type: 'integer' }, name: { type: 'string' },
    } },
  } }
}

function videoOutputSchema() {
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

/** Ephemeral per-session video bytes, addressed only by an opaque tool-result token. */
class VideoStore {
  #entries = new Map()

  constructor(maxVideoBytes) {
    this.maxVideoBytes = maxVideoBytes
  }

  async add(ctx, args, exec) {
    const mediaType = videoMediaTypeFor(args.file_path)
    if (mediaType === undefined) throw new Error('show_video accepts MP4 or WebM files only.')
    if (exec.agent === undefined) throw new Error('show_video requires an active Agent session.')
    const target = await resolveRegularTarget(ctx, args, exec)
    const data = await ctx.fs.readBytes(target, exec.signal, this.maxVideoBytes)
    const token = randomUUID()
    const name = basename(target.displayPath)
    this.#entries.set(token, { sessionId: String(exec.agent.id), data, mediaType, name })
    return { token, mediaType, name, bytes: data.byteLength }
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

function createMediaService(protocol, videoStore) {
  const initializers = []
  class ChatMediaService extends protocol.TypertRemoteService {
    constructor(ctx) {
      super(ctx, 'chatMedia')
      for (const initialize of initializers) initialize.call(this)
    }
    async read(request) { return videoStore.read(request) }
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

function profileProtocol() {
  if (cachedProfileProtocol !== undefined) return cachedProfileProtocol
  const dshHome = resolve(process.env.DSH_HOME?.trim() || join(homedir(), '.dsh'))
  const profileRequire = createRequire(join(dshHome, 'profiles', 'web', 'package.json'))
  const protocol = profileRequire('@deepseek-ai/dsh-typert-protocol')
  if (typeof protocol.TypertRemoteService !== 'function' || typeof protocol.Remote !== 'function') throw new Error('dsh-chat-enhancement requires the profile Typert protocol.')
  cachedProfileProtocol = protocol
  return cachedProfileProtocol
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

function applyShowVideoTool(ctx, videoStore) {
  ctx.tools.register({
    name: 'show_video',
    description: 'Display an MP4 or WebM video to the user in the chat. Use this when the user asks to watch an existing video or when a video result should be presented visually. The video is available only to the current session while DSH remains running.',
    parameters: filePathParameters('Video path, resolved relative to the current session workspace.'),
    output: { schema: videoOutputSchema(), render: (_args, value) => [{ type: 'text', text: videoPreviewMarker(value) }] },
    execute: (args, exec) => videoStore.add(ctx, args, exec),
  })
}

export const name = 'chat-enhancement'
export const inject = ['tools', 'fs', 'agents']

/** Compose Agent media tools and the current-session video reader. */
export function apply(ctx, config = {}) {
  const resolved = resolveConfig(config)
  const videoStore = new VideoStore(resolved.maxVideoBytes)
  const protocol = profileProtocol()
  const ChatMediaService = createMediaService(protocol, videoStore)
  const ChatMarkdownService = createMarkdownService(protocol, ctx, resolved.maxMarkdownBytes)
  ctx.effect(() => () => videoStore.clear(), 'chat enhancement video cache')
  ctx.inject(['attachments'], applyShowImageTool)
  applyShowVideoTool(ctx, videoStore)
  ctx.inject(['agents'], () => {
    new ChatMediaService(ctx)
    new ChatMarkdownService(ctx)
  })
}
