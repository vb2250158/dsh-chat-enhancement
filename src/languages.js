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
export const LANGUAGES = [
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
export function languageInstruction(id) {
  const { name, native } = languageEntry(id)
  if (name === null || native === null) return ''
  return [
    '## Language Preference',
    native,
    `Your reasoning and every user-visible reply must be in ${name}, even when this prompt, the tool output, the code, and the surrounding conversation are all in English. Do not fall back to English for thinking.`,
    'Never translate code, identifiers, file paths, shell commands, log output, error text, or quoted text; reproduce them exactly as they appear.',
    'An explicit request for another language inside the conversation overrides this for that request only.',
  ].join('\n')
}
