/** Exercise source-only attachment experiments against an explicitly selected DSH checkout. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
const arg = (n) => {
  const i = process.argv.indexOf('--' + n)
  assert(i >= 0, 'Supply --' + n)
  return path.resolve(process.argv[i + 1])
}
const core = arg('dsh-source'),
  output = arg('output'),
  pw = arg('playwright'),
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
assert(!fs.existsSync(output), 'Evidence directory must be new')
fs.mkdirSync(output, { recursive: true })
const req = createRequire(core + '/package.json'),
  primitiveRoot = core + '/packages/client/ui-primitives',
  preq = createRequire(primitiveRoot + '/package.json'),
  ts = req('typescript'),
  { createServer } = await import(pathToFileURL(req.resolve('vite'))),
  { chromium } = await import(pathToFileURL(pw))
const typeReact = path.dirname(preq.resolve('@types/react/package.json')),
  typeDom = path.dirname(preq.resolve('@types/react-dom/package.json'))
const declaration = output + '/css.d.ts'
fs.writeFileSync(
  declaration,
  'declare module "*.module.css" { const css: Record<string,string>; export default css }\n',
)
const names = ['AttachmentRail', 'FileCard', 'DropOverlay', 'ImageLightbox'],
  files = names.map((n) => root + '/src/attachments/' + n + '.tsx')
const program = ts.createProgram([...files, declaration], {
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2023,
  esModuleInterop: true,
  baseUrl: root,
  ignoreDeprecations: '6.0',
  paths: {
    react: [typeReact + '/index.d.ts'],
    'react/jsx-runtime': [typeReact + '/jsx-runtime.d.ts'],
    'react-dom': [typeDom + '/index.d.ts'],
    '@deepseek-ai/dsh-client-ui-primitives': [
      primitiveRoot + '/lib/types/index.d.ts',
    ],
  },
})
const diagnostics = ts.getPreEmitDiagnostics(program)
fs.writeFileSync(
  output + '/typecheck.txt',
  ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  }),
)
assert.equal(diagnostics.length, 0, 'See typecheck.txt')
const modulePath = (n) =>
  JSON.stringify(root.replaceAll('\\', '/') + '/src/attachments/' + n + '.tsx')
fs.writeFileSync(
  output + '/main.tsx',
  `import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';\n${names.map((n) => `import {${n}} from ${modulePath(n)};`).join('\n')}\nfunction Demo(){const[preview,setPreview]=useState(false),[state,setState]=useState<'error'|'ready'>('error'),[removed,setRemoved]=useState(false),[drop,setDrop]=useState(false);return <><button id="open" onClick={()=>setPreview(true)}>Preview</button><button id="drop" onClick={()=>setDrop(!drop)}>Toggle drop</button><div style={{width:360}}><AttachmentRail items={Array.from({length:8},(_,i)=>({id:String(i)}))} labels={{group:'Attachments',scrollLeft:'Previous',scrollRight:'Next'}} renderItem={item=><div style={{width:220}}>File {item.id}</div>}/></div>{!removed&&<FileCard name="notes.txt" bytes={128} state={state} labels={{label:'Pending notes',remove:'Remove notes',retry:'Retry notes',uploading:'Uploading',failed:'Failed'}} onRemove={()=>setRemoved(true)} onRetry={()=>setState('ready')}/ >}{preview&&<ImageLightbox src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'/%3E" alt="Synthetic preview" labels={{dialog:'Image preview',close:'Close preview'}} onClose={()=>setPreview(false)}/ >}{drop&&<DropOverlay disabled={false} labels={{title:'Drop synthetic files',desc:'No upload is performed'}}/>}</>};createRoot(document.getElementById('root')!).render(<Demo/>);`,
)
fs.writeFileSync(
  output + '/index.html',
  '<!doctype html><html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>',
)
let server, browser
const errors = [],
  checks = []
try {
  server = await createServer({
    configFile: false,
    root: output,
    cacheDir: output + '/vite-cache',
    logLevel: 'error',
    resolve: {
      alias: [
        {
          find: '@deepseek-ai/dsh-client-ui-primitives',
          replacement: primitiveRoot + '/src/index.ts',
        },
        {
          find: 'react-dom/client',
          replacement: preq.resolve('react-dom/client'),
        },
        { find: 'react-dom', replacement: preq.resolve('react-dom') },
        {
          find: 'react/jsx-dev-runtime',
          replacement: preq.resolve('react/jsx-dev-runtime'),
        },
        {
          find: 'react/jsx-runtime',
          replacement: preq.resolve('react/jsx-runtime'),
        },
        { find: 'react', replacement: preq.resolve('react') },
      ],
    },
    server: {
      host: '127.0.0.1',
      port: 14938,
      strictPort: true,
      fs: { allow: [output, root, core] },
    },
  })
  await server.listen()
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url())
    return u.protocol === 'data:' ||
      (u.hostname === '127.0.0.1' && u.port === '14938')
      ? r.continue()
      : r.abort()
  })
  await page.goto('http://127.0.0.1:14938/')
  await page.getByRole('button', { name: 'Retry notes' }).click()
  await page
    .getByRole('button', { name: 'Retry notes' })
    .waitFor({ state: 'detached' })
  checks.push('retry state callback')
  await page.getByRole('button', { name: 'Remove notes' }).click()
  await page
    .getByRole('group', { name: 'Pending notes' })
    .waitFor({ state: 'detached' })
  checks.push('remove callback')
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.getByRole('dialog', { name: 'Image preview' }).waitFor()
  await page.keyboard.press('Tab')
  assert(
    await page
      .getByRole('dialog')
      .evaluate((el) => el.contains(document.activeElement)),
  )
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  assert.equal(
    await page.locator('#open').evaluate((el) => el === document.activeElement),
    true,
  )
  checks.push('Modal focus containment Escape and return focus')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Previous', exact: true }).waitFor()
  checks.push('rail paging')
  await page.locator('#drop').click()
  await page.getByRole('status').waitFor()
  assert.equal(
    await page
      .getByRole('status')
      .evaluate((el) => getComputedStyle(el).pointerEvents),
    'none',
  )
  checks.push('overlay pointer transparency')
  await page.screenshot({ path: output + '/components.png' })
  assert.deepEqual(errors, [])
  fs.writeFileSync(
    output + '/acceptance.json',
    JSON.stringify(
      {
        ready: true,
        typecheck: true,
        realPublicPrimitives: true,
        checks,
        errors,
        synthetic: true,
        composerIntegrated: false,
        formalTouched: false,
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  await browser?.close()
  await server?.close()
  fs.writeFileSync(
    output + '/stopped.json',
    JSON.stringify({ browserClosed: true, serverClosed: true, port: 14938 }) +
      '\n',
  )
}
console.log(JSON.stringify({ ready: true, checks }))
