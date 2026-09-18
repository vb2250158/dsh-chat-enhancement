/** Selection annotations remain local until appended through the session input event. */
import * as React from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'

/** UI copy follows the locale seat; quoted content remains verbatim. */
export const annotationLocales = {
  zh: {
    mark: '批注', quote: '引用原文', note: '批注内容', add: '添加到聊天', cancel: '取消',
    editTitle: '编辑批注', update: '更新批注',
    unavailable: '当前草稿暂不可添加，请退出命令模式或等待提交完成后重试。',
    changed: '草稿或会话已变化，未添加批注。请回到原会话后重试。',
  },
  en: {
    mark: 'Annotate', quote: 'Quoted text', note: 'Comment', add: 'Add to chat', cancel: 'Cancel',
    editTitle: 'Edit annotation', update: 'Update annotation',
    unavailable: 'Cannot add to this draft yet. Exit command mode or wait for submission, then try again.',
    changed: 'The draft or conversation changed. Your comment was not added. Return to the original conversation and try again.',
  },
}
const annotationPanelStyle = { position: 'fixed', zIndex: 1100, width: 'min(420px, calc(100vw - 24px))', maxHeight: 'min(70vh, 520px)', overflow: 'auto', padding: '12px', display: 'grid', gap: '12px', border: '1px solid var(--dsw-alias-line-primary)', borderRadius: '12px', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)' }

/** Convert the public clipboard projection to the input event's atomic-chip end offset. */
export function annotationEndOffset(input) {
  return input.draft.length - input.occurrences.reduce((total, occurrence) => total + occurrence.length - 1, 0)
}

export const annotationSchema = 'dsh.annotation/v1'

/**
 * Resolve the durable coordinates behind one captured selection.
 *
 * The chat flow annotates `[data-chat-flow-key]` rows, and the key is the
 * routed node key. A `session_event_read`/`session_event_trace` pair addresses
 * an *event* by sequence number, so the sequence has to ride the same key the
 * DOM exposes: ChatNodeSeat renders `routedNode.key`, whose tail segment is the
 * event sequence for durable nodes (`<session>:<kind>:<seq>`). A key that does
 * not carry a numeric tail stays addressable by key alone — the annotation is
 * still useful, it just cannot promise the progressive reader a starting seq.
 * @param flowKey - the row's `data-chat-flow-key`, or null for Markdown previews.
 * @param flowKind - the row's `data-chat-flow-kind` when present.
 * @returns durable coordinates; every field may be null when unknown.
 */
export function annotationTarget(flowKey, flowKind) {
  const key = typeof flowKey === 'string' && flowKey !== '' ? flowKey : null
  const match = key === null ? null : /:(\d+)$/u.exec(key)
  return {
    msgKey: key,
    msgKind: typeof flowKind === 'string' && flowKind !== '' ? flowKind : null,
    seq: match === null ? null : Number(match[1]),
  }
}

/**
 * Build the attachment payload for one annotation.
 *
 * The file is the annotation's durable home: it travels to the model through
 * the ordinary attachment path, and the composer keeps the `File` so clicking
 * the card reopens this exact payload for editing. `target.seq` is the
 * progressive-reader handle — `session_event_read` with `before`/`after` walks
 * out from it without the user pasting surrounding context.
 * @param annotation - `{ quote, note, target, sessionId, createdAt }`.
 * @returns the JSON text written into the attachment.
 */
export function annotationFileText(annotation) {
  return `${JSON.stringify({
    schema: annotationSchema,
    createdAt: annotation.createdAt,
    sessionId: annotation.sessionId ?? null,
    target: annotation.target ?? { msgKey: null, msgKind: null, seq: null },
    quote: annotation.quote,
    note: annotation.note,
  }, null, 2)}\n`
}

/**
 * Name one annotation attachment.
 *
 * The name is the user's handle on the attachment rail and in the model's file
 * listing, so it carries the sequence when there is one: `批注-0142.json` says
 * which event the note belongs to without opening it.
 * @param seq - target event sequence number, or null.
 * @param stamp - creation time in milliseconds.
 * @returns a filesystem-safe `.json` name.
 */
export function annotationFileName(seq, stamp) {
  const suffix = seq === null ? new Date(stamp).toISOString().replace(/[:.]/gu, '-') : String(seq).padStart(4, '0')
  return `批注-${suffix}.json`
}

/**
 * Read one annotation back out of its attachment file.
 *
 * Reopening is driven by the file the user picked, so the parse has to treat
 * the bytes as untrusted: anything that is not this plugin's schema returns
 * null and the caller edits a fresh annotation instead of corrupt state.
 * @param text - the attachment file's decoded text.
 * @returns the annotation, or null when the payload is not ours.
 */
