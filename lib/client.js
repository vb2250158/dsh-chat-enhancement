window.__ModuleLoader__.load({
  id: 'dsh-chat-enhancement',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const { MarkdownText } = require('@deepseek-ai/dsh-client-ui-primitives')
    const overlayStyle = { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: '24px', background: 'rgb(0 0 0 / 70%)' }
    const cardStyle = { display: 'grid', gap: '8px', margin: '8px 0', padding: '10px 12px', border: '1px solid var(--dsw-alias-line-primary)', borderRadius: '10px' }
    const mutedStyle = { color: 'var(--dsw-alias-label-tertiary)', fontSize: '13px' }
    const markdownDialogStyle = { width: 'min(960px, 100%)', maxHeight: 'min(85vh, 900px)', overflow: 'auto', padding: '20px', borderRadius: '12px', background: 'var(--dsw-alias-bg-elevated)', color: 'var(--dsw-alias-label-primary)', boxShadow: '0 20px 48px rgb(0 0 0 / 35%)' }
    const markdownHeaderStyle = { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }
    const closeButtonStyle = { marginLeft: 'auto', border: 0, borderRadius: '6px', padding: '6px 9px', background: 'transparent', color: 'inherit', cursor: 'pointer' }
    const toolGroupButtonStyle = { display: 'flex', width: '100%', alignItems: 'center', gap: '8px', border: 0, padding: '6px 0', background: 'transparent', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', textAlign: 'left' }
    const imageDialogStyle = { ...overlayStyle, padding: 0, background: 'rgb(0 0 0 / 88%)', touchAction: 'pan-y' }
    const imageDialogToolbarStyle = { position: 'absolute', top: 'max(12px, env(safe-area-inset-top))', right: 'max(12px, env(safe-area-inset-right))', zIndex: 2, display: 'flex', gap: '8px' }
    const imageDialogModeStyle = { position: 'absolute', top: 'max(12px, env(safe-area-inset-top))', left: 'max(12px, env(safe-area-inset-left))', zIndex: 2 }
    const imageDialogActionStyle = { display: 'inline-flex', alignItems: 'center', minHeight: '36px', border: '1px solid rgb(255 255 255 / 24%)', borderRadius: '8px', padding: '6px 12px', background: 'rgb(20 20 20 / 72%)', color: '#fff', cursor: 'pointer', font: 'inherit', textDecoration: 'none' }
    const imageDialogNavStyle = { position: 'absolute', top: '50%', zIndex: 2, width: '42px', height: '42px', transform: 'translateY(-50%)', border: '1px solid rgb(255 255 255 / 20%)', borderRadius: '999px', background: 'rgb(20 20 20 / 62%)', color: '#fff', cursor: 'pointer', fontSize: '24px' }
    const imageFloatingStyle = { position: 'fixed', top: 'max(16px, env(safe-area-inset-top))', right: 'max(16px, env(safe-area-inset-right))', zIndex: 1000, display: 'grid', placeItems: 'center', width: 'min(720px, calc(100vw - 32px))', overflow: 'hidden', border: '1px solid var(--dsw-alias-line-primary)', borderRadius: '12px', background: 'rgb(8 20 36 / 96%)', boxShadow: '0 20px 48px rgb(0 0 0 / 45%)', touchAction: 'pan-y' }
    const imageResizeHandleStyle = { position: 'absolute', right: 0, bottom: 0, left: 0, zIndex: 3, display: 'grid', placeItems: 'center', height: '18px', border: 0, padding: 0, background: 'rgb(8 20 36 / 72%)', cursor: 'ns-resize', touchAction: 'none' }
    const imageResizeLineStyle = { width: '72px', height: '3px', borderRadius: '999px', background: 'rgb(255 255 255 / 52%)' }
    const settingsSectionStyle = { display: 'grid', gap: '18px', minWidth: 0 }
    const settingsRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', padding: '14px 0', borderBottom: '1px solid var(--dsw-alias-line-primary)' }
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
          if (marker?.type === 'dsh-chat-enhancement/audio' && typeof marker.token === 'string' && typeof marker.mediaType === 'string' && typeof marker.name === 'string') return { kind: 'audio', token: marker.token, mediaType: marker.mediaType, name: marker.name, bytes: typeof marker.bytes === 'number' ? marker.bytes : 0 }
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
    function isMarkdownPath(path) { return /\.(?:md|markdown)$/iu.test(path.trim()) }
    function markdownPathFromClick(target) {
      if (!(target instanceof Element)) return null
      const button = target.closest('button[title]')
      if (button === null || button.closest('[data-dsh-chat-enhancement-markdown]') !== null) return null
      const path = button.getAttribute('title')
      return path !== null && isMarkdownPath(path) ? path : null
    }
    function displayName(path) { return path.split(/[\\/]/u).filter(Boolean).at(-1) ?? path }
    function useMediaUrl(sessionId, preview, readMedia) {
      const load = preview === null ? null : async () => { const result = await readMedia({ sessionId, token: preview.token }); return { data: decodeBase64(result.dataBase64), mediaType: result.mediaType } }
      return useObjectUrl(load, [preview, readMedia, sessionId])
    }
    function imageGallery(sessionId) {
      return [...document.querySelectorAll('[data-dsh-image-preview]')]
        .filter((element) => element.dataset.dshImageSession === sessionId && element.offsetParent !== null)
        .map((element) => ({ url: element.dataset.dshImageUrl, name: element.dataset.dshImageName }))
        .filter((item) => typeof item.url === 'string' && typeof item.name === 'string')
    }
    function ImagePreviewDialog({ sessionId, initial, onClose }) {
      const [current, setCurrent] = React.useState(initial)
      const [floating, setFloating] = React.useState(false)
      const [floatingHeightRatio, setFloatingHeightRatio] = React.useState(0.38)
      const pointerStart = React.useRef(null)
      const resizePointer = React.useRef(null)
      const currentRef = React.useRef(current)
      const followingLatest = React.useRef(false)
      currentRef.current = current
      const navigate = (offset) => {
        const images = imageGallery(sessionId); const index = images.findIndex((image) => image.url === current.url); const nextIndex = index + offset
        if (index >= 0 && nextIndex >= 0 && nextIndex < images.length) { followingLatest.current = nextIndex === images.length - 1; setCurrent(images[nextIndex]) }
      }
      const images = imageGallery(sessionId); const index = images.findIndex((image) => image.url === current.url); const hasPrevious = index > 0; const hasNext = index >= 0 && index < images.length - 1
      const resizeFloating = (event) => { if (resizePointer.current !== event.pointerId) return; const viewportHeight = window.visualViewport?.height ?? window.innerHeight; const nextRatio = Math.min(0.78, Math.max(0.2, (event.clientY - 16) / viewportHeight)); setFloatingHeightRatio(nextRatio) }
      React.useEffect(() => {
        const initialImages = imageGallery(sessionId); followingLatest.current = initialImages.length > 0 && initialImages.findIndex((image) => image.url === initial.url) === initialImages.length - 1
        const observer = new MutationObserver(() => { if (!followingLatest.current) return; const latest = imageGallery(sessionId).at(-1); if (latest !== undefined && latest.url !== currentRef.current.url) setCurrent(latest) })
        observer.observe(document.body, { attributes: true, childList: true, subtree: true })
        return () => { observer.disconnect() }
      }, [initial.url, sessionId])
      React.useEffect(() => {
        const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); else if (event.key === 'ArrowLeft') navigate(-1); else if (event.key === 'ArrowRight') navigate(1) }
        document.addEventListener('keydown', onKeyDown)
        return () => { document.removeEventListener('keydown', onKeyDown) }
      }, [current, onClose])
      return React.createElement('div', {
        role: 'dialog', 'aria-modal': !floating, 'aria-label': current.name, style: floating ? { ...imageFloatingStyle, height: `clamp(180px, ${Math.round(floatingHeightRatio * 100)}dvh, calc(100dvh - 32px))` } : imageDialogStyle, onClick: floating ? undefined : onClose,
        onPointerDown: (event) => { pointerStart.current = event.clientX },
        onPointerUp: (event) => { if (pointerStart.current === null) return; const distance = event.clientX - pointerStart.current; pointerStart.current = null; if (distance > 50) navigate(-1); else if (distance < -50) navigate(1) },
      },
      React.createElement('button', { type: 'button', style: { ...imageDialogActionStyle, ...imageDialogModeStyle }, onClick: (event) => { event.stopPropagation(); setFloating((value) => !value) }, 'aria-label': floating ? '返回全屏预览' : '切换为悬浮预览' }, floating ? '全屏' : '悬浮'),
      React.createElement('div', { style: imageDialogToolbarStyle, onClick: (event) => event.stopPropagation() }, React.createElement('a', { href: current.url, download: current.name, style: imageDialogActionStyle }, '下载'), React.createElement('button', { type: 'button', style: imageDialogActionStyle, onClick: onClose, 'aria-label': '关闭图片预览' }, '关闭')),
      hasPrevious && React.createElement('button', { type: 'button', style: { ...imageDialogNavStyle, left: 'max(12px, env(safe-area-inset-left))' }, onClick: (event) => { event.stopPropagation(); navigate(-1) }, 'aria-label': '上一张' }, '‹'),
      React.createElement('img', { src: current.url, alt: current.name, draggable: false, onClick: (event) => event.stopPropagation(), style: floating ? { display: 'block', width: '100%', height: 'calc(100% - 18px)', minWidth: 0, minHeight: 0, objectFit: 'contain', userSelect: 'none' } : { display: 'block', maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', objectFit: 'contain', userSelect: 'none' } }),
      hasNext && React.createElement('button', { type: 'button', style: { ...imageDialogNavStyle, right: 'max(12px, env(safe-area-inset-right))' }, onClick: (event) => { event.stopPropagation(); navigate(1) }, 'aria-label': '下一张' }, '›'),
      images.length > 1 && React.createElement('div', { style: { position: 'absolute', bottom: floating ? '22px' : 'max(12px, env(safe-area-inset-bottom))', color: '#fff', fontSize: '13px' } }, `${index + 1} / ${images.length}`),
      floating && React.createElement('button', { type: 'button', role: 'separator', 'aria-orientation': 'horizontal', 'aria-label': '调整悬浮预览高度', 'aria-valuemin': 20, 'aria-valuemax': 78, 'aria-valuenow': Math.round(floatingHeightRatio * 100), style: imageResizeHandleStyle, onPointerDown: (event) => { event.preventDefault(); event.stopPropagation(); resizePointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId) }, onPointerMove: (event) => { event.stopPropagation(); resizeFloating(event) }, onPointerUp: (event) => { event.stopPropagation(); resizePointer.current = null; event.currentTarget.releasePointerCapture(event.pointerId) }, onPointerCancel: (event) => { event.stopPropagation(); resizePointer.current = null }, onKeyDown: (event) => { if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return; event.preventDefault(); setFloatingHeightRatio((value) => Math.min(0.78, Math.max(0.2, value + (event.key === 'ArrowDown' ? 0.05 : -0.05)))) } }, React.createElement('span', { style: imageResizeLineStyle })))
    }
    function ImagePreview({ sessionId, attachment, sessions }) {
      const { url, error } = useImageUrl(sessionId, attachment, sessions)
      const [open, setOpen] = React.useState(false)
      if (error !== null) return React.createElement('span', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, `预览失败：${error}`)
      if (url === null) return React.createElement('span', { role: 'status', style: mutedStyle }, '加载预览…')
      const name = attachment.name ?? '图片'
      return React.createElement(React.Fragment, null,
        React.createElement('button', { type: 'button', 'data-dsh-image-preview': true, 'data-dsh-image-session': sessionId, 'data-dsh-image-url': url, 'data-dsh-image-name': name, onClick: () => setOpen(true), style: { display: 'block', border: 0, padding: 0, background: 'none', cursor: 'zoom-in' }, 'aria-label': `预览原图 ${name}` }, React.createElement('img', { src: url, alt: `${name}预览`, style: { display: 'block', maxWidth: '240px', maxHeight: '180px', borderRadius: '8px', objectFit: 'contain' } })),
        open && React.createElement(ImagePreviewDialog, { sessionId, initial: { url, name }, onClose: () => setOpen(false) })
      )
    }
    function VideoPreview({ sessionId, preview, readMedia, autoplay }) {
      const { url, error } = useMediaUrl(sessionId, preview, readMedia)
      const player = React.useRef(null)
      React.useEffect(() => { if (autoplay && url !== null) void player.current?.play().catch(() => {}) }, [autoplay, url])
      if (error !== null) return React.createElement('span', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, `播放失败：${error}`)
      if (url === null) return React.createElement('span', { role: 'status', style: mutedStyle }, '加载视频…')
      return React.createElement('video', { ref: player, controls: true, autoPlay: autoplay, preload: 'metadata', src: url, style: { display: 'block', maxWidth: '360px', maxHeight: '240px', borderRadius: '8px' } })
    }
    function AudioPreview({ sessionId, preview, readMedia, autoplay }) {
      const { url, error } = useMediaUrl(sessionId, preview, readMedia)
      const player = React.useRef(null)
      React.useEffect(() => { if (autoplay && url !== null) void player.current?.play().catch(() => {}) }, [autoplay, url])
      if (error !== null) return React.createElement('span', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, `播放失败：${error}`)
      if (url === null) return React.createElement('span', { role: 'status', style: mutedStyle }, '加载音频…')
      return React.createElement('audio', { ref: player, controls: true, autoPlay: autoplay, preload: 'metadata', src: url, style: { display: 'block', width: 'min(100%, 420px)' } })
    }
    function useSettingsSnapshot(scope) { const subscribe = React.useCallback((listener) => scope.subscribe(listener), [scope]); const getSnapshot = React.useCallback(() => scope.getSnapshot(), [scope]); return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot) }
    function mediaPreferences(snapshot) { return snapshot.status === 'ready' && snapshot.value !== undefined ? snapshot.value : { audioAutoplay: false, videoAutoplay: false } }
    function MediaSettingsSection({ mediaSettings }) {
      const snapshot = useSettingsSnapshot(mediaSettings); const preferences = mediaPreferences(snapshot); const writable = snapshot.status === 'ready' && snapshot.writable
      const row = (field, label) => React.createElement('label', { style: settingsRowStyle }, React.createElement('span', null, label), React.createElement('input', { type: 'checkbox', role: 'switch', checked: preferences[field], disabled: !writable, onChange: (event) => { void mediaSettings.set(field, event.target.checked) } }))
      return React.createElement('section', { style: settingsSectionStyle }, React.createElement('h2', null, '媒体播放'), row('audioAutoplay', '音频自动播放'), row('videoAutoplay', '视频自动播放'), React.createElement('p', { style: mutedStyle }, '浏览器可能阻止未交互页面的有声自动播放。'))
    }
    function MarkdownPreviewController({ sessionId, readMarkdown }) {
      const [preview, setPreview] = React.useState(null)
      React.useEffect(() => {
        const onClick = (event) => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
          const path = markdownPathFromClick(event.target)
          if (path === null) return
          event.preventDefault(); event.stopPropagation()
          setPreview({ path, name: displayName(path), text: null, error: null })
          void readMarkdown({ sessionId, path }).then((value) => {
            setPreview((current) => current?.path === path ? { path, name: value.name, text: value.text, error: null } : current)
          }).catch((error) => {
            setPreview((current) => current?.path === path ? { path, name: displayName(path), text: null, error: error instanceof Error ? error.message : String(error) } : current)
          })
        }
        document.addEventListener('click', onClick, true)
        return () => { document.removeEventListener('click', onClick, true) }
      }, [readMarkdown, sessionId])
      if (preview === null) return null
      return React.createElement('div', { 'data-dsh-chat-enhancement-markdown': true, role: 'dialog', 'aria-modal': true, 'aria-label': preview.name, style: overlayStyle, onClick: () => setPreview(null) },
        React.createElement('article', { style: markdownDialogStyle, onClick: (event) => event.stopPropagation() },
          React.createElement('header', { style: markdownHeaderStyle }, React.createElement('strong', null, preview.name), React.createElement('button', { type: 'button', style: closeButtonStyle, onClick: () => setPreview(null), 'aria-label': '关闭 Markdown 预览' }, '关闭')),
          preview.error !== null ? React.createElement('p', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, `预览失败：${preview.error}`) : preview.text === null ? React.createElement('p', { role: 'status', style: mutedStyle }, '加载预览…') : React.createElement(MarkdownText, { text: preview.text }),
        ),
      )
    }
    function MediaToolView({ block, sessionId, sessions, readMedia, mediaSettings }) {
      const preview = previewFromBlock(block)
      const preferences = mediaPreferences(useSettingsSnapshot(mediaSettings))
      const path = preview?.kind === 'image' ? preview.path ?? pathFromArgs(block.argsRaw ?? block.call?.argsRaw ?? '') : preview?.name ?? pathFromArgs(block.argsRaw ?? block.call?.argsRaw ?? '')
      const title = preview?.kind === 'audio' ? `展示音频 · ${path}` : preview?.kind === 'video' ? `展示视频 · ${path}` : preview?.kind === 'image' ? `展示图片 · ${path}` : '展示媒体'
      const summary = preview?.kind === 'image' ? `${preview.attachment.width} × ${preview.attachment.height}` : preview?.kind === 'audio' || preview?.kind === 'video' ? `${Math.ceil(preview.bytes / 1024 / 1024)} MiB` : ('kind' in block && block.isError ? '展示失败' : '正在准备…')
      return React.createElement('section', { 'data-dsh-chat-enhancement': preview?.kind ?? 'media', style: cardStyle }, React.createElement('div', { style: { fontWeight: 600 } }, title), React.createElement('div', { style: mutedStyle }, summary), preview?.kind === 'image' && React.createElement(ImagePreview, { sessionId, attachment: preview.attachment, sessions }), preview?.kind === 'video' && React.createElement(VideoPreview, { sessionId, preview, readMedia, autoplay: preferences.videoAutoplay }), preview?.kind === 'audio' && React.createElement(AudioPreview, { sessionId, preview, readMedia, autoplay: preferences.audioAutoplay }))
    }
    function toolGroupKey(rows) { return rows.map((row) => row.dataset.chatFlowKey).join('|') }
    function isGroupedActivity(kind) { return kind === 'tool-call' || kind === 'context' }
    function isDisplayToolRow(row) { return row.querySelector('[data-dsh-chat-enhancement]') !== null }
    function inlineTrailingActivity(row, button, inlineRows) { const content = [...row.children].find((child) => child !== button) ?? null; Object.assign(row.style, { alignItems: 'center', display: 'flex', flexDirection: 'row', gap: '8px' }); if (content !== null) Object.assign(content.style, { flex: '1 1 auto', minWidth: '0' }); button.style.flex = '0 0 auto'; button.style.width = 'auto'; if (button.parentElement !== row || button.nextElementSibling !== content) row.insertBefore(button, content); inlineRows.set(row, content) }
    function clearInlineTrailingActivity(row, content) { row.style.alignItems = ''; row.style.display = ''; row.style.flexDirection = ''; row.style.gap = ''; if (content !== null) { content.style.flex = ''; content.style.minWidth = '' } }
    function createActivityGroupController({ toggleKey, parentNodes, rowsForParent, isActivity, groupKey, label }) {
      return function ActivityGroupController() {
        const groupsRef = React.useRef(new Map())
        const expandedRef = React.useRef(new Set())
        const inlineRowsRef = React.useRef(new Map())
        React.useEffect(() => {
          let frame = null
          const schedule = () => { if (frame !== null) return; frame = requestAnimationFrame(() => { frame = null; sync() }) }
          const sync = () => {
            const previous = groupsRef.current; const next = new Map(); const nextRows = new Set(); const nextInlineRows = new Map()
            for (const parent of parentNodes()) {
              const children = rowsForParent(parent).filter((child) => child.dataset[toggleKey] === undefined)
              let run = []
              const flush = () => {
                if (run.length < 3) return
                const trailingRow = run.at(-1); const hiddenRows = run.slice(0, -1); const key = groupKey(hiddenRows); const expanded = expandedRef.current.has(key)
                const group = previous.get(key) ?? { button: document.createElement('button'), rows: [] }
                group.rows = hiddenRows; group.button.type = 'button'; group.button.dataset[toggleKey] = key
                Object.assign(group.button.style, toolGroupButtonStyle); group.button.setAttribute('aria-expanded', String(expanded)); group.button.textContent = `${expanded ? '⌄' : '›'} ${label(hiddenRows.length)}`
                group.button.onclick = (event) => { event.preventDefault(); event.stopPropagation(); if (expandedRef.current.has(key)) expandedRef.current.delete(key); else expandedRef.current.add(key); sync() }
                if (!expanded) inlineTrailingActivity(trailingRow, group.button, nextInlineRows); else { group.button.style.flex = ''; group.button.style.width = '100%'; const buttonParent = hiddenRows[0]?.parentElement ?? parent; if (group.button.parentElement !== buttonParent || group.button.nextElementSibling !== hiddenRows[0]) buttonParent.insertBefore(group.button, hiddenRows[0]) }
                for (const row of hiddenRows) row.hidden = !expanded
                for (const row of hiddenRows) nextRows.add(row)
                next.set(key, group)
              }
              for (const child of children) { if (isActivity(child)) run.push(child); else { flush(); run = [] } }
              flush()
            }
            for (const [key, group] of previous) { if (next.has(key)) continue; group.button.remove(); for (const row of group.rows) { if (!nextRows.has(row)) row.hidden = false }; expandedRef.current.delete(key) }
            for (const [row, content] of inlineRowsRef.current) { if (!nextInlineRows.has(row)) clearInlineTrailingActivity(row, content) }
            groupsRef.current = next
            inlineRowsRef.current = nextInlineRows
          }
          const observer = new MutationObserver((records) => { if (records.some((record) => !(record.target instanceof Element && record.target.closest(`[data-${toggleKey.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}]`) !== null))) schedule() })
          observer.observe(document.body, { childList: true, subtree: true }); schedule()
          return () => { observer.disconnect(); if (frame !== null) cancelAnimationFrame(frame); for (const group of groupsRef.current.values()) { group.button.remove(); for (const row of group.rows) row.hidden = false }; for (const [row, content] of inlineRowsRef.current) clearInlineTrailingActivity(row, content); groupsRef.current.clear(); expandedRef.current.clear(); inlineRowsRef.current.clear() }
        }, [])
        return null
      }
    }
    const ToolCallActivityGroupController = createActivityGroupController({ toggleKey: 'dshChatEnhancementToolGroupToggle', parentNodes: () => document.querySelectorAll('[data-chat-flow]'), rowsForParent: (parent) => [...parent.children], isActivity: (row) => isGroupedActivity(row.dataset.chatFlowKind) && !isDisplayToolRow(row), groupKey: toolGroupKey, label: (count) => `已执行 ${count} 项操作` })
    function reasoningGroupKey(rows) { return rows.map((row) => { const flow = row.closest('[data-chat-flow-key]'); if (flow === null) return row.textContent ?? ''; const index = [...flow.querySelectorAll('[data-variant="think"]')].indexOf(row); return `${flow.dataset.chatFlowKey ?? ''}:think:${index}` }).join('|') }
    const ThinkingActivityGroupController = createActivityGroupController({ toggleKey: 'dshChatEnhancementThinkingGroupToggle', parentNodes: () => document.querySelectorAll('[data-chat-flow-key]'), rowsForParent: (parent) => [...parent.querySelectorAll('[data-variant="think"]')], isActivity: (row) => row.dataset.variant === 'think', groupKey: reasoningGroupKey, label: (count) => `已完成 ${count} 项思考` })
    function ToolCallGroupController() { return React.createElement(ToolCallActivityGroupController) }
    function ThinkingGroupController() { return React.createElement(ThinkingActivityGroupController) }
    const requestSchema = { parse(value) { if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof value.sessionId !== 'string' || typeof value.token !== 'string') throw new TypeError('media request is invalid.'); return { sessionId: value.sessionId, token: value.token } } }
    const resultSchema = { parse(value) { if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof value.mediaType !== 'string' || typeof value.name !== 'string' || typeof value.dataBase64 !== 'string') throw new TypeError('media result is invalid.'); return value } }
    const markdownRequestSchema = { parse(value) { if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof value.sessionId !== 'string' || typeof value.path !== 'string') throw new TypeError('Markdown request is invalid.'); return { sessionId: value.sessionId, path: value.path } } }
    const markdownResultSchema = { parse(value) { if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof value.name !== 'string' || typeof value.text !== 'string') throw new TypeError('Markdown result is invalid.'); return value } }
    const previewRemote = { package: 'dsh-chat-enhancement', descriptors: [
      { id: 'dsh-chat-enhancement#chatMedia/read', service: 'chatMedia', namespace: 'chatMedia', method: 'read', invocation: { kind: 'direct' }, parameters: [{ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatMediaRequest', schema: requestSchema } }], result: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatMediaResult', schema: resultSchema } },
      { id: 'dsh-chat-enhancement#chatMarkdown/read', service: 'chatMarkdown', namespace: 'chatMarkdown', method: 'read', invocation: { kind: 'direct' }, parameters: [{ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatMarkdownRequest', schema: markdownRequestSchema } }], result: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatMarkdownResult', schema: markdownResultSchema } },
    ] }
    const inject = ['slots', 'sessions', 'remote', 'settingsScope']
    async function apply(ctx) {
      const dispose = await ctx.remote.$mount(previewRemote)
      const sessions = ctx.get('sessions')
      const mediaSettings = ctx.settingsScope.bind({ namespace: 'chat-enhancement' })
      const mediaService = ctx.reflect.get('remote.chatMedia')
      const markdownService = ctx.reflect.get('remote.chatMarkdown')
      if (sessions === undefined || mediaService?.read === undefined || markdownService?.read === undefined) throw new Error('dsh-chat-enhancement preview services are unavailable.')
      const readMedia = async (request) => { const result = await mediaService.read(request); if (!result.ok || result.value === undefined) throw new Error(result.error?.message ?? '媒体读取失败。'); return result.value }
      const readMarkdown = async (request) => { const result = await markdownService.read(request); if (!result.ok || result.value === undefined) throw new Error(result.error?.message ?? 'Markdown 读取失败。'); return result.value }
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'chat-enhancement-markdown-preview', order: 100, inject: () => ({ readMarkdown }) }, MarkdownPreviewController))
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'chat-enhancement-tool-groups', order: 101 }, ToolCallGroupController))
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'chat-enhancement-thinking-groups', order: 102 }, ThinkingGroupController))
      ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'chat-enhancement-media', order: 65, label: () => '媒体播放', inject: () => ({ mediaSettings }) }, MediaSettingsSection))
      for (const key of ['read_image', 'show_image', 'show_video', 'show_audio']) ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key, locale: 'conversation' }, (props) => React.createElement(MediaToolView, { ...props, sessions, readMedia, mediaSettings })))
      return dispose
    }
    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
