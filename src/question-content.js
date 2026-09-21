/** 问题正文复用官方 Markdown 原语及宿主鉴权文件接口。 */
import * as React from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'

/** 映射绝对文件路径；相对路径、UNC 和其它协议保持惰性文本。 */
export function questionImageUrl(value, location) {
  if (!['http:', 'https:'].includes(location.protocol)) return undefined
  if (typeof value !== 'string' || /[\u0000-\u001f]/u.test(value)) return undefined
  if (!(value.startsWith('/') && !value.startsWith('//')) && !/^[a-z]:[\\/]/iu.test(value)) return undefined
  return `${location.origin}/api/file?path=${encodeURIComponent(value)}`
}

export const questionContentLocales = {
  zh: { copy: '复制', copied: '已复制', footnotes: '脚注' },
  en: { copy: 'Copy', copied: 'Copied', footnotes: 'Footnotes' },
}

export const questionContentCss = `
.dsh-question-rich { min-width: 0; overflow-wrap: anywhere; color: inherit; font: inherit; }
.dsh-question-rich > :first-child { margin-top: 0; }
.dsh-question-rich > :last-child { margin-bottom: 0; }
.dsh-question-rich img { display: block; max-width: 100%; max-height: 320px; object-fit: contain; margin: 8px 0; border-radius: 6px; }
`

/** 仅改变显示，选择答案仍使用提问方提供的原始标签。 */
export function QuestionRichContent({ text, t }) {
  const pathImages = React.useMemo(() => ({ resolve: value => questionImageUrl(value, window.location) }), [])
  const labels = React.useMemo(() => ({ code: { copyLabel: t('copy'), copiedLabel: t('copied') }, footnotes: t('footnotes') }), [t])
  return React.createElement('div', { className: 'dsh-question-rich' }, React.createElement(MarkdownText, { text, labels, pathImages }))
}