export function parseAnnotationFile(text) {
  if (typeof text !== 'string') return null
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object' || parsed.schema !== annotationSchema) return null
  if (typeof parsed.quote !== 'string' || typeof parsed.note !== 'string') return null
  const target = parsed.target
  return {
    quote: parsed.quote,
    note: parsed.note,
    sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : null,
    createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
    target: {
      msgKey: typeof target?.msgKey === 'string' ? target.msgKey : null,
      msgKind: typeof target?.msgKind === 'string' ? target.msgKind : null,
      seq: typeof target?.seq === 'number' && Number.isInteger(target.seq) ? target.seq : null,
    },
  }
}

/**
 * Build the `File` handed to the composer's attachment intake.
 *
 * A `File` (not a `Blob`) is required: the composer reads `.name` for the card
 * label and uploads `.file` verbatim, and only a real `File` keeps that name.
 * @param annotation - `{ quote, note, target, sessionId, createdAt }`.
 * @returns the annotation as a `.json` attachment file.
 */
export function annotationFile(annotation) {
  const seq = annotation.target?.seq ?? null
  return new File(
    [annotationFileText(annotation)],
    annotationFileName(seq, annotation.createdAt ?? Date.now()),
    { type: 'application/json' },
  )
}

/**
 * Hand one annotation to the composer as a `.json` attachment; never submit.
 *
 * The attachment path replaces the old draft-text append: the note no longer
 * spends chat context as prose, and the composer keeps the `File`, so the rail
 * card can reopen this payload for editing. The draft's existing text,
 * reference chips and other attachments are untouched.
 *
 * `addAttachmentFiles` is the conversation service's supported intake for a
 * plugin that produces a file itself — its own doc names exactly this case (a
 * generated `.json` payload) — and it enters the composer the same way a
 * picked file does, without submitting.
 * @param sessions - the sessions service (current-session guard).
 * @param conversation - the conversation service (attachment intake).
 * @param sessionId - the session the annotation belongs to.
 * @param annotation - `{ quote, note, target }`; `sessionId`/`createdAt` are filled here.
 * @returns null on success, otherwise the locale key of the failure reason.
 */
export function appendAnnotation(sessions, conversation, sessionId, annotation) {
  if (sessions.list.getSnapshot().current !== sessionId) return 'changed'
  const scope = sessions.scope(sessionId)
  if (scope === undefined) return 'changed'
  const input = conversation.input.for(scope).state.getSnapshot()
  if (input.phase !== 'plain') return 'unavailable'
  if (typeof conversation.addAttachmentFiles !== 'function') return 'unavailable'
  conversation.addAttachmentFiles(sessionId, [annotationFile({
    quote: annotation.quote,
    note: annotation.note,
    target: annotation.target,
    sessionId,
    createdAt: Date.now(),
  })])
  return null
}

function selectionElement(node) {
  return node?.nodeType === 1 ? node : node?.parentElement
}

/** Restrict selection to one visible chat flow or Markdown preview, excluding editable UI. */
export function captureAnnotationSelection(selection) {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null
  const start = selectionElement(selection.anchorNode)
  const end = selectionElement(selection.focusNode)
  const excluded = 'input, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [data-dsh-annotation]'
  if (!start || !end || start.closest(excluded) || end.closest(excluded)) return null
  const root = start.closest('[data-chat-flow], [data-dsh-chat-enhancement-markdown]')
  if (!root || root !== end.closest('[data-chat-flow], [data-dsh-chat-enhancement-markdown]') || root.getClientRects().length === 0) return null
  const range = selection.getRangeAt(0)
  for (const editable of root.querySelectorAll(excluded)) if (range.intersectsNode(editable)) return null
  const text = selection.toString().trim()
  if (!text) return null
  const rect = range.getBoundingClientRect()
  const firstMessage = start.closest('[data-chat-flow-key]')
  const lastMessage = end.closest('[data-chat-flow-key]')
  const sameRow = firstMessage !== null && firstMessage === lastMessage
  const source = root.matches('[data-dsh-chat-enhancement-markdown]') ? root.getAttribute('aria-label') : sameRow ? firstMessage?.getAttribute('data-chat-flow-key') : null
  const flowKind = sameRow ? firstMessage?.getAttribute('data-chat-flow-kind') : null
  return { text, source, flowKey: sameRow ? source : null, flowKind, left: rect.left, top: rect.bottom + 8 }
}

