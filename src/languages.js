/**
 * Shared language catalog for the chat-enhancement language preference.
 *
 * Both halves of the bundle read this one list: the browser half renders the
 * settings options, the Host half turns the stored id into the system-prompt
 * instruction. A single module is what keeps those two views from drifting —
 * adding a language is one entry, not two lists that must agree by hand.
 */

/** Stored value meaning "no constraint": the model keeps following the user. */
export const AUTO_LANGUAGE = 'auto'

/**
 * Selectable languages, in menu order.
 *
 * `id` is the value persisted in the `chat-enhancement` settings namespace and
 * is treated as an opaque key: an unknown stored id resolves to `auto`, so a
 * hand-edited or forward-dated document degrades instead of failing a turn.
 * `label` is the option text shown in settings. `instruction` is the language
 * named in the system prompt, written in English with the endonym in
 * parentheses so the model gets both the unambiguous name and the native
 * spelling it has to produce; `null` contributes no instruction at all.
 */
export const LANGUAGES = [
  { id: AUTO_LANGUAGE, label: '跟随对话（默认，不限制）', instruction: null },
  { id: 'zh-CN', label: '简体中文', instruction: 'Simplified Chinese (简体中文)' },
  { id: 'zh-TW', label: '繁體中文', instruction: 'Traditional Chinese (繁體中文)' },
  { id: 'en', label: 'English', instruction: 'English' },
  { id: 'ja', label: '日本語', instruction: 'Japanese (日本語)' },
  { id: 'ko', label: '한국어', instruction: 'Korean (한국어)' },
  { id: 'fr', label: 'Français', instruction: 'French (Français)' },
  { id: 'de', label: 'Deutsch', instruction: 'German (Deutsch)' },
  { id: 'es', label: 'Español', instruction: 'Spanish (Español)' },
  { id: 'pt', label: 'Português', instruction: 'Portuguese (Português)' },
  { id: 'it', label: 'Italiano', instruction: 'Italian (Italiano)' },
  { id: 'nl', label: 'Nederlands', instruction: 'Dutch (Nederlands)' },
  { id: 'pl', label: 'Polski', instruction: 'Polish (Polski)' },
  { id: 'sv', label: 'Svenska', instruction: 'Swedish (Svenska)' },
  { id: 'ru', label: 'Русский', instruction: 'Russian (Русский)' },
  { id: 'uk', label: 'Українська', instruction: 'Ukrainian (Українська)' },
  { id: 'tr', label: 'Türkçe', instruction: 'Turkish (Türkçe)' },
  { id: 'ar', label: 'العربية', instruction: 'Arabic (العربية)' },
  { id: 'he', label: 'עברית', instruction: 'Hebrew (עברית)' },
  { id: 'hi', label: 'हिन्दी', instruction: 'Hindi (हिन्दी)' },
  { id: 'th', label: 'ไทย', instruction: 'Thai (ไทย)' },
  { id: 'vi', label: 'Tiếng Việt', instruction: 'Vietnamese (Tiếng Việt)' },
  { id: 'id', label: 'Bahasa Indonesia', instruction: 'Indonesian (Bahasa Indonesia)' },
  { id: 'ms', label: 'Bahasa Melayu', instruction: 'Malay (Bahasa Melayu)' },
]

/** The `auto` entry, which every unknown or absent stored id falls back to. */
const AUTO_ENTRY = LANGUAGES[0]

/**
 * Resolve one stored id to its catalog entry.
 * @param id - the persisted language id, or anything a hand-edited document holds.
 * @returns the matching entry, or the `auto` entry when nothing matches.
 */
export function languageEntry(id) {
  return LANGUAGES.find(language => language.id === id) ?? AUTO_ENTRY
}

/**
 * Build the system-prompt instruction for one stored language id.
 *
 * Empty text means "contribute nothing", which is how `auto` keeps the
 * assembled prompt identical to a deployment that never configured this
 * preference — `renderPrompt` drops zero-length sections.
 * @param id - the persisted language id.
 * @returns the instruction text, or an empty string under `auto` or an unknown id.
 */
export function languageInstruction(id) {
  const { instruction } = languageEntry(id)
  if (instruction === null) return ''
  return [
    '## Language Preference',
    `Write everything you say to the user in ${instruction}: explanations, plans, questions, summaries, and report or commit text. Reason in ${instruction} as well, so your visible thinking and your answer are in the same language.`,
    'This holds regardless of the language of the surrounding instructions, of the code and file names you touch, or of the incoming message. A request for another language inside the conversation overrides it for that request only.',
    'Never translate code, identifiers, file paths, shell commands, log output, error text, or quoted source; reproduce them exactly as they appear.',
  ].join('\n')
}
