window.__ModuleLoader__.load({
  id: 'dsh-chat-enhancement',
  factory: (require) => {
    const React = require('react')
    const { MarkdownText, Button, Menu, IconChevronDownOutline14 } = require('@deepseek-ai/dsh-client-ui-primitives')
/**
 * Shared language catalog for the chat-enhancement language preference.
 *
 * Both halves of the bundle read this one list: the browser half renders the
 * settings options, the Host half turns the stored id into the system-prompt
 * instruction. A single module is what keeps those two views from drifting —
 * adding a language is one entry, not two lists that must agree by hand.
 */

/** Stored value meaning "no constraint": the model keeps following the user. */
const AUTO_LANGUAGE = 'auto'

/**
 * Selectable languages, in menu order.
 *
 * `id` is the value persisted in the `chat-enhancement` settings namespace and
 * is treated as an opaque key: an unknown stored id resolves to `auto`, so a
 * hand-edited or forward-dated document degrades instead of failing a turn.
 *
 * `label` is the option text shown in settings. `name` is the language as the
 * prompt spells it — English plus the endonym, so the model gets both the
 * unambiguous name and the native spelling it has to produce.
 *
 * `native` is the imperative that actually carries the instruction, written
 * **in that language**. This is the whole point of the field: an English
 * sentence asking for Chinese reasoning gets ignored, because a model mirrors
 * the language of its instructions and of the English tool output around them.
 * A native sentence is what actually moves the reasoning language.
 *
 * `null` on any field means this entry contributes no instruction at all.
 */
const LANGUAGES = [
  { id: AUTO_LANGUAGE, label: '跟随对话（默认，不限制）', name: null, native: null },
  { id: 'zh-CN', label: '简体中文', name: 'Simplified Chinese (简体中文)', native: '始终用简体中文思考和回复。' },
  { id: 'zh-TW', label: '繁體中文', name: 'Traditional Chinese (繁體中文)', native: '一律用繁體中文思考和回覆。' },
  { id: 'en', label: 'English', name: 'English', native: 'Always think and reply in English.' },
  { id: 'ja', label: '日本語', name: 'Japanese (日本語)', native: '常に日本語で考え、日本語で回答してください。' },
  { id: 'ko', label: '한국어', name: 'Korean (한국어)', native: '항상 한국어로 생각하고 한국어로 답하세요.' },
  { id: 'fr', label: 'Français', name: 'French (Français)', native: 'Réfléchissez et répondez toujours en français.' },
  { id: 'de', label: 'Deutsch', name: 'German (Deutsch)', native: 'Denken und antworten Sie immer auf Deutsch.' },
  { id: 'es', label: 'Español', name: 'Spanish (Español)', native: 'Piensa y responde siempre en español.' },
  { id: 'pt', label: 'Português', name: 'Portuguese (Português)', native: 'Pense e responda sempre em português.' },
  { id: 'it', label: 'Italiano', name: 'Italian (Italiano)', native: 'Pensa e rispondi sempre in italiano.' },
  { id: 'nl', label: 'Nederlands', name: 'Dutch (Nederlands)', native: 'Denk en antwoord altijd in het Nederlands.' },
  { id: 'pl', label: 'Polski', name: 'Polish (Polski)', native: 'Zawsze myśl i odpowiadaj po polsku.' },
  { id: 'sv', label: 'Svenska', name: 'Swedish (Svenska)', native: 'Tänk och svara alltid på svenska.' },
  { id: 'ru', label: 'Русский', name: 'Russian (Русский)', native: 'Всегда думайте и отвечайте по-русски.' },
  { id: 'uk', label: 'Українська', name: 'Ukrainian (Українська)', native: 'Завжди думайте й відповідайте українською.' },
  { id: 'tr', label: 'Türkçe', name: 'Turkish (Türkçe)', native: 'Her zaman Türkçe düşün ve Türkçe yanıtla.' },
  { id: 'ar', label: 'العربية', name: 'Arabic (العربية)', native: 'فكّر وأجب دائمًا بالعربية.' },
  { id: 'he', label: 'עברית', name: 'Hebrew (עברית)', native: 'חשוב והשב תמיד בעברית.' },
  { id: 'hi', label: 'हिन्दी', name: 'Hindi (हिन्दी)', native: 'हमेशा हिन्दी में सोचें और हिन्दी में उत्तर दें।' },
  { id: 'th', label: 'ไทย', name: 'Thai (ไทย)', native: 'คิดและตอบเป็นภาษาไทยเสมอ' },
  { id: 'vi', label: 'Tiếng Việt', name: 'Vietnamese (Tiếng Việt)', native: 'Luôn suy nghĩ và trả lời bằng tiếng Việt.' },
  { id: 'id', label: 'Bahasa Indonesia', name: 'Indonesian (Bahasa Indonesia)', native: 'Selalu berpikir dan menjawab dalam Bahasa Indonesia.' },
  { id: 'ms', label: 'Bahasa Melayu', name: 'Malay (Bahasa Melayu)', native: 'Sentiasa berfikir dan menjawab dalam Bahasa Melayu.' },
]

/** The `auto` entry, which every unknown or absent stored id falls back to. */
const AUTO_ENTRY = LANGUAGES[0]

/**
 * When a drift anchor is injected, in menu order.
 *
 * `onDrift` is the default because the anchor is not free: it is a message in
 * the history, so every later step pays for it again. Injecting on every step
 * would spend that budget on the common case where the model is already in the
 * right language — the section instruction handles those steps by itself.
 *
 * Stored ids are opaque keys like the language ids: an unknown value resolves
 * to `onDrift`, the same fallback the Host applies when it decides.
 */
const LANGUAGE_ANCHOR_MODES = [
  { id: 'onDrift', label: '发现漂移时才提醒（默认）' },
  { id: 'always', label: '每一步都提醒' },
  { id: 'off', label: '不提醒，只用系统提示约束' },
]

/** The anchor mode that every unknown or absent stored id falls back to. */
const DEFAULT_ANCHOR_MODE = LANGUAGE_ANCHOR_MODES[0].id

/** Resolve a stored anchor mode to a known id. */
function languageAnchorMode(id) {
  return LANGUAGE_ANCHOR_MODES.some(mode => mode.id === id) ? id : DEFAULT_ANCHOR_MODE
}

/**
 * Resolve one stored id to its catalog entry.
 * @param id - the persisted language id, or anything a hand-edited document holds.
 * @returns the matching entry, or the `auto` entry when nothing matches.
 */
function languageEntry(id) {
  return LANGUAGES.find(language => language.id === id) ?? AUTO_ENTRY
}

/**
 * Build the system-prompt instruction for one stored language id.
 *
 * The native line comes first so the instruction itself is already in the
 * language being asked for; the English lines behind it only carry the
 * mechanical rules (what must not be translated, which request overrides).
 *
 * Empty text means "contribute nothing", which is how `auto` keeps the
 * assembled prompt identical to a deployment that never configured this
 * preference — `renderPrompt` drops zero-length sections.
 * @param id - the persisted language id.
 * @returns the instruction text, or an empty string under `auto` or an unknown id.
 */
function languageInstruction(id) {
  const { name, native } = languageEntry(id)
  if (name === null || native === null) return ''
  return [
    '## Language Preference',
    native,
    `Your reasoning and every user-visible reply must be in ${name}, even when this prompt, the tool output, the code, and the surrounding conversation are all in English. Do not fall back to English for thinking.`,
    `The output language does not follow the tool output, the code, or an earlier reply written in another language. Open every message in ${name}, including the narration between tool calls.`,
    'Never translate code, identifiers, file paths, shell commands, log output, error text, or quoted text; reproduce them exactly as they appear.',
    'An explicit request for another language inside the conversation overrides this for that request only.',
  ].join('\n')
}

/**
 * Native-language anchors injected when the model has drifted out of the
 * selected language.
 *
 * These are deliberately shorter than `languageInstruction` and written in the
 * target language itself: they ride the message history, so length is paid on
 * every later step, and they name the case that actually drifts — the running
 * commentary between tool calls, not the summary text the section already
 * covers. The anchor is the instruction, not a translation of it: an English
 * sentence asking for Chinese is what the model ignores in the first place.
 *
 * A language without an entry here falls back to its catalog `native` line.
 */
const LANGUAGE_ANCHORS = {
  'zh-CN': '继续用简体中文思考和回复，包括工具调用之间的说明；输出语言不要随工具结果或代码改变。',
  'zh-TW': '繼續用繁體中文思考和回覆，包括工具呼叫之間的說明；輸出語言不要隨工具結果或程式碼改變。',
  en: 'Continue thinking and replying in English, including the narration between tool calls.',
  ja: 'ツール呼び出しの間の説明も含め、引き続き日本語で考え、日本語で回答してください。',
  ko: '도구 호출 사이의 설명을 포함해 계속 한국어로 생각하고 답하세요.',
  fr: 'Continuez à réfléchir et à répondre en français, y compris les commentaires entre les appels d’outils.',
  de: 'Denken und antworten Sie weiterhin auf Deutsch, auch in den Zwischenbemerkungen zwischen Tool-Aufrufen.',
  es: 'Sigue pensando y respondiendo en español, incluidos los comentarios entre llamadas a herramientas.',
  pt: 'Continue pensando e respondendo em português, incluindo os comentários entre chamadas de ferramentas.',
}

/**
 * The one-line reminder injected when the reply language has drifted.
 * @param id - the persisted language id.
 * @returns the anchor text, or an empty string under `auto` or an unknown id.
 */
function languageAnchor(id) {
  const { native } = languageEntry(id)
  if (native === null) return ''
  return LANGUAGE_ANCHORS[id] ?? native
}

/** Selection annotations remain local until appended through the session input event. */

/** UI copy follows the locale seat; quoted content remains verbatim. */
const annotationLocales = {
  zh: {
    'model.redirected': '已重定向',
    mark: '批注', quote: '引用原文', note: '批注内容', add: '添加到聊天', cancel: '取消',
    editTitle: '编辑批注', update: '更新批注',
    unavailable: '当前草稿暂不可添加，请退出命令模式或等待提交完成后重试。',
    changed: '草稿或会话已变化，未添加批注。请回到原会话后重试。',
  },
  en: {
    'model.redirected': 'Redirected',
    mark: 'Annotate', quote: 'Quoted text', note: 'Comment', add: 'Add to chat', cancel: 'Cancel',
    editTitle: 'Edit annotation', update: 'Update annotation',
    unavailable: 'Cannot add to this draft yet. Exit command mode or wait for submission, then try again.',
    changed: 'The draft or conversation changed. Your comment was not added. Return to the original conversation and try again.',
  },
}
const annotationPanelStyle = { position: 'fixed', zIndex: 1100, width: 'min(420px, calc(100vw - 24px))', maxHeight: 'min(70vh, 520px)', overflow: 'auto', padding: '12px', display: 'grid', gap: '12px', border: '1px solid var(--dsw-alias-line-primary)', borderRadius: '12px', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)' }

/** Convert the public clipboard projection to the input event's atomic-chip end offset. */
function annotationEndOffset(input) {
  return input.draft.length - input.occurrences.reduce((total, occurrence) => total + occurrence.length - 1, 0)
}

const annotationSchema = 'dsh.annotation/v1'

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
function annotationTarget(flowKey, flowKind) {
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
function annotationFileText(annotation) {
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
function annotationFileName(seq, stamp) {
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
function parseAnnotationFile(text) {
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
function annotationFile(annotation) {
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
function appendAnnotation(sessions, conversation, sessionId, annotation) {
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
function captureAnnotationSelection(selection) {
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
function AnnotationController({ sessionId, useSessions, append, t, editing }) {
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

/** Browser entry for the chat-enhancement DSH bundle. */


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
function createMediaAutoplayGate() {
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
    React.createElement('input', { type: 'checkbox', role: 'switch', checked: preferences[field], disabled: !writable, onChange: event => { void chatSettings.set(field, event.target.checked) } }))
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
    React.createElement('p', { style: mutedStyle }, '开启后，思考进行中的 Thinking 行会自动展开显示全文，并跟随最新内容滚动；思考一结束就恢复成默认的折叠摘要。DSH 默认始终把 Thinking 行渲染成一行折叠摘要，本开关只驱动那一行自带的展开控件，因此展开内容、折叠高度和无障碍状态仍由官方渲染器决定。你手动展开过的行不会被自动收起；关闭本开关会收起自动展开的行。'),
    React.createElement('h3', { style: settingsGroupStyle }, '工具行'),
    toggle('toolDescriptions', '显示模型自述的本次调用说明'),
    React.createElement('p', { style: mutedStyle }, '给每个工具声明一个可选的 description 参数，模型就会用一句话说明这次调用要做什么，显示在对话界面的工具行上（bash 一直是这么显示的）。这一半由本插件完成；界面显示部分还需要仓库 patches/ 里的官方补丁并重新构建客户端——没打补丁时模型仍会填写，但工具行只显示原来的路径或参数。'),
    React.createElement('h3', { style: settingsGroupStyle }, '媒体展示'),
    toggle('audioAutoplay', 'Agent 展示音频时自动播放'),
    toggle('videoAutoplay', 'Agent 展示视频时自动播放'),
    React.createElement('p', { style: mutedStyle }, '只在当前聊天已打开后，Agent 新完成展示调用时尝试播放；进入聊天或恢复历史消息不会播放。浏览器仍可能阻止未交互页面的有声自动播放。'))
}

function MarkdownPreviewController({ sessionId, readMarkdown }) {
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
          : React.createElement(MarkdownText, { text: preview.text }),
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

function inlineTrailingActivity(row, button, inlineRows) {
  const content = [...row.children].find(child => child !== button) ?? null
  Object.assign(row.style, { alignItems: 'center', display: 'flex', flexDirection: 'row', gap: '8px' })
  if (content !== null) Object.assign(content.style, { flex: '1 1 auto', minWidth: '0' })
  button.style.flex = '0 0 auto'
  button.style.width = 'auto'
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
          group.button.type = 'button'
          group.button.dataset[toggleKey] = key
          Object.assign(group.button.style, toolGroupButtonStyle)
          group.button.setAttribute('aria-expanded', String(expanded))
          group.button.textContent = `${expanded ? '⌄' : '›'} ${label(hiddenRows.length)}`
          group.button.onclick = (event) => {
            event.preventDefault()
            event.stopPropagation()
            if (expandedRef.current.has(key)) expandedRef.current.delete(key)
            else expandedRef.current.add(key)
            sync()
          }
          if (!expanded) inlineTrailingActivity(trailingRow, group.button, nextInlineRows)
          else {
            group.button.style.flex = ''
            group.button.style.width = '100%'
            const buttonParent = hiddenRows[0]?.parentElement ?? parent
            if (group.button.parentElement !== buttonParent || group.button.nextElementSibling !== hiddenRows[0]) buttonParent.insertBefore(group.button, hiddenRows[0])
          }
          for (const row of hiddenRows) row.hidden = !expanded
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
      if (records.some(record => !(record.target instanceof Element && record.target.closest(`[data-${toggleKey.replace(/[A-Z]/gu, letter => `-${letter.toLowerCase()}`)}]`) !== null))) schedule()
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
 * and restore the collapsed summary as soon as it settles.
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
    const schedule = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        sync()
      })
    }
    const sync = () => {
      for (const row of document.querySelectorAll('[data-variant="think"]')) {
        if (row.dataset.state === 'running') expandRunningThinkRow(row)
        else collapseSettledThinkRow(row)
      }
    }
    const observer = new MutationObserver(schedule)
    // `subtree` on the flow column: a Think row appears, flips to `running`,
    // and settles as attributes on nodes DSH already mounted.
    observer.observe(document.body, { attributes: true, childList: true, subtree: true })
    schedule()
    return () => {
      observer.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [enabled])
  return null
}

function ReasoningAutoExpandSlot(props) {
  return React.createElement(ReasoningAutoExpandController, props)
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

const inject = ['slots', 'sessions', 'remote', 'settingsScope', 'conversation', 'locale', 'modelDirectories']

async function apply(ctx) {
  ctx.effect(() => ctx.locale.register('chat-enhancement-annotations', annotationLocales))
  const dispose = await ctx.remote.$mount(previewRemote)
  const sessions = ctx.get('sessions')
  const chatSettings = ctx.settingsScope.bind({ namespace: 'chat-enhancement' })
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
    name: 'conversation.input.dock', id: 'chat-enhancement-markdown-preview', order: 100,
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

    return { inject, apply, createMediaAutoplayGate, modelForMessage, thinkRowTarget, thinkRowExpanded, expandRunningThinkRow, collapseSettledThinkRow }
  },
})