/** A session-keyed controller owns selection capture and keyboard interaction. */
export function AnnotationController({ sessionId, useSessions, append, t, editing }) {
  const annotationCopy = Object.fromEntries(Object.keys(annotationLocales.en).map(key => [key, t(key)]))
  const current = useSessions(state => state.current)
  const [selection, setSelection] = React.useState(null)
  const [editing_, setEditing] = React.useState(false)
  const [note, setNote] = React.useState('')
  const [error, setError] = React.useState(null)
  const rootRef = React.useRef(null)
  const editingRef = React.useRef(false)
  const returnFocusRef = React.useRef(null)
  const close = () => {
    editingRef.current = false
    setEditing(false)
    setSelection(null)
    setNote('')
    setError(null)
  }
  // Reopening an existing annotation attachment takes over the panel: the
  // payload supplies both the frozen quote and the note being revised, and
  // selection capture stays off so a stray click cannot swap the target.
  React.useEffect(() => {
    if (editing === undefined || editing === null) return
    editingRef.current = true
    setEditing(true)
    setSelection({ text: editing.quote, source: editing.target?.msgKey ?? null, reopen: editing })
    setNote(editing.note)
    setError(null)
  }, [editing])
  React.useEffect(() => {
    close()
    if (current !== sessionId) return undefined
    const capture = () => {
      if (!editingRef.current && !rootRef.current?.contains(document.activeElement)) setSelection(captureAnnotationSelection(window.getSelection()))
    }
    const dismiss = event => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        close()
        window.getSelection()?.removeAllRanges()
      }
    }
    document.addEventListener('selectionchange', capture)
    document.addEventListener('pointerup', capture)
    document.addEventListener('keyup', capture)
    document.addEventListener('pointerdown', dismiss, true)
    return () => {
      document.removeEventListener('selectionchange', capture)
      document.removeEventListener('pointerup', capture)
      document.removeEventListener('keyup', capture)
      document.removeEventListener('pointerdown', dismiss, true)
      editingRef.current = false
    }
  }, [current, sessionId])
  React.useEffect(() => {
    if (editing_) rootRef.current?.querySelector('textarea')?.focus()
  }, [editing_])
  if (current !== sessionId || selection === null) return null
  const reopening = selection.reopen !== undefined
  const add = () => {
    if (!note.trim()) return
    // A reopened payload keeps its own target coordinates; a fresh selection
    // reads them off the annotated row right now.
    const target = reopening
      ? selection.reopen.target
      : annotationTarget(selection.flowKey ?? selection.source, selection.flowKind)
    const failure = append(sessionId, { quote: selection.text, note: note.trim(), target })
    if (failure !== null) { setError(annotationCopy[failure]); return }
    close()
  }
  const cancel = () => { close(); if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus() }
  const onKeyDown = event => {
    if (event.nativeEvent?.isComposing || event.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel() }
    if (editing_ && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.stopPropagation(); add() }
    if (editing_ && event.key === 'Tab') {
      const controls = [...rootRef.current.querySelectorAll('textarea,button:not(:disabled)')]
      const index = controls.indexOf(document.activeElement)
      event.preventDefault()
      controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length]?.focus()
    }
  }
  const top = Math.max(12, Math.min(selection.top ?? 120, window.innerHeight - (editing_ ? 440 : 80)))
  const style = { ...annotationPanelStyle, boxSizing: 'border-box', maxHeight: `${Math.max(48, window.innerHeight - top - 12)}px`, left: Math.max(12, Math.min(selection.left ?? window.innerWidth - 444, window.innerWidth - 444)), top }
  return React.createElement('div', { ref: rootRef, 'data-dsh-annotation': '', style, role: editing_ ? 'dialog' : 'toolbar', 'aria-label': annotationCopy.mark, onKeyDown },
    !editing_ ? React.createElement(Button, {
      variant: 'outline', onPointerDown: event => { returnFocusRef.current = document.activeElement; event.preventDefault() },
      onClick: () => { editingRef.current = true; setEditing(true) },
    }, annotationCopy.mark) : React.createElement(React.Fragment, null,
      React.createElement('strong', null, reopening ? annotationCopy.editTitle : annotationCopy.quote),
      selection.source && React.createElement('div', { 'data-dsh-annotation-source': '', style: { overflowWrap: 'anywhere', color: 'var(--dsw-alias-label-secondary)' } }, selection.source),
      React.createElement('blockquote', { style: { margin: 0, maxHeight: '160px', overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, selection.text),
      React.createElement('label', null, annotationCopy.note,
        React.createElement('textarea', { value: note, rows: 3, style: { width: '100%', boxSizing: 'border-box', resize: 'vertical', color: 'inherit', background: 'var(--dsw-alias-bg-base)', border: '1px solid var(--dsw-alias-line-primary)', borderRadius: '8px', padding: '8px', font: 'inherit' }, onChange: event => setNote(event.target.value), 'aria-label': annotationCopy.note })),
      error && React.createElement('div', { role: 'alert' }, error),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } },
        React.createElement(Button, { onClick: cancel }, annotationCopy.cancel),
        React.createElement(Button, { variant: 'primary', disabled: !note.trim(), onClick: add }, reopening ? annotationCopy.update : annotationCopy.add))))
}
