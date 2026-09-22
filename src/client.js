/** Browser entry for the chat-enhancement DSH bundle. */

import * as React from 'react'
import { installCodeReferences } from './code-references-client.js'
import { QuestionRichContent, questionContentLocales, questionContentCss } from './question-content.js'
import { recoveryDescriptor, recoveryLocales, recoveryCss, SessionRecoveryPrompt } from './session-recovery-client.js'
import { AnnotationController, appendAnnotation, annotationLocales } from './annotations.js'
import { AUTO_LANGUAGE, DEFAULT_ANCHOR_MODE, LANGUAGE_ANCHOR_MODES, LANGUAGES, languageAnchorMode, languageEntry } from './languages.js'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'

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
const imageDialogActionStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', width: '40px', height: '40px', border: '1px solid rgb(255 255 255 / 24%)', borderRadius: '8px', padding: '8px', background: 'rgb(20 20 20 / 72%)', color: '#fff', cursor: 'pointer', font: 'inherit', textDecoration: 'none' }
const imageActionPaths = {
  download: 'M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4',
  floating: 'M4 4h16v16H4zM12 12h6v6h-6z',
  fullscreen: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  close: 'm6 6 12 12M18 6 6 18',
}

function imageActionIcon(action) {
  return React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false }, React.createElement('path', { d: imageActionPaths[action] }))
}

const imageDialogNavStyle = { position: 'absolute', top: '50%', zIndex: 2, width: '42px', height: '42px', transform: 'translateY(-50%)', border: '1px solid rgb(255 255 255 / 20%)', borderRadius: '999px', background: 'rgb(20 20 20 / 62%)', color: '#fff', cursor: 'pointer', fontSize: '24px' }
const imageFloatingStyle = { position: 'fixed', top: 'max(16px, env(safe-area-inset-top))', right: 'max(16px, env(safe-area-inset-right))', zIndex: 1000, display: 'grid', placeItems: 'center', width: 'min(720px, calc(100vw - 32px))', overflow: 'hidden', border: '1px solid var(--dsw-alias-line-primary)', borderRadius: '12px', background: 'rgb(8 20 36 / 96%)', boxShadow: '0 20px 48px rgb(0 0 0 / 45%)', touchAction: 'pan-y' }
const imageResizeHandleStyle = { position: 'absolute', right: 0, bottom: 0, left: 0, zIndex: 3, display: 'grid', placeItems: 'center', height: '18px', border: 0, padding: 0, background: 'rgb(8 20 36 / 72%)', cursor: 'ns-resize', touchAction: 'none' }
const imageResizeLineStyle = { width: '72px', height: '3px', borderRadius: '999px', background: 'rgb(255 255 255 / 52%)' }
const settingsSectionStyle = { display: 'grid', gap: '18px', minWidth: 0 }
const settingsRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', padding: '14px 0', borderBottom: '1px solid var(--dsw-alias-line-primary)' }
const settingsGroupStyle = { margin: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: '13px', fontWeight: 500 }
const languageTriggerContentStyle = { display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }
const languageTriggerLabelStyle = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const turnModelStyle = { display: 'inline-flex', alignItems: 'center', maxWidth: 'min(240px, 40vw)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px', lineHeight: 1.4 }

/** Track media results observed by one mounted chat so history hydration cannot request playback. */
export function createMediaAutoplayGate() {
  const observedCallIds = new Set()
  let openedAt = Number.POSITIVE_INFINITY
  return {
    markReady(time = Date.now()) { openedAt = time },
    observe(callId, resultTime, enabled, running) {
      if (observedCallIds.has(callId)) return false
      observedCallIds.add(callId)
      return resultTime >= openedAt && enabled && running
    },
  }
}

const mediaAutoplayGates = new Map()

function mediaAutoplayGate(sessionId) {
  let gate = mediaAutoplayGates.get(sessionId)
  if (gate === undefined) {
    gate = createMediaAutoplayGate()
    mediaAutoplayGates.set(sessionId, gate)
  }
  return gate
}

function MediaAutoplaySessionController({ sessionId }) {
  const gate = mediaAutoplayGate(sessionId)
  React.useEffect(() => {
    let mounted = true
    queueMicrotask(() => { if (mounted) gate.markReady() })
    return () => { mounted = false; mediaAutoplayGates.delete(sessionId) }
  }, [gate, sessionId])
  return null
}

function pathFromArgs(argsRaw) {
  try {
    const parsed = JSON.parse(argsRaw)
    return typeof parsed.file_path === 'string' ? parsed.file_path : '媒体'
  } catch { return '媒体' }
}

function previewFromBlock(block) {
  if (!('kind' in block)) return null
  const image = block.content.find(part => part.type === 'image')?.attachment
  if (image !== undefined) return { kind: 'image', attachment: image, path: null }
  for (const part of block.content) {
    if (part.type !== 'text') continue
    try {
      const marker = JSON.parse(part.text)
      if (marker?.type === 'dsh-chat-enhancement/image' && marker.attachment !== null && typeof marker.attachment === 'object') {
        return { kind: 'image', attachment: marker.attachment, path: typeof marker.path === 'string' ? marker.path : null }
      }
      if (marker?.type === 'dsh-chat-enhancement/video' && typeof marker.token === 'string' && typeof marker.mediaType === 'string' && typeof marker.name === 'string') {
        return { kind: 'video', token: marker.token, mediaType: marker.mediaType, name: marker.name, bytes: typeof marker.bytes === 'number' ? marker.bytes : 0 }
      }
      if (marker?.type === 'dsh-chat-enhancement/audio' && typeof marker.token === 'string' && typeof marker.mediaType === 'string' && typeof marker.name === 'string') {
        return { kind: 'audio', token: marker.token, mediaType: marker.mediaType, name: marker.name, bytes: typeof marker.bytes === 'number' ? marker.bytes : 0 }
      }
    } catch {}
  }
  return null
}

