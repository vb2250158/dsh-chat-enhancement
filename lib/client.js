window.__ModuleLoader__.load({
  id: 'dsh-chat-enhancement',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const overlayStyle = { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: '24px', background: 'rgb(0 0 0 / 70%)' }
    const cardStyle = { display: 'grid', gap: '8px', margin: '8px 0', padding: '10px 12px', border: '1px solid var(--dsw-alias-line-primary)', borderRadius: '10px' }
    const mutedStyle = { color: 'var(--dsw-alias-label-tertiary)', fontSize: '13px' }
    const pathFromArgs = (argsRaw) => { try { const value = JSON.parse(argsRaw); return typeof value.file_path === 'string' ? value.file_path : '媒体' } catch { return '媒体' } }
    function previewFromBlock(block) {
      if (!('kind' in block)) return null
      const image = block.content.find((part) => part.type === 'image')?.attachment
      if (image !== undefined) return { kind: 'image', attachment: image, path: null }
      for (const part of block.content) {
        if (part.type !== 'text') continue
        try {
          const marker = JSON.parse(part.text)
          if (marker?.type === 'dsh-chat-enhancement/image' && marker.attachment !== null && typeof marker.attachment === 'object') return { kind: 'image', attachment: marker.attachment, path: typeof marker.path === 'string' ? marker.path : null }
          if (marker?.type === 'dsh-chat-enhancement/video' && typeof marker.token === 'string' && typeof marker.mediaType === 'string' && typeof marker.name === 'string') return { kind: 'video', token: marker.token, mediaType: marker.mediaType, name: marker.name, bytes: typeof marker.bytes === 'number' ? marker.bytes : 0 }
        } catch {}
      }
      return null
    }
    function useObjectUrl(load, dependencies) {
      const [state, setState] = React.useState({ url: null, error: null })
      React.useEffect(() => {
        if (load === null) return undefined
        let disposed = false; let objectUrl = null
        setState({ url: null, error: null })
        void load().then(({ data, mediaType }) => {
          if (disposed) return
          objectUrl = URL.createObjectURL(new Blob([data], { type: mediaType }))
          setState({ url: objectUrl, error: null })
        }).catch((error) => { if (!disposed) setState({ url: null, error: error instanceof Error ? error.message : String(error) }) })
        return () => { disposed = true; if (objectUrl !== null) URL.revokeObjectURL(objectUrl) }
      }, dependencies)
      return state
    }
    function useImageUrl(sessionId, attachment, sessions) {
      const load = attachment === null ? null : async () => {
        const session = sessions.binding(sessionId)?.session
        if (session === undefined) throw new Error('会话附件不可用。')
        const result = await session.readAttachment(attachment.attachmentId)
        if (!result.ok) throw new Error(result.error.message)
        return { data: result.value.data, mediaType: result.value.attachment.mediaType }
      }
      return useObjectUrl(load, [attachment, sessionId, sessions])
    }
    const decodeBase64 = (value) => { const binary = atob(value); const bytes = new Uint8Array(binary.length); for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index); return bytes }
    function useVideoUrl(sessionId, preview, readVideo) {
      const load = preview === null ? null : async () => { const result = await readVideo({ sessionId, token: preview.token }); return { data: decodeBase64(result.dataBase64), mediaType: result.mediaType } }
      return useObjectUrl(load, [preview, readVideo, sessionId])
    }
    function ImagePreview({ sessionId, attachment, sessions }) {
      const { url, error } = useImageUrl(sessionId, attachment, sessions)
      const [open, setOpen] = React.useState(false)
      if (error !== null) return React.createElement('span', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, `预览失败：${error}`)
      if (url === null) return React.createElement('span', { role: 'status', style: mutedStyle }, '加载预览…')
      return React.createElement(React.Fragment, null,
        React.createElement('button', { type: 'button', onClick: () => setOpen(true), style: { display: 'block', border: 0, padding: 0, background: 'none', cursor: 'zoom-in' }, 'aria-label': `预览 ${attachment.name ?? '图片'}` }, React.createElement('img', { src: url, alt: attachment.name ?? '图片预览', style: { display: 'block', maxWidth: '240px', maxHeight: '180px', borderRadius: '8px', objectFit: 'contain' } })),
        open && React.createElement('div', { role: 'dialog', 'aria-modal': true, 'aria-label': attachment.name ?? '图片预览', style: overlayStyle, onClick: () => setOpen(false) }, React.createElement('img', { src: url, alt: attachment.name ?? '图片预览', onClick: (event) => event.stopPropagation(), style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' } }))
      )
    }
    function VideoPreview({ sessionId, preview, readVideo }) {
      const { url, error } = useVideoUrl(sessionId, preview, readVideo)
      if (error !== null) return React.createElement('span', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, `播放失败：${error}`)
      if (url === null) return React.createElement('span', { role: 'status', style: mutedStyle }, '加载视频…')
      return React.createElement('video', { controls: true, preload: 'metadata', src: url, style: { display: 'block', maxWidth: '360px', maxHeight: '240px', borderRadius: '8px' } })
    }
    function MediaToolView({ block, sessionId, sessions, readVideo }) {
      const preview = previewFromBlock(block)
      const path = preview?.kind === 'image' ? preview.path ?? pathFromArgs(block.argsRaw ?? block.call?.argsRaw ?? '') : preview?.name ?? pathFromArgs(block.argsRaw ?? block.call?.argsRaw ?? '')
      const title = preview?.kind === 'video' ? `展示视频 · ${path}` : preview?.kind === 'image' ? `展示图片 · ${path}` : '展示媒体'
      const summary = preview?.kind === 'image' ? `${preview.attachment.width} × ${preview.attachment.height}` : preview?.kind === 'video' ? `${Math.ceil(preview.bytes / 1024 / 1024)} MiB` : ('kind' in block && block.isError ? '展示失败' : '正在准备…')
      return React.createElement('section', { 'data-dsh-chat-enhancement': preview?.kind ?? 'media', style: cardStyle }, React.createElement('div', { style: { fontWeight: 600 } }, title), React.createElement('div', { style: mutedStyle }, summary), preview?.kind === 'image' && React.createElement(ImagePreview, { sessionId, attachment: preview.attachment, sessions }), preview?.kind === 'video' && React.createElement(VideoPreview, { sessionId, preview, readVideo }))
    }
    const requestSchema = { parse(value) { if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof value.sessionId !== 'string' || typeof value.token !== 'string') throw new TypeError('media request is invalid.'); return { sessionId: value.sessionId, token: value.token } } }
    const resultSchema = { parse(value) { if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof value.mediaType !== 'string' || typeof value.name !== 'string' || typeof value.dataBase64 !== 'string') throw new TypeError('media result is invalid.'); return value } }
    const mediaRemote = { package: 'dsh-chat-enhancement', descriptors: [{ id: 'dsh-chat-enhancement#chatMedia/read', service: 'chatMedia', namespace: 'chatMedia', method: 'read', invocation: { kind: 'direct' }, parameters: [{ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatMediaRequest', schema: requestSchema } }], result: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatMediaResult', schema: resultSchema } }] }
    const inject = ['slots', 'sessions', 'remote']
    async function apply(ctx) {
      const dispose = await ctx.remote.$mount(mediaRemote)
      const sessions = ctx.get('sessions')
      const service = ctx.reflect.get('remote.chatMedia')
      if (sessions === undefined || service?.read === undefined) throw new Error('dsh-chat-enhancement media services are unavailable.')
      const readVideo = async (request) => { const result = await service.read(request); if (!result.ok || result.value === undefined) throw new Error(result.error?.message ?? '视频读取失败。'); return result.value }
      for (const key of ['read_image', 'show_image', 'show_video']) ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key, locale: 'conversation' }, (props) => React.createElement(MediaToolView, { ...props, sessions, readVideo })))
      return dispose
    }
    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
