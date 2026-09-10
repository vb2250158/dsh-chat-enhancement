/** Browser-computed colors against real DSH tokens, without a server or live session. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'

if (!process.env.DSH_PLAYWRIGHT_ROOT || !process.env.DSH_SOURCE_ROOT) throw new Error('Set DSH_PLAYWRIGHT_ROOT and DSH_SOURCE_ROOT to existing development dependencies and DSH source.')
const { chromium } = await import(pathToFileURL(resolve(process.env.DSH_PLAYWRIGHT_ROOT, 'index.mjs')).href)
const source = (await readFile(new URL('../src/annotations.js', import.meta.url), 'utf8')).replace(/^import .*\n/gmu, '').replace(/^export /gmu, '')
const panelStyle = vm.runInNewContext(source + '\n;annotationPanelStyle')
const inputBackground = /background: '(var\(--dsw-alias-[^']+\))'/.exec(source.slice(source.indexOf("React.createElement('textarea'")))?.[1]
assert.ok(inputBackground)
const css = await readFile(resolve(process.env.DSH_SOURCE_ROOT, 'packages/client/ui-theme/src/styles/design-platform.css'), 'utf8')
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.setContent('<body><div id="panel"><textarea></textarea></div></body>')
  await page.addStyleTag({ content: css })
  await page.evaluate(({ panelStyle, inputBackground }) => {
    Object.assign(document.getElementById('panel').style, panelStyle)
    document.querySelector('textarea').style.background = inputBackground
  }, { panelStyle, inputBackground })
  const colors = []
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => { document.body.toggleAttribute('data-ds-dark-theme', theme === 'dark') }, theme)
    const result = await page.evaluate(() => ({ panel: getComputedStyle(document.getElementById('panel')).backgroundColor, input: getComputedStyle(document.querySelector('textarea')).backgroundColor }))
    for (const [surface, color] of Object.entries(result)) {
      assert.match(color, /^rgb\(/, `${theme} ${surface} must have an opaque computed color, got ${color}`)
    }
    colors.push(result)
    console.log(`PASS ${theme}: ${JSON.stringify(result)}`)
  }
  assert.notEqual(colors[0].panel, colors[1].panel, 'light and dark must exercise distinct real theme surfaces')
} finally { await browser.close() }
