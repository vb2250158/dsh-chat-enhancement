/** Selection annotations remain local until appended through the session input event. */
import * as React from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'

/** UI copy follows the locale seat; quoted content remains verbatim. */
export const annotationLocales = {
  zh: {
    mark: '批注', quote: '引用原文', note: '批注内容', add: '添加到聊天', cancel: '取消',
    unavailable: '当前草稿暂不可添加，请退出命令模式或等待提交完成后重试。',
    changed: '草稿或会话已变化，未添加批注。请回到原会话后重试。',
  },
  en: {
    mark: 'Annotate', quote: 'Quoted text', note: 'Comment', add: 'Add to chat', cancel: 'Cancel',
    unavailable: 'Cannot add to this draft yet. Exit command mode or wait for submission, then try again.',
    changed: 'The draft or conversation changed. Your comment was not added. Return to the original conversation and try again.',
  },
}
const annotationPanelStyle = { position: 'fixed', zIndex: 1100, width: 'min(420px, calc(100vw - 24px))', maxHeight: 'min(70vh, 520px)', overflow: 'auto', padding: '12px', display: 'grid', gap: '12px', border: '1px solid var(--dsw-alias-line-primary)', borderRadius: '12px', background: 'var(--dsw-alias-bg-elevated)', color: 'var(--dsw-alias-label-primary)' }

/** Convert the public clipboard projection to the input event's atomic-chip end offset. */
export function annotationEndOffset(input) {
  return input.draft.length - input.occurrences.reduce((total, occurrence) => total + occurrence.length - 1, 0)
}

/** Append without replacing the editor, its reference chips, or attachments; never submit. */
export function appendAnnotation(sessions, conversation, sessionId, quote, note) {
  if (sessions.list.getSnapshot().current !== sessionId) return 'changed'
  const scope = sessions.scope(sessionId)
  if (scope === undefined) return 'changed'
  const input = conversation.input.for(scope).state.getSnapshot()
  if (input.phase !== 'plain') return 'unavailable'
  const end = annotationEndOffset(input)
  const text = `${input.draft === '' ? '' : '\n\n'}${quote.split(/\r?\n/u).map(line => `> ${line}`).join('\n')}\n\n${note.trim()}\n`
  const applied = scope.bail(scope, 'slash/input-insert-text', { text, span: { start: end, end, draftRev: input.draftRev } })
  return applied === true ? null : 'changed'
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
  const source = root.matches('[data-dsh-chat-enhancement-markdown]') ? root.getAttribute('aria-label') : firstMessage === lastMessage ? firstMessage?.getAttribute('data-chat-flow-key') : null
  return { text, source, left: rect.left, top: rect.bottom + 8 }
}

/** A session-keyed controller owns selection capture and keyboard interaction. */
export function AnnotationController({ sessionId, useSessions, append, t }) {
  const annotationCopy = Object.fromEntries(Object.keys(annotationLocales.en).map(key => [key, t(key)]))
  const current = useSessions(state => state.current)
  const [selection, setSelection] = React.useState(null)
  const [editing, setEditing] = React.useState(false)
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
  React.useEffect(() => {
    close()
    if (current !== sessionId) return undefined
    const capture = () => {
      if (!editingRef.current && !rootRef.current?.contains(document.activeElement)) setSelection(captureAnnotationSelection(window.getSelection()))
    }
    const dismiss = event => {
      if (!editingRef.current && !rootRef.current?.contains(event.target)) setSelection(null)
    }
    document.addEventListener('selectionchange', capture)
    document.addEventListener('pointerup', capture)
    document.addEventListener('keyup', capture)
    document.addEventListener('pointerdown', dismiss)
    return () => {
      document.removeEventListener('selectionchange', capture)
      document.removeEventListener('pointerup', capture)
      document.removeEventListener('keyup', capture)
      document.removeEventListener('pointerdown', dismiss)
      editingRef.current = false
    }
  }, [current, sessionId])
  React.useEffect(() => {
    if (editing) rootRef.current?.querySelector('textarea')?.focus()
  }, [editing])
  if (current !== sessionId || selection === null) return null
  const add = () => {
    if (!note.trim()) return
    const failure = append(sessionId, selection.source ? `${selection.source}\n\n${selection.text}` : selection.text, note)
    if (failure !== null) { setError(annotationCopy[failure]); return }
    close()
  }
  const cancel = () => { close(); if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus() }
  const onKeyDown = event => {
    if (event.nativeEvent?.isComposing || event.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel() }
    if (editing && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.stopPropagation(); add() }
    if (editing && event.key === 'Tab') {
      const controls = [...rootRef.current.querySelectorAll('textarea,button:not(:disabled)')]
      const index = controls.indexOf(document.activeElement)
      event.preventDefault()
      controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length]?.focus()
    }
  }
  const top = Math.max(12, Math.min(selection.top, window.innerHeight - (editing ? 440 : 80)))
  const style = { ...annotationPanelStyle, boxSizing: 'border-box', maxHeight: `${Math.max(48, window.innerHeight - top - 12)}px`, left: Math.max(12, Math.min(selection.left, window.innerWidth - 444)), top }
  return React.createElement('div', { ref: rootRef, 'data-dsh-annotation': '', style, role: editing ? 'dialog' : 'toolbar', 'aria-label': annotationCopy.mark, onKeyDown },
    !editing ? React.createElement(Button, {
      variant: 'outline', onPointerDown: event => { returnFocusRef.current = document.activeElement; event.preventDefault() },
      onClick: () => { editingRef.current = true; setEditing(true) },
    }, annotationCopy.mark) : React.createElement(React.Fragment, null,
      React.createElement('strong', null, annotationCopy.quote),
      selection.source && React.createElement('div', { 'data-dsh-annotation-source': '', style: { overflowWrap: 'anywhere', color: 'var(--dsw-alias-label-secondary)' } }, selection.source),
      React.createElement('blockquote', { style: { margin: 0, maxHeight: '160px', overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, selection.text),
      React.createElement('label', null, annotationCopy.note,
        React.createElement('textarea', { value: note, rows: 3, style: { width: '100%', boxSizing: 'border-box', resize: 'vertical', color: 'inherit', background: 'var(--dsw-alias-bg-primary)', border: '1px solid var(--dsw-alias-line-primary)', borderRadius: '8px', padding: '8px', font: 'inherit' }, onChange: event => setNote(event.target.value), 'aria-label': annotationCopy.note })),
      error && React.createElement('div', { role: 'alert' }, error),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } },
        React.createElement(Button, { onClick: cancel }, annotationCopy.cancel),
        React.createElement(Button, { variant: 'primary', disabled: !note.trim(), onClick: add }, annotationCopy.add))))
}
