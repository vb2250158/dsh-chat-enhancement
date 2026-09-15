/** Package the dependency-free browser source into the DSH module loader envelope. */
import { readFile, writeFile } from 'node:fs/promises'
const root = new URL('../', import.meta.url)
const annotations = (await readFile(new URL('src/annotations.js', root), 'utf8'))
  .replace(/^import [^\r\n]*\r?\n/gmu, '').replace(/^export /gmu, '')
const client = (await readFile(new URL('src/client.js', root), 'utf8'))
  .replace(/^import [^\r\n]*\r?\n/gmu, '').replace(/^export /gmu, '')
await writeFile(new URL('lib/client.js', root), `window.__ModuleLoader__.load({
  id: 'dsh-chat-enhancement',
  factory: (require) => {
    const React = require('react')
    const { MarkdownText, Button } = require('@deepseek-ai/dsh-client-ui-primitives')
${annotations}
${client}
    return { inject, apply, createMediaAutoplayGate, modelForMessage }
  },
})\n`)
