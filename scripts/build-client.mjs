/** Package the dependency-free browser source into the DSH module loader envelope. */
import { readFile, writeFile } from 'node:fs/promises'
const root = new URL('../', import.meta.url)
const strip = source => source
  .replace(/^import [^\r\n]*\r?\n/gmu, '').replace(/^export /gmu, '')
// `languages.js` is first because the Host and browser halves share its
// catalog: stripping the imports leaves one top-level `const`, which every
// later module must be able to read at evaluation time.
const languages = strip(await readFile(new URL('src/languages.js', root), 'utf8'))
const annotations = strip(await readFile(new URL('src/annotations.js', root), 'utf8'))
const client = strip(await readFile(new URL('src/client.js', root), 'utf8'))
await writeFile(new URL('lib/client.js', root), `window.__ModuleLoader__.load({
  id: 'dsh-chat-enhancement',
  factory: (require) => {
    const React = require('react')
    const { MarkdownText, Button, Menu, IconChevronDownOutline14 } = require('@deepseek-ai/dsh-client-ui-primitives')
${languages}
${annotations}
${client}
    return { inject, apply, createMediaAutoplayGate, modelForMessage }
  },
})\n`)
