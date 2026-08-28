import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('..', import.meta.url)

test('declares a web bundle and the read_image tool view', async () => {
  const manifest = JSON.parse(await readFile(new URL('./package.json', root), 'utf8'))
  const client = await readFile(new URL('./lib/client.js', root), 'utf8')

  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.match(client, /key: 'read_image'/)
  assert.match(client, /readAttachment/)
  assert.doesNotMatch(client, /file:\/\//)
})