function useObjectUrl(load, dependencies) {
  const [state, setState] = React.useState({ url: null, error: null })
  React.useEffect(() => {
    if (load === null) return undefined
    let disposed = false
    let objectUrl = null
    setState({ url: null, error: null })
    void load().then(({ data, mediaType }) => {
      if (disposed) return
      objectUrl = URL.createObjectURL(new Blob([data], { type: mediaType }))
      setState({ url: objectUrl, error: null })
    }).catch((error) => {
      if (!disposed) setState({ url: null, error: error instanceof Error ? error.message : String(error) })
    })
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

function decodeBase64(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function isMarkdownPath(path) {
  return /\.(?:md|markdown)$/iu.test(path.trim())
}

function markdownPathFromClick(target) {
  if (!(target instanceof Element)) return null
  const button = target.closest('button[title]')
  if (button === null || button.closest('[data-dsh-chat-enhancement-markdown]') !== null) return null
  const path = button.getAttribute('title')
  return path !== null && isMarkdownPath(path) ? path : null
}

function displayName(path) {
  return path.split(/[\\/]/u).filter(Boolean).at(-1) ?? path
}

function useMediaUrl(sessionId, preview, readMedia) {
  const load = preview === null ? null : async () => {
    const result = await readMedia({ sessionId, token: preview.token })
    return { data: decodeBase64(result.dataBase64), mediaType: result.mediaType }
  }
  return useObjectUrl(load, [preview, readMedia, sessionId])
}

function imageGallery(sessionId) {
  return [...document.querySelectorAll('[data-dsh-image-preview]')]
    .filter(element => element.dataset.dshImageSession === sessionId && element.offsetParent !== null)
    .map(element => ({ url: element.dataset.dshImageUrl, name: element.dataset.dshImageName }))
    .filter(item => typeof item.url === 'string' && typeof item.name === 'string')
}

function ImagePreviewDialog({ sessionId, initial, onClose }) {
  const [current, setCurrent] = React.useState(initial)
  const [floating, setFloating] = React.useState(false)
  const [floatingHeightRatio, setFloatingHeightRatio] = React.useState(0.38)
  const [controlsVisible, setControlsVisible] = React.useState(true)
  const pointerStart = React.useRef(null)
  const swiped = React.useRef(false)
  const resizePointer = React.useRef(null)
  const currentRef = React.useRef(current)
  const followingLatest = React.useRef(false)
  currentRef.current = current
  const navigate = (offset) => {
    const images = imageGallery(sessionId)
    const index = images.findIndex(image => image.url === current.url)
    const nextIndex = index + offset
    if (index >= 0 && nextIndex >= 0 && nextIndex < images.length) {
      followingLatest.current = nextIndex === images.length - 1
      setCurrent(images[nextIndex])
    }
  }
  const images = imageGallery(sessionId)
  const index = images.findIndex(image => image.url === current.url)
  const hasPrevious = index > 0
  const hasNext = index >= 0 && index < images.length - 1
  const resizeFloating = (event) => {
    if (resizePointer.current !== event.pointerId) return
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    const nextRatio = Math.min(0.78, Math.max(0.2, (event.clientY - 16) / viewportHeight))
    setFloatingHeightRatio(nextRatio)
  }
  React.useEffect(() => {
    const initialImages = imageGallery(sessionId)
    followingLatest.current = initialImages.length > 0 && initialImages.findIndex(image => image.url === initial.url) === initialImages.length - 1
    const observer = new MutationObserver(() => {
      if (!followingLatest.current) return
      const latest = imageGallery(sessionId).at(-1)
      if (latest !== undefined && latest.url !== currentRef.current.url) setCurrent(latest)
    })
    observer.observe(document.body, { attributes: true, childList: true, subtree: true })
    return () => { observer.disconnect() }
  }, [initial.url, sessionId])
  React.useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') navigate(-1)
      else if (event.key === 'ArrowRight') navigate(1)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [current, onClose])
  return React.createElement('div', {
    role: 'dialog', 'aria-modal': !floating, 'aria-label': current.name, style: floating ? { ...imageFloatingStyle, height: `clamp(180px, ${Math.round(floatingHeightRatio * 100)}dvh, calc(100dvh - 32px))` } : imageDialogStyle, onClick: floating ? undefined : onClose,
    onPointerDown: event => { pointerStart.current = event.clientX; swiped.current = false },
    onPointerUp: event => {
      if (pointerStart.current === null) return
      const distance = event.clientX - pointerStart.current
      pointerStart.current = null
      if (Math.abs(distance) > 50) swiped.current = true
      if (distance > 50) navigate(-1)
      else if (distance < -50) navigate(1)
    },
  },
  controlsVisible && React.createElement('button', { type: 'button', style: { ...imageDialogActionStyle, ...imageDialogModeStyle }, onClick: event => { event.stopPropagation(); setFloating(value => !value) }, 'aria-label': floating ? '返回全屏预览' : '切换为悬浮预览', title: floating ? '返回全屏预览' : '切换为悬浮预览' }, imageActionIcon(floating ? 'fullscreen' : 'floating')),
  controlsVisible && React.createElement('div', { style: imageDialogToolbarStyle, onClick: event => event.stopPropagation() },
    React.createElement('a', { href: current.url, download: current.name, style: imageDialogActionStyle, 'aria-label': '下载图片', title: '下载图片' }, imageActionIcon('download')),
    React.createElement('button', { type: 'button', style: imageDialogActionStyle, onClick: onClose, 'aria-label': '关闭图片预览', title: '关闭图片预览' }, imageActionIcon('close'))),
  controlsVisible && hasPrevious && React.createElement('button', { type: 'button', style: { ...imageDialogNavStyle, left: 'max(12px, env(safe-area-inset-left))' }, onClick: event => { event.stopPropagation(); navigate(-1) }, 'aria-label': '上一张' }, '‹'),
  React.createElement('img', { src: current.url, alt: current.name, draggable: false, role: 'button', tabIndex: 0, 'aria-label': controlsVisible ? '隐藏图片预览控件' : '显示图片预览控件', onClick: event => { event.stopPropagation(); if (swiped.current) { swiped.current = false; return }; setControlsVisible(value => !value) }, onKeyDown: event => { if (event.key !== 'Enter' && event.key !== ' ') return; event.preventDefault(); setControlsVisible(value => !value) }, style: floating
    ? { display: 'block', width: '100%', height: 'calc(100% - 18px)', minWidth: 0, minHeight: 0, objectFit: 'contain', userSelect: 'none' }
    : { display: 'block', maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', objectFit: 'contain', userSelect: 'none' } }),
  controlsVisible && hasNext && React.createElement('button', { type: 'button', style: { ...imageDialogNavStyle, right: 'max(12px, env(safe-area-inset-right))' }, onClick: event => { event.stopPropagation(); navigate(1) }, 'aria-label': '下一张' }, '›'),
  controlsVisible && images.length > 1 && React.createElement('div', { style: { position: 'absolute', bottom: floating ? '22px' : 'max(12px, env(safe-area-inset-bottom))', color: '#fff', fontSize: '13px' } }, `${index + 1} / ${images.length}`),
  controlsVisible && floating && React.createElement('button', {
    type: 'button', role: 'separator', 'aria-orientation': 'horizontal', 'aria-label': '调整悬浮预览高度', 'aria-valuemin': 20, 'aria-valuemax': 78, 'aria-valuenow': Math.round(floatingHeightRatio * 100), style: imageResizeHandleStyle,
    onPointerDown: event => { event.preventDefault(); event.stopPropagation(); resizePointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId) },
    onPointerMove: event => { event.stopPropagation(); resizeFloating(event) },
    onPointerUp: event => { event.stopPropagation(); resizePointer.current = null; event.currentTarget.releasePointerCapture(event.pointerId) },
    onPointerCancel: event => { event.stopPropagation(); resizePointer.current = null },
    onKeyDown: event => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
      event.preventDefault()
      setFloatingHeightRatio(value => Math.min(0.78, Math.max(0.2, value + (event.key === 'ArrowDown' ? 0.05 : -0.05))))
    },
  }, React.createElement('span', { style: imageResizeLineStyle })))
}

function ImagePreview({ sessionId, attachment, sessions }) {
  const { url, error } = useImageUrl(sessionId, attachment, sessions)
  const [open, setOpen] = React.useState(false)
  if (error !== null) return React.createElement('span', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, `预览失败：${error}`)
  if (url === null) return React.createElement('span', { role: 'status', style: mutedStyle }, '加载预览…')
  const name = attachment.name ?? '图片'
  return React.createElement(React.Fragment, null,
    React.createElement('button', { type: 'button', 'data-dsh-image-preview': true, 'data-dsh-image-session': sessionId, 'data-dsh-image-url': url, 'data-dsh-image-name': name, onClick: () => setOpen(true), style: { display: 'block', border: 0, padding: 0, background: 'none', cursor: 'zoom-in' }, 'aria-label': `预览原图 ${name}` },
      React.createElement('img', { src: url, alt: `${name}预览`, style: { display: 'block', maxWidth: '240px', maxHeight: '180px', borderRadius: '8px', objectFit: 'contain' } })),
    open && React.createElement(ImagePreviewDialog, { sessionId, initial: { url, name }, onClose: () => setOpen(false) })
  )
}

function VideoPreview({ sessionId, preview, readMedia, shouldAutoplay }) {
  const { url, error } = useMediaUrl(sessionId, preview, readMedia)
  const player = React.useRef(null)
  React.useEffect(() => {
    if (!shouldAutoplay || url === null) return
    void player.current?.play().catch(() => {})
  }, [shouldAutoplay, url])
  if (error !== null) return React.createElement('span', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, `播放失败：${error}`)
  if (url === null) return React.createElement('span', { role: 'status', style: mutedStyle }, '加载视频…')
  return React.createElement('video', { ref: player, controls: true, preload: 'metadata', src: url, style: { display: 'block', maxWidth: '360px', maxHeight: '240px', borderRadius: '8px' } })
}

function AudioPreview({ sessionId, preview, readMedia, shouldAutoplay }) {
  const { url, error } = useMediaUrl(sessionId, preview, readMedia)
  const player = React.useRef(null)
  React.useEffect(() => {
    if (!shouldAutoplay || url === null) return
    void player.current?.play().catch(() => {})
  }, [shouldAutoplay, url])
  if (error !== null) return React.createElement('span', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, `播放失败：${error}`)
  if (url === null) return React.createElement('span', { role: 'status', style: mutedStyle }, '加载音频…')
  return React.createElement('audio', { ref: player, controls: true, preload: 'metadata', src: url, style: { display: 'block', width: 'min(100%, 420px)' } })
}

function useSettingsSnapshot(scope) {
  const subscribe = React.useCallback(listener => scope.subscribe(listener), [scope])
  const getSnapshot = React.useCallback(() => scope.getSnapshot(), [scope])
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * Schema defaults, repeated so a section renders before the settings transport
 * answers and after it fails. Kept in step with the Host schema by the tests.
 */
const SETTINGS_DEFAULTS = {
  audioAutoplay: false,
  videoAutoplay: false,
  language: AUTO_LANGUAGE,
  languageAnchor: DEFAULT_ANCHOR_MODE,
  toolDescriptions: true,
  expandReasoningWhileRunning: false,
  reasoningCollapseDelayMs: 3000,
}

/**
 * Menu rows projected from the shared catalogs. Built once, because the
 * primitive only needs `{ id, label }` and a fresh array per render would make
 * its props comparison see a change on every keystroke elsewhere in settings.
 */
const LANGUAGE_MENU_ITEMS = LANGUAGES.map(language => ({ id: language.id, label: language.label }))
const ANCHOR_MENU_ITEMS = LANGUAGE_ANCHOR_MODES.map(mode => ({ id: mode.id, label: mode.label }))

/** Resolve one settings snapshot to a complete preference object. */
function settingsPreferences(snapshot) {
  const value = snapshot.status === 'ready' ? snapshot.value : undefined
  return value === null || typeof value !== 'object' ? SETTINGS_DEFAULTS : { ...SETTINGS_DEFAULTS, ...value }
}

/**
 * Themed picker for one enum-valued setting.
 *
 * A native `<select>` is not usable here: the browser paints its popup with OS
 * chrome and ignores `--dsw-*` tokens, so the list stays light on a dark theme
 * (and dark on a light one). The list is therefore the DSH `Menu` primitive —
 * the same one the General section's Language row uses — anchored to a
 * token-styled `Button`, which also supplies the hover and disabled states.
 *
 * `items` must be a stable array: the primitive compares props for identity, so
 * a list rebuilt per render would reopen the menu on every unrelated keystroke.
 * @param field - the settings key this picker writes.
 * @param items - `{ id, label }` options.
 * @param labelOf - resolves the selected id to its display label.
 * @param ariaLabel - the row's accessible name, prefixed to the active label.
 */
function SettingPicker({ chatSettings, field, selected, items, labelOf, ariaLabel, writable }) {
  const [open, setOpen] = React.useState(false)
  const activeLabel = labelOf(selected)
  return React.createElement(Menu, {
    open,
    onClose: () => { setOpen(false) },
    items,
    selectedId: selected,
    align: 'end',
    // The settings panel scrolls and clips; a portal keeps the list from being
    // cropped by that ancestor.
    portal: true,
    onSelect: (id) => { setOpen(false); void chatSettings.set(field, id) },
    anchor: React.createElement(Button, {
      variant: 'outline',
      size: 'sm',
      disabled: !writable,
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      'aria-label': `${ariaLabel}：${activeLabel}`,
      onClick: () => { setOpen(value => !value) },
    }, React.createElement('span', { style: languageTriggerContentStyle },
      React.createElement('span', { style: languageTriggerLabelStyle }, activeLabel),
      React.createElement(IconChevronDownOutline14))),
  })
}

/**
 * The plugin's single settings page — one nav entry, every preference inside.
 *
 * The language row is Host-backed and feeds a system-prompt section, so it
 * survives a reload and applies to every session on this machine rather than
 * only the open tab. It is deliberately separate from the General section's
 * Language row, which switches interface copy.
 */
function ChatEnhancementSettingsSection({ chatSettings }) {
  const snapshot = useSettingsSnapshot(chatSettings)
  const preferences = settingsPreferences(snapshot)
  const writable = snapshot.status === 'ready' && snapshot.writable
  // An id this build no longer knows (a hand-edited document, or a language
  // removed by a downgrade) must not blank the picker: resolve it to `auto`,
  // the same fallback the Host applies when it builds the instruction.
  const selected = languageEntry(preferences.language).id
  const selectedAnchor = languageAnchorMode(preferences.languageAnchor)
  // With no language constraint there is nothing to drift out of, so the anchor
  // row cannot do anything. Show it disabled rather than hiding it, so the
  // setting stays discoverable and the reason is stated in place.
  const anchorUsable = writable && selected !== AUTO_LANGUAGE
  const toggle = (field, label) => React.createElement('label', { style: settingsRowStyle },
    React.createElement('span', null, label),
    React.createElement(Switch, { label, checked: preferences[field], disabled: !writable, onChange: checked => { void chatSettings.set(field, checked) } }))
  return React.createElement('section', { style: settingsSectionStyle },
    React.createElement('h2', null, '对话增强'),
    React.createElement('div', { style: settingsRowStyle },
      React.createElement('span', null, '思考与回复语言'),
      React.createElement(SettingPicker, {
        chatSettings,
        field: 'language',
        selected,
        items: LANGUAGE_MENU_ITEMS,
        labelOf: id => languageEntry(id).label,
        ariaLabel: '思考与回复语言',
        writable,
      })),
    React.createElement('p', { style: mutedStyle }, '约束模型思考与回复使用的语言，与「通用设置」里的界面语言互不影响。选择「跟随对话」时不注入任何额外约束。改动从下一个模型步骤起生效，不必重开会话或重启 DSH；代码、路径、命令、日志与引文原文始终保留原样，不翻译。需要在某一轮临时改用别的语言，直接在对话里说即可。极少数对语言指令遵循很弱的模型可能仍用英文思考——那属于模型行为，不是本设置未生效。'),
    React.createElement('div', { style: settingsRowStyle },
      React.createElement('span', null, '语言漂移提醒'),
      React.createElement(SettingPicker, {
        chatSettings,
        field: 'languageAnchor',
        selected: selectedAnchor,
        items: ANCHOR_MENU_ITEMS,
        labelOf: id => LANGUAGE_ANCHOR_MODES.find(mode => mode.id === languageAnchorMode(id)).label,
        ariaLabel: '语言漂移提醒',
        writable: anchorUsable,
      })),
    React.createElement('p', { style: mutedStyle }, anchorUsable
      ? '系统提示里的语言约束对普通回复通常够用，但长链路任务（连续几十次工具调用）里模型仍可能悄悄换回英文思考。本设置会让插件在每一步开始前检查上一步回复的汉字占比，发现漂移就在下一条消息里补一句目标语言的原话提醒。提醒会留在对话历史里，之后每一步都会连同上下文一起被发送，所以默认只在真的漂移时才触发；「每一步都提醒」更稳但更费上下文，「不提醒」则完全不注入。'
      : '当前语言是「跟随对话」，没有可漂移的目标语言，这项设置暂不生效。先在上面选定一个具体语言。'),
    React.createElement('h3', { style: settingsGroupStyle }, '思考行'),
    toggle('expandReasoningWhileRunning', '推理中自动展开'),
    React.createElement('p', { style: mutedStyle }, `开启后，推理中的 Thinking 行自动展开；推理结束后保持 ${preferences.reasoningCollapseDelayMs / 1000} 秒，再自动折叠。手动展开的行保持展开；关闭本开关会立即收起自动展开的行。`),
    React.createElement('h3', { style: settingsGroupStyle }, '工具行与后台任务'),
    toggle('toolDescriptions', '显示模型自述的本次调用说明'),
    React.createElement('p', { style: mutedStyle }, '让模型用 description 说明本次调用。后台 bash、pwsh 任务优先显示这句说明，悬停可查看原命令；缺少说明时显示命令。后台列表由插件提供，普通工具行的说明显示仍需 patches/ 中的官方补丁。'),
    React.createElement('h3', { style: settingsGroupStyle }, '媒体展示'),
    toggle('audioAutoplay', 'Agent 展示音频时自动播放'),
    toggle('videoAutoplay', 'Agent 展示视频时自动播放'),
    React.createElement('p', { style: mutedStyle }, '只在当前聊天已打开后，Agent 新完成展示调用时尝试播放；进入聊天或恢复历史消息不会播放。浏览器仍可能阻止未交互页面的有声自动播放。'))
}

function MarkdownPreviewController({ sessionId, readMarkdown, t }) {
  const labels = React.useMemo(() => ({ code: { copyLabel: t('markdown.copy'), copiedLabel: t('markdown.copied') }, footnotes: t('markdown.footnotes') }), [t])
  const [preview, setPreview] = React.useState(null)
  React.useEffect(() => {
    const onClick = (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      const path = markdownPathFromClick(event.target)
      if (path === null) return
      event.preventDefault()
      event.stopPropagation()
      setPreview({ path, name: displayName(path), text: null, error: null })
      void readMarkdown({ sessionId, path }).then((value) => {
        setPreview(current => current?.path === path ? { path, name: value.name, text: value.text, error: null } : current)
      }).catch((error) => {
        setPreview(current => current?.path === path ? { path, name: displayName(path), text: null, error: error instanceof Error ? error.message : String(error) } : current)
      })
    }
    document.addEventListener('click', onClick, true)
    return () => { document.removeEventListener('click', onClick, true) }
  }, [readMarkdown, sessionId])
  if (preview === null) return null
  return React.createElement('div', { 'data-dsh-chat-enhancement-markdown': true, role: 'dialog', 'aria-modal': true, 'aria-label': preview.name, style: overlayStyle, onClick: () => setPreview(null) },
    React.createElement('article', { style: markdownDialogStyle, onClick: event => event.stopPropagation() },
      React.createElement('header', { style: markdownHeaderStyle },
        React.createElement('strong', null, preview.name),
        React.createElement('button', { type: 'button', style: closeButtonStyle, onClick: () => setPreview(null), 'aria-label': '关闭 Markdown 预览' }, '关闭')),
      preview.error !== null
        ? React.createElement('p', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, `预览失败：${preview.error}`)
        : preview.text === null
          ? React.createElement('p', { role: 'status', style: mutedStyle }, '加载预览…')
          : React.createElement(MarkdownText, { text: preview.text, labels }),
    ),
  )
}

function MediaToolView({ block, callId, sessionId, useSession, sessions, readMedia, chatSettings }) {
  const preview = previewFromBlock(block)
  const preferences = settingsPreferences(useSettingsSnapshot(chatSettings))
  const running = useSession(snapshot => snapshot.running)
  const autoplayEnabled = preview?.kind === 'audio' ? preferences.audioAutoplay : preview?.kind === 'video' ? preferences.videoAutoplay : false
  const shouldAutoplay = preview === null ? false : mediaAutoplayGate(sessionId).observe(callId, block.time, autoplayEnabled, running)
  if (preview?.kind === 'image') {
    return React.createElement('section', { 'data-dsh-chat-enhancement': 'image', style: cardStyle },
      React.createElement(ImagePreview, { sessionId, attachment: preview.attachment, sessions })
    )
  }
  const path = preview?.name ?? pathFromArgs(block.argsRaw ?? block.call?.argsRaw ?? '')
  const title = preview?.kind === 'audio' ? `展示音频 · ${path}` : preview?.kind === 'video' ? `展示视频 · ${path}` : '展示媒体'
  const summary = preview?.kind === 'audio' || preview?.kind === 'video' ? `${Math.ceil(preview.bytes / 1024 / 1024)} MiB` : ('kind' in block && block.isError ? '展示失败' : '正在准备…')
  return React.createElement('section', { 'data-dsh-chat-enhancement': preview?.kind ?? 'media', style: cardStyle },
    React.createElement('div', { style: { fontWeight: 600 } }, title),
    React.createElement('div', { style: mutedStyle }, summary),
    preview?.kind === 'video' && React.createElement(VideoPreview, { sessionId, preview, readMedia, shouldAutoplay }),
    preview?.kind === 'audio' && React.createElement(AudioPreview, { sessionId, preview, readMedia, shouldAutoplay })
  )
}

function toolGroupKey(rows) {
  return rows.map(row => row.dataset.chatFlowKey).join('|')
}

function isGroupedActivity(kind) {
  return kind === 'tool-call' || kind === 'context'
}

function isDisplayToolRow(row) {
  return row.querySelector('[data-dsh-chat-enhancement]') !== null
}

/** Avoid notifying other DOM observers when the presentation is already current. */
function updateActivityStyle(element, styles) {
  for (const [key, value] of Object.entries(styles)) if (element.style[key] !== value) element.style[key] = value
}

function inlineTrailingActivity(row, button, inlineRows) {
  const content = [...row.children].find(child => child !== button) ?? null
  updateActivityStyle(row, { alignItems: 'center', display: 'flex', flexDirection: 'row', gap: '8px' })
  if (content !== null) updateActivityStyle(content, { flex: '1 1 auto', minWidth: '0' })
  updateActivityStyle(button, { flex: '0 0 auto', width: 'auto' })
  if (button.parentElement !== row || button.nextElementSibling !== content) row.insertBefore(button, content)
  inlineRows.set(row, content)
}

function clearInlineTrailingActivity(row, content) {
  row.style.alignItems = ''
  row.style.display = ''
  row.style.flexDirection = ''
  row.style.gap = ''
  if (content !== null) {
    content.style.flex = ''
    content.style.minWidth = ''
  }
}

function createActivityGroupController({ toggleKey, parentNodes, rowsForParent, isActivity, groupKey, label }) {
  return function ActivityGroupController() {
  const groupsRef = React.useRef(new Map())
  const expandedRef = React.useRef(new Set())
  const inlineRowsRef = React.useRef(new Map())
  React.useEffect(() => {
    let frame = null
    const schedule = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        sync()
      })
    }
    const sync = () => {
      const previous = groupsRef.current
      const next = new Map()
      const nextRows = new Set()
      const nextInlineRows = new Map()
      for (const parent of parentNodes()) {
        const children = rowsForParent(parent).filter(child => child.dataset[toggleKey] === undefined)
        let run = []
        const flush = () => {
          if (run.length < 3) return
          const trailingRow = run.at(-1)
          const hiddenRows = run.slice(0, -1)
          const key = groupKey(hiddenRows)
          const expanded = expandedRef.current.has(key)
          const group = previous.get(key) ?? { button: document.createElement('button'), rows: [] }
          group.rows = hiddenRows
          if (!previous.has(key)) {
            group.button.type = 'button'
            group.button.dataset[toggleKey] = key
            updateActivityStyle(group.button, toolGroupButtonStyle)
          }
          if (group.button.getAttribute('aria-expanded') !== String(expanded)) group.button.setAttribute('aria-expanded', String(expanded))
          const nextLabel = `${expanded ? '⌄' : '›'} ${label(hiddenRows.length)}`
          if (group.button.textContent !== nextLabel) group.button.textContent = nextLabel
          group.button.onclick = (event) => {
            event.preventDefault()
            event.stopPropagation()
            if (expandedRef.current.has(key)) expandedRef.current.delete(key)
            else expandedRef.current.add(key)
            sync()
          }
          if (!expanded) inlineTrailingActivity(trailingRow, group.button, nextInlineRows)
          else {
            updateActivityStyle(group.button, { flex: '', width: '100%' })
            const buttonParent = hiddenRows[0]?.parentElement ?? parent
            if (group.button.parentElement !== buttonParent || group.button.nextElementSibling !== hiddenRows[0]) buttonParent.insertBefore(group.button, hiddenRows[0])
          }
          for (const row of hiddenRows) if (row.hidden !== !expanded) row.hidden = !expanded
          for (const row of hiddenRows) nextRows.add(row)
          next.set(key, group)
        }
        for (const child of children) {
          if (isActivity(child)) run.push(child)
          else {
            flush()
            run = []
          }
        }
        flush()
      }
      for (const [key, group] of previous) {
        if (next.has(key)) continue
        group.button.remove()
        for (const row of group.rows) {
          if (!nextRows.has(row)) row.hidden = false
        }
        expandedRef.current.delete(key)
      }
      for (const [row, content] of inlineRowsRef.current) {
        if (!nextInlineRows.has(row)) clearInlineTrailingActivity(row, content)
      }
      groupsRef.current = next
      inlineRowsRef.current = nextInlineRows
    }
    const observer = new MutationObserver(records => {
      const ownButtons = '[data-dsh-chat-enhancement-tool-group-toggle],[data-dsh-chat-enhancement-thinking-group-toggle]'
      if (records.some(record => {
        const target = record.target instanceof Element ? record.target : record.target.parentElement
        if (target?.closest(ownButtons)) return false
        return target?.closest('[data-chat-flow]') || [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element && (node.matches('[data-chat-flow]') || node.querySelector('[data-chat-flow]')))
      })) schedule()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    schedule()
    return () => {
      observer.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
      for (const group of groupsRef.current.values()) {
        group.button.remove()
        for (const row of group.rows) row.hidden = false
      }
      for (const [row, content] of inlineRowsRef.current) clearInlineTrailingActivity(row, content)
      groupsRef.current.clear()
      expandedRef.current.clear()
      inlineRowsRef.current.clear()
    }
  }, [])
  return null
  }
}

const ToolCallActivityGroupController = createActivityGroupController({
  toggleKey: 'dshChatEnhancementToolGroupToggle',
  parentNodes: () => document.querySelectorAll('[data-chat-flow]'),
  rowsForParent: parent => [...parent.children],
  isActivity: row => isGroupedActivity(row.dataset.chatFlowKind) && !isDisplayToolRow(row),
  groupKey: toolGroupKey,
  label: count => `已执行 ${count} 项操作`,
})

function reasoningGroupKey(rows) {
  return rows.map((row) => {
    const flow = row.closest('[data-chat-flow-key]')
    if (flow === null) return row.textContent ?? ''
    const index = [...flow.querySelectorAll('[data-variant="think"]')].indexOf(row)
    return `${flow.dataset.chatFlowKey ?? ''}:think:${index}`
  }).join('|')
}

const ThinkingActivityGroupController = createActivityGroupController({
  toggleKey: 'dshChatEnhancementThinkingGroupToggle',
  parentNodes: () => document.querySelectorAll('[data-chat-flow-key]'),
  rowsForParent: parent => [...parent.querySelectorAll('[data-variant="think"]')],
  isActivity: row => row.dataset.variant === 'think',
  groupKey: reasoningGroupKey,
  label: count => `已完成 ${count} 项思考`,
})

function ToolCallGroupController() {
  return React.createElement(ToolCallActivityGroupController)
}

function ThinkingGroupController() {
  return React.createElement(ThinkingActivityGroupController)
}

/**
 * Rows DSH itself opened, so the controller only closes what it opened.
 *
 * The Think row owns its expanded state in React (`useState(false)`), and the
 * attribute is written from that state — setting it directly would be reverted
 * on the next render. The controller therefore drives the row through its real
 * disclosure target and remembers the rows it expanded; a row the user opened
 * by hand keeps its own state and is never auto-collapsed.
 */
const autoExpandedThinkRows = new WeakSet()

/** The clickable disclosure target of one Think row, if it is expandable. */
function thinkRowTarget(row) {
  const target = row.querySelector('[data-disclosure-row][data-expandable]')
  return target instanceof HTMLElement ? target : null
}

/** Whether one Think row is currently rendered as expanded. */
function thinkRowExpanded(row) {
  return row.dataset.expanded !== undefined
}

/**
 * Expand a streaming Think row and remember that this controller did it.
 * @param row - the `[data-variant="think"]` row to open.
 */
function expandRunningThinkRow(row) {
  const target = thinkRowTarget(row)
  if (target === null || thinkRowExpanded(row)) return
  autoExpandedThinkRows.add(row)
  target.click()
}

/**
 * Collapse a Think row this controller expanded, once its reasoning settled.
 * @param row - the `[data-variant="think"]` row to close.
 */
function collapseSettledThinkRow(row) {
  if (!autoExpandedThinkRows.has(row)) return
  autoExpandedThinkRows.delete(row)
  if (!thinkRowExpanded(row)) return
  thinkRowTarget(row)?.click()
}

/**
 * Drive `推理中自动展开`: open each Think row while its reasoning is streaming
 * and restore the collapsed summary after the configured settling delay.
 *
 * DSH renders every Think row collapsed — the streaming tail follows the
 * latest reasoning line inside a fixed-height summary (`ReasoningRow`). This
 * controller only mirrors that row's own disclosure control, so the expanded
 * body, the 24px collapsed height, and the a11y tree all stay DSH's.
 *
 * @param props.chatSettings - bound settings scope carrying the preference.
 * @returns a controller that renders nothing.
 */
function ReasoningAutoExpandController({ chatSettings }) {
  const preferences = settingsPreferences(useSettingsSnapshot(chatSettings))
  const enabled = preferences.expandReasoningWhileRunning === true
  const delayMs = preferences.reasoningCollapseDelayMs
  React.useEffect(() => {
    if (!enabled) {
      // Turning the preference off closes only the rows this controller opened;
      // a row the user expanded by hand keeps its state.
      for (const row of document.querySelectorAll('[data-variant="think"]')) {
        collapseSettledThinkRow(row)
      }
      return undefined
    }
    let frame = null
    const collapseQueue = createReasoningCollapseQueue(delayMs)
    const schedule = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        sync()
      })
    }
    const sync = () => {
      collapseQueue.sync(document.querySelectorAll('[data-variant="think"]'))
    }
    const observer = new MutationObserver(schedule)
    // `subtree` on the flow column: a Think row appears, flips to `running`,
    // and settles as attributes on nodes DSH already mounted.
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-state', 'data-expanded'], childList: true, subtree: true })
    schedule()
    return () => {
      observer.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
      collapseQueue.dispose()
    }
  }, [enabled, delayMs])
  return null
}

function ReasoningAutoExpandSlot(props) {
  return React.createElement(ReasoningAutoExpandController, props)
}

/** 每行只从首次结束时计时；重新推理、移除或卸载时取消折叠。 */
function createReasoningCollapseQueue(delayMs) {
  const timers = new Map()
  const cancel = row => {
    if (!timers.has(row)) return
    clearTimeout(timers.get(row))
    timers.delete(row)
  }
  return {
    sync(rows) {
      const visible = new Set(rows)
      for (const row of timers.keys()) if (!visible.has(row)) cancel(row)
      for (const row of visible) {
        if (row.dataset.state === 'running') {
          cancel(row)
          expandRunningThinkRow(row)
        } else if (!thinkRowExpanded(row)) {
          cancel(row)
          autoExpandedThinkRows.delete(row)
        } else if (autoExpandedThinkRows.has(row) && !timers.has(row)) {
          timers.set(row, setTimeout(() => {
            timers.delete(row)
            if (row.isConnected && row.dataset.state !== 'running') collapseSettledThinkRow(row)
          }, delayMs))
        }
      }
    },
    dispose() {
      for (const row of timers.keys()) cancel(row)
    },
  }
}

/** 本轮实际使用的模型取自 Trajectory 的 assistant 节点 requestConfig（含 messageId）。 */
function modelForMessage(nodes, messageId) {
  if (!Array.isArray(nodes)) return null
  for (const node of nodes) {
    if (node === null || typeof node !== 'object') continue
    if (node.kind !== 'assistant' || node.messageId !== messageId) continue
    const model = node.requestConfig?.model
    if (typeof model === 'string' && model !== '') {
      return { model, provider: node.requestConfig?.provider, reasoningEffort: node.requestConfig?.reasoningEffort }
    }
  }
  return null
}

/** 展示本轮模型的尾注徽章；取不到模型时不渲染，保持原生尾部不变。 */
function TurnModelBadge({ messageId, useTrajectory, useProjection, useModelDirectory, loadModelDirectory, t }) {
  const redirect = typeof useProjection === 'function' ? useProjection('modelRedirects')?.[messageId] : undefined
  const groups = useModelDirectory(state => state.groups)
  React.useEffect(() => {
    // Directory failures retain the recorded route ids in the badge.
    void loadModelDirectory().catch(() => {})
  }, [loadModelDirectory])
  const label = typeof useTrajectory === 'function'
    ? useTrajectory(snapshot => modelForMessage(snapshot?.eventNodes, messageId))
    : null
  if (label === null) return null
  const provider = groups.find(group => group.id === label.provider)
  const modelName = provider?.models.find(model => model.id === label.model)?.name ?? label.model
  const providerName = provider?.name ?? label.provider
  const routeLabel = [modelName, providerName].filter(part => typeof part === 'string' && part !== '').join(' · ')
  const redirected = redirect?.to.provider === label.provider && redirect?.to.model === label.model
  const originalProvider = redirected ? groups.find(group => group.id === redirect.from.provider) : undefined
  const originalLabel = redirected ? [originalProvider?.models.find(model => model.id === redirect.from.model)?.name ?? redirect.from.model,
    originalProvider?.name ?? redirect.from.provider].join(' · ') : undefined
  const visibleLabel = redirected ? `${t('model.redirected')} · ${routeLabel}` : routeLabel
  const routeDetail = redirected ? `${originalLabel} → ${routeLabel}` : routeLabel
  return React.createElement('span', {
    'data-dsh-chat-enhancement': 'turn-model',
    title: [routeDetail, label.reasoningEffort].filter(Boolean).join(' · '),
    style: turnModelStyle,
  }, visibleLabel)
}

/** 只读取当前运行轮次内最近一次请求；尚未发起请求时不显示上一轮模型。 */
function runningModelForRequest(snapshot, startTime) {
  const requests = snapshot?.requests
  if (!Array.isArray(requests)) return null
  let latest = null
  for (const request of requests) {
    if (request.purpose !== 'assistant') continue
    if (startTime === null ? request.status !== 'running' : request.startedAt < startTime) continue
    if (latest === null || request.startSeq > latest.startSeq) latest = request
  }
  const config = latest?.requestConfig
  return typeof config?.provider === 'string' && typeof config?.model === 'string' ? latest : null
}

/** 运行状态模型来自请求头，工具执行期间保留该轮最近一次实际调用。 */
function RunningModelBadge({ startTime, useTrajectory, useProjection, useModelDirectory, loadModelDirectory, t }) {
  const request = useTrajectory(snapshot => runningModelForRequest(snapshot, startTime))
  const runningRedirect = typeof useProjection === 'function' ? useProjection('runningModelRedirect') : null
  const groups = useModelDirectory(state => state.groups)
  React.useEffect(() => { void loadModelDirectory().catch(() => {}) }, [loadModelDirectory])
  if (request === null) return null
  const route = request.requestConfig
  const provider = groups.find(group => group.id === route.provider)
  const label = `${provider?.models.find(model => model.id === route.model)?.name ?? route.model} · ${provider?.name ?? route.provider}`
  const redirect = runningRedirect != null && runningRedirect.turn === request.turn && runningRedirect.step === request.step ? runningRedirect.record : null
  const redirected = redirect?.to.provider === route.provider && redirect?.to.model === route.model
  const originalProvider = redirected ? groups.find(group => group.id === redirect.from.provider) : undefined
  const detail = redirected ? `${originalProvider?.models.find(model => model.id === redirect.from.model)?.name ?? redirect.from.model} · ${originalProvider?.name ?? redirect.from.provider} → ${label}` : label
  return React.createElement('span', {
    'data-dsh-chat-enhancement': 'running-model',
    title: [detail, route.reasoningEffort].filter(Boolean).join(' · '),
    style: turnModelStyle,
  }, redirected ? `${t('model.redirected')} · ${label}` : label)
}

const requestSchema = { parse(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof value.sessionId !== 'string' || typeof value.token !== 'string') throw new TypeError('media request is invalid.')
  return { sessionId: value.sessionId, token: value.token }
} }
const resultSchema = { parse(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof value.mediaType !== 'string' || typeof value.name !== 'string' || typeof value.dataBase64 !== 'string') throw new TypeError('media result is invalid.')
  return value
} }
const markdownRequestSchema = { parse(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof value.sessionId !== 'string' || typeof value.path !== 'string') throw new TypeError('Markdown request is invalid.')
  return { sessionId: value.sessionId, path: value.path }
} }
const markdownResultSchema = { parse(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof value.name !== 'string' || typeof value.text !== 'string') throw new TypeError('Markdown result is invalid.')
  return value
} }
const previewRemote = { package: 'dsh-chat-enhancement', descriptors: [
  recoveryDescriptor,
  {
    id: 'dsh-chat-enhancement#chatMedia/read', service: 'chatMedia', namespace: 'chatMedia', method: 'read', invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatMediaRequest', schema: requestSchema } }],
    result: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatMediaResult', schema: resultSchema },
  },
  {
    id: 'dsh-chat-enhancement#chatMarkdown/read', service: 'chatMarkdown', namespace: 'chatMarkdown', method: 'read', invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatMarkdownRequest', schema: markdownRequestSchema } }],
    result: { mode: 'strict', typeSymbol: 'dsh-chat-enhancement#ChatMarkdownResult', schema: markdownResultSchema },
  },
] }

