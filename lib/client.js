window.__ModuleLoader__.load({
  id: 'dsh-chat-enhancement',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')

    const overlayStyle = { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: '24px', background: 'rgb(0 0 0 / 70%)' }
    const pathFromArgs = (argsRaw) => { try { const parsed = JSON.parse(argsRaw); return typeof parsed.file_path === 'string' ? parsed.file_path : '图片' } catch { return '图片' } }
    function previewFromBlock(block) {
      if (!('kind' in block)) return null
      const image = block.content.find((part) => part.type === 'image')?.attachment
      if (image !== undefined) return { attachment: image, path: null }
      for (const part of block.content) {
        if (part.type !== 'text') continue
        try { const marker = JSON.parse(part.text); if (marker?.type === 'dsh-chat-enhancement/image' && marker.attachment !== null && typeof marker.attachment === 'object') return { attachment: marker.attachment, path: typeof marker.path === 'string' ? marker.path : null } } catch {}
      }
      return null
    }
    function useAttachmentUrl(sessionId, attachment, sessions) {
      const [state, setState] = React.useState({ url: null, error: null })
      React.useEffect(() => {
        if (attachment === null) return undefined
        let disposed = false; let objectUrl = null
        const session = sessions.binding(sessionId)?.session
        if (session === undefined) { setState({ url: null, error: '会话附件不可用。' }); return undefined }
        setState({ url: null, error: null })
        void session.readAttachment(attachment.attachmentId).then((result) => {
          if (!result.ok) throw new Error(result.error.message)
          if (disposed) return
          objectUrl = URL.createObjectURL(new Blob([result.value.data], { type: result.value.attachment.mediaType }))
          setState({ url: objectUrl, error: null })
        }).catch((error) => { if (!disposed) setState({ url: null, error: error instanceof Error ? error.message : String(error) }) })
        return () => { disposed = true; if (objectUrl !== null) URL.revokeObjectURL(objectUrl) }
      }, [attachment, sessionId, sessions])
      return state
    }
    function ImagePreview({ sessionId, attachment, sessions }) {
      const { url, error } = useAttachmentUrl(sessionId, attachment, sessions)
      const [open, setOpen] = React.useState(false)
      if (error !== null) return React.createElement('span', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, `预览失败：${error}`)
      if (url === null) return React.createElement('span', { role: 'status', style: { color: 'var(--dsw-alias-label-tertiary)' } }, '加载预览…')
      return React.createElement(React.Fragment, null,
        React.createElement('button', { type: 'button', onClick: () => setOpen(true), style: { display: 'block', border: 0, padding: 0, background: 'none', cursor: 'zoom-in' }, 'aria-label': `预览 ${attachment.name ?? '图片'}` }, React.createElement('img', { src: url, alt: attachment.name ?? '图片预览', style: { display: 'block', maxWidth: '240px', maxHeight: '180px', borderRadius: '8px', objectFit: 'contain' } })),
        open && React.createElement('div', { role: 'dialog', 'aria-modal': true, 'aria-label': attachment.name ?? '图片预览', style: overlayStyle, onClick: () => setOpen(false) }, React.createElement('img', { src: url, alt: attachment.name ?? '图片预览', onClick: (event) => event.stopPropagation(), style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' } }))
      )
    }
    function ImageToolView({ block, sessionId, sessions }) {
      const preview = previewFromBlock(block)
      const attachment = preview?.attachment ?? null
      const path = preview?.path ?? pathFromArgs(block.argsRaw ?? block.call?.argsRaw ?? '')
      const title = attachment === null ? '读取图片' : `读取图片 · ${path}`
      const summary = attachment === null ? ('kind' in block && block.isError ? '读取失败' : '正在读取…') : `${attachment.width} × ${attachment.height}`
      return React.createElement('section', { 'data-dsh-chat-enhancement': 'read-image', style: { display: 'grid', gap: '8px', margin: '8px 0', padding: '10px 12px', border: '1px solid var(--dsw-alias-line-primary)', borderRadius: '10px' } }, React.createElement('div', { style: { fontWeight: 600 } }, title), React.createElement('div', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: '13px' } }, summary), attachment !== null && React.createElement(ImagePreview, { sessionId, attachment, sessions }))
    }
    const inject = ['slots', 'sessions']
    function apply(ctx) {
      const sessions = ctx.get('sessions')
      if (sessions === undefined) throw new Error('dsh-chat-enhancement requires the sessions service.')
      for (const key of ['read_image', 'show_image']) ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key, locale: 'conversation' }, (props) => React.createElement(ImageToolView, { ...props, sessions })))
    }
    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
