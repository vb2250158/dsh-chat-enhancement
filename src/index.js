/** Host entry for the chat-enhancement DSH bundle. */

import { basename, extname } from 'node:path'

const IMAGE_MEDIA_TYPES = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function mediaTypeFor(filePath) {
  return IMAGE_MEDIA_TYPES[extname(filePath).toLowerCase()]
}

function previewMarker(value) {
  return JSON.stringify({
    type: 'dsh-chat-enhancement/image',
    path: value.path,
    attachment: value.image,
  })
}

function outputSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: { type: 'string', required: true },
      image: {
        type: 'object',
        additionalProperties: false,
        required: true,
        properties: {
          attachmentId: { type: 'string', required: true },
          mediaType: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
          width: { type: 'integer', required: true },
          height: { type: 'integer', required: true },
          name: { type: 'string' },
        },
      },
    },
  }
}

/** Register the Agent-visible image presentation tool while attachments are available. */
function applyShowImageTool(ctx) {
  ctx.tools.register({
    name: 'show_image',
    description: 'Display a PNG, JPEG, WebP, or GIF image to the user in the chat. Use this when the user asks to see an existing image or when an image result should be presented visually. This tool does not modify the image.',
    parameters: {
      file_path: { type: 'string', required: true, description: 'Image path, resolved relative to the current session workspace.' },
    },
    output: {
      schema: outputSchema(),
      render: (_args, value) => [{ type: 'text', text: previewMarker(value) }],
    },
    async execute(args, exec) {
      const mediaType = mediaTypeFor(args.file_path)
      if (mediaType === undefined) throw new Error('show_image accepts PNG, JPEG, WebP, or GIF files only.')
      const target = await ctx.fs.resolve(args.file_path, {
        ...(exec.agent?.session.header.cwd === undefined ? {} : { cwd: exec.agent.session.header.cwd }),
        signal: exec.signal,
      })
      const info = await ctx.fs.stat(target, exec.signal)
      if (info === undefined) throw new Error(`cannot show "${target.displayPath}": file not found`)
      if (info.type !== 'file') throw new Error(`cannot show "${target.displayPath}": not a regular file`)
      const data = await ctx.fs.readBytes(target, exec.signal, ctx.attachments.imageLimits.maxImageBytes)
      const attachment = await ctx.attachments.saveImage({ data, mediaType, name: basename(target.displayPath) })
      return {
        path: target.displayPath,
        image: {
          attachmentId: attachment.attachmentId,
          mediaType: attachment.mediaType,
          bytes: attachment.bytes,
          width: attachment.width,
          height: attachment.height,
          ...(attachment.name === undefined ? {} : { name: attachment.name }),
        },
      }
    },
  })
}

export const name = 'chat-enhancement'
export const inject = ['tools', 'fs']

/** Compose the Agent tool only when DSH has its durable image attachment store. */
export function apply(ctx) {
  ctx.inject(['attachments'], applyShowImageTool)
}