export const inject = ['slots', 'sessions', 'remote', 'remote.goals', 'settingsScope', 'conversation', 'locale', 'modelDirectories', 'sidebarRight']

export async function apply(ctx) {
  ctx.effect(() => ctx.locale.register('chat-enhancement-question-content', questionContentLocales))
  ctx.slots.inject('proactive.question.content', () => ctx.slots.register({
    name: 'proactive.question.content', priority: 100, locale: 'chat-enhancement-question-content',
  }, QuestionRichContent))
  ctx.effect(() => ctx.locale.register('chat-enhancement-recovery', recoveryLocales))
  ctx.effect(() => ctx.locale.register('chat-enhancement-annotations', annotationLocales))
  ctx.effect(() => ctx.locale.register('chat-enhancement-jobs', backgroundJobLocales))
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = backgroundJobCss + recoveryCss + questionContentCss
    document.head.appendChild(style)
    return () => style.remove()
  })
  const dispose = await ctx.remote.$mount(previewRemote)
  installGoalMetricsClient(ctx)
  const recoveryService = ctx.reflect.get('remote.chatRecovery')
  const readRecovery = async request => {
    const result = await recoveryService.read(request)
    if (!result.ok || result.value === undefined) throw new Error('Session recovery unavailable')
    return result.value
  }
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action', id: 'chat-enhancement-recovery', order: 100,
    locale: 'chat-enhancement-recovery', inject: () => ({ readRecovery }),
  }, SessionRecoveryPrompt))
  const sessions = ctx.get('sessions')
  const chatSettings = ctx.settingsScope.bind({ namespace: 'chat-enhancement' })
  installCodeReferences(ctx, chatSettings)
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions', id: 'job-list', priority: 100, order: 20,
    locale: 'chat-enhancement-jobs', inject: () => ({ chatSettings }),
  }, BackgroundJobList))
  const mediaService = ctx.reflect.get('remote.chatMedia')
  const markdownService = ctx.reflect.get('remote.chatMarkdown')
  if (sessions === undefined || mediaService?.read === undefined || markdownService?.read === undefined) throw new Error('dsh-chat-enhancement preview services are unavailable.')
  const readMedia = async (request) => {
    const result = await mediaService.read(request)
    if (!result.ok || result.value === undefined) throw new Error(result.error?.message ?? '媒体读取失败。')
    return result.value
  }
  const readMarkdown = async (request) => {
    const result = await markdownService.read(request)
    if (!result.ok || result.value === undefined) throw new Error(result.error?.message ?? 'Markdown 读取失败。')
    return result.value
  }
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'chat-enhancement-media-autoplay-session', order: 99,
  }, MediaAutoplaySessionController))
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'chat-enhancement-markdown-preview', order: 100, locale: 'chat-enhancement-annotations',
    inject: () => ({ readMarkdown }),
  }, MarkdownPreviewController))
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'chat-enhancement-tool-groups', order: 101,
  }, ToolCallGroupController))
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'chat-enhancement-thinking-groups', order: 102,
  }, ThinkingGroupController))
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'chat-enhancement-reasoning-auto-expand', order: 102.5,
    inject: () => ({ chatSettings }),
  }, ReasoningAutoExpandSlot))
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'chat-enhancement-annotations', order: 103, locale: 'chat-enhancement-annotations',
    inject: () => ({ append: (sessionId, annotation) => appendAnnotation(sessions, ctx.conversation, sessionId, annotation) }),
  }, props => React.createElement(AnnotationController, { ...props, key: props.sessionId })))
  // 追加到已定稿 assistant 消息的操作行（list 槽位按 id 追加，不替换 DSH 原生操作）。
  const TurnModelAction = props => React.createElement(TurnModelBadge, { ...props, key: props.messageId })
  ctx.slots.inject('conversation.chat.running-status', () => ctx.slots.register({
    name: 'conversation.chat.running-status', id: 'chat-enhancement-running-model', order: 20,
    locale: 'chat-enhancement-annotations',
    inject: sessionId => {
      const directory = ctx.modelDirectories.directoryFor(sessionId)
      return {
        hooks: { modelDirectory: directory.store },
        loadModelDirectory: async () => {
          if (directory.store.getSnapshot().status === 'idle') await directory.load()
        },
      }
    },
  }, RunningModelBadge))
  ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions', id: 'chat-enhancement-turn-model', order: 20, locale: 'chat-enhancement-annotations',
    inject: sessionId => {
      const directory = ctx.modelDirectories.directoryFor(sessionId)
      return {
        hooks: { modelDirectory: directory.store },
        loadModelDirectory: async () => {
          if (directory.store.getSnapshot().status === 'idle') await directory.load()
        },
      }
    },
  }, TurnModelAction))
  // 一个导航项装下本插件的全部偏好：语言在上，媒体展示在下。
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'chat-enhancement', order: 65, label: () => '对话增强',
    inject: () => ({ chatSettings }),
  }, ChatEnhancementSettingsSection))
  // `read_image` is already rendered by DSH's built-in read-image toolview.
  // Registering it here causes the keyed slot to reject the whole custom
  // media-view batch, which can interrupt client initialization on reload.
  for (const key of ['show_image', 'show_video', 'show_audio']) {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key, locale: 'conversation' }, (props) => React.createElement(MediaToolView, { ...props, sessions, readMedia, chatSettings })))
  }
  return dispose
}
