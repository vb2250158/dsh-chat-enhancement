import * as React from 'react'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import { createCodeReferenceNavigation } from './code-references.js'

const codeReferenceCss = `
.dsh-code-reference { display:flex; flex:1 1 auto; flex-direction:column; width:100%; height:100%; min-width:0; min-height:0; overflow:hidden; white-space:normal; }
.dsh-code-reference .dsh-code-reference-block { --dsl-code-block-border-radius:0px; --dsl-code-block-line-white-space:pre; --dsl-code-block-background:transparent; display:flex; flex:1 1 auto; flex-direction:column; height:100%; min-height:0; position:static; margin:0; min-width:0; }
.dsh-code-reference-block > [data-code-block-content] { position:relative; display:block; flex:1 1 auto; min-width:0; min-height:0; overflow:auto; }
.dsh-code-reference-block pre { box-sizing:border-box; min-width:100%; overflow:visible; white-space:pre; word-break:normal; overflow-wrap:normal; }
.dsh-code-reference[data-wrap="true"] .dsh-code-reference-block { --dsl-code-block-line-white-space:pre-wrap; }
.dsh-code-reference[data-wrap="true"] pre { white-space:pre-wrap; overflow-wrap:anywhere; }
`
const codeReferenceLanguages = {
  typescript: 'ts tsx mts cts', javascript: 'js jsx mjs cjs', shellscript: 'sh bash zsh', json: 'json jsonc jsonl ndjson',
  python: 'py pyw pyi', ruby: 'rb rake gemspec', go: 'go', rust: 'rs', java: 'java', c: 'c h', cpp: 'cc cpp cxx hh hpp hxx',
  csharp: 'cs', kotlin: 'kt kts', swift: 'swift', php: 'php', yaml: 'yaml yml', toml: 'toml', ini: 'ini', markdown: 'md markdown',
  mdx: 'mdx', html: 'html htm xhtml', css: 'css', scss: 'scss', less: 'less', sql: 'sql', xml: 'xml xsd xsl xslt', lua: 'lua',
}

/** Source body inside DSH's existing file tab; the owner still reads, pages, reloads, and navigates. */
export function CodeReferencePreview({ resourceAddress, content, wrap, scrollportRef, t, navigation, chatSettings }) {
  const request = React.useSyncExternalStore(navigation.subscribe, navigation.getSnapshot, navigation.getSnapshot)
  const subscribeSettings = React.useCallback(listener => chatSettings.subscribe(listener), [chatSettings])
  const readSettings = React.useCallback(() => chatSettings.getSnapshot(), [chatSettings])
  const settings = React.useSyncExternalStore(subscribeSettings, readSettings, readSettings)
  const duration = settings.value?.codeReferenceHighlightMs ?? 1600
  const viewport = React.useRef(null)
  const [flash, setFlash] = React.useState(null)
  const handled = React.useRef(null)
  const target = request?.address === resourceAddress ? request : null
  const loaded = content.kind === 'text' ? Math.max(0, ...content.pages.map(page => page.offset + page.lines - 1)) : 0
  const ready = target !== null && (loaded >= target.endLine || content.kind === 'text' && content.eof)
  const ref = React.useCallback(element => { viewport.current = element; scrollportRef(element) }, [scrollportRef])
  React.useEffect(() => {
    setFlash(null)
    if (!ready || handled.current === target.revision) return
    handled.current = target.revision
    const frame = requestAnimationFrame(() => {
      const row = viewport.current?.querySelectorAll('pre .line').item(target.startLine - 1)
      if (row) {
        viewport.current.scrollTop = Math.max(0, row.offsetTop - 24)
        setFlash(target)
      }
    })
    const timer = setTimeout(() => setFlash(null), duration)
    return () => { cancelAnimationFrame(frame); clearTimeout(timer) }
  }, [target, ready, duration])
  if (content.kind !== 'text') return null
  const extension = /\.([^./]+)$/u.exec(resourceAddress)?.[1]?.toLowerCase()
  const language = Object.keys(codeReferenceLanguages).find(key => codeReferenceLanguages[key].split(' ').includes(extension))
  const id = flash ? `code-reference-${flash.revision}` : undefined
  return React.createElement('div', { className: 'dsh-code-reference', 'data-code-preview': true, 'data-wrap': wrap, 'data-code-reference-flash': id },
    flash && React.createElement('style', null, `[data-code-reference-flash="${id}"] pre .line:nth-child(n+${flash.startLine}):nth-child(-n+${flash.endLine}) { background:color-mix(in srgb,var(--dsw-alias-link) 24%,transparent); box-shadow:inset 3px 0 var(--dsw-alias-link); }`),
    React.createElement(CodeBlock, { className: 'dsh-code-reference-block', contentRef: ref, code: content.text, lang: language, streaming: !content.eof, lineNumbers: true, copyLabel: t('copy'), copiedLabel: t('copied') }))
}

/** Publish link navigation and replace only the source body through its public renderer slot. */
export function installCodeReferences(ctx, chatSettings) {
  const navigation = createCodeReferenceNavigation(ctx.sidebarRight)
  ctx.effect(() => ctx.reflect.provide('chatCodeReferences', navigation))
  ctx.effect(() => () => navigation.dispose())
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = codeReferenceCss
    document.head.appendChild(style)
    return () => style.remove()
  })
  ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
    name: 'sidebar.right.tab.document', key: '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/code', priority: -10, locale: 'sidebarCodePreview',
    inject: () => ({ navigation, chatSettings }),
  }, CodeReferencePreview)))
}
