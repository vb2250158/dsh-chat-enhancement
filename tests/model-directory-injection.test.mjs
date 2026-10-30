import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import vm from 'node:vm'
import * as React from 'react'

const sourceRoot = process.env.DSH_TEST_SOURCE_ROOT

/** Load the shipped browser module without replacing its apply or inject exports. */
async function browserModule(file, dependencies) {
  let entry
  vm.runInNewContext(await readFile(file, 'utf8'), {
    window: { __ModuleLoader__: { load(value) { entry = value } } },
    document: { querySelector: () => ({}), createElement: () => ({ remove() {} }), head: { appendChild() {} } },
  })
  return entry.factory(name => dependencies[name] ?? {})
}

for (const id of ['chat-enhancement-running-model', 'chat-enhancement-turn-model']) {
  test(`${id} creates its first shared model directory through real Cordis injection`, {
    skip: sourceRoot ? false : 'Set DSH_TEST_SOURCE_ROOT to the built DSH checkout for the Cordis integration',
  }, async t => {
    const core = pathToFileURL(`${sourceRoot.replaceAll('\\', '/')}/`)
    const cordis = await import(new URL('vendor/cordis/lib/index.js', core))
    const store = await import(new URL('packages/client/store/lib/index.js', core))
    const { ModelDirectoryResolver } = await browserModule(new URL('packages/client/ui-model-selection/lib/client.js', core), {
      '@deepseek-ai/cordis': cordis,
      '@deepseek-ai/dsh-client-store': store,
      react: React,
    })
    const plugin = await browserModule(new URL('../lib/client.js', import.meta.url), { react: React })
    const root = new cordis.Context()
    t.after(() => root.fiber.dispose())
    let catalogCalls = 0
    const selection = { provider: 'test-provider', model: 'test-model' }
    const catalog = { default: selection, groups: [{ id: 'test-provider', name: 'Test provider', models: [{ id: 'test-model', name: 'Test model' }] }], failures: [] }
    await root.plugin({
      name: 'session-wire-fixture',
      apply(ctx) {
        ctx.provide('remote.session', {
          async modelCatalog() { catalogCalls += 1; return { ok: true, value: catalog } },
          async selectModel() { assert.fail('Rendering a model label must not select a model') },
        })
      },
    })
    root.provide('remote.goals', {})
    // The gateway exposes namespace getters through the caller's traced context.
    class Remote extends cordis.Service {
      constructor(ctx) { super(ctx, 'remote') }
      get session() { return this.ctx['remote.session'] }
      $on() { return () => {} }
      async $mount() { return () => {} }
    }
    new Remote(root)
    const scopes = new Map(), bindings = new Map()
    for (const sessionId of ['first-session', 'second-session']) {
      scopes.set(sessionId, root.extend())
      const projection = store.createSnapshotStore({ next: selection })
      bindings.set(sessionId, { session: { projections: { faceOf: () => projection }, getSnapshot: () => ({ blank: false }) } })
    }
    root.provide('sessions', { scope: id => scopes.get(id), binding: id => bindings.get(id), subagentAddress() {} })
    const registrations = new Map()
    root.provide('slots', {
      inject(_name, callback) { return callback() },
      register(options) { registrations.set(options.id, options); return () => registrations.delete(options.id) },
    })
    root.provide('locale', { register() { return () => {} } })
    root.provide('configForms', { get: () => ({ getSnapshot: () => ({ status: 'ready', value: {} }), subscribe: () => () => {} }) })
    root.provide('conversation', {})
    root.provide('sidebarRight', {})
    root.provide('remote.chatMedia', { read() {} })
    root.provide('remote.chatMarkdown', { read() {} })
    new ModelDirectoryResolver(root)
    await new Promise((resolve, reject) => {
      root.plugin({
        name: 'chat-model-label-integration', inject: [...plugin.inject],
        async apply(ctx) { try { await plugin.apply(ctx); resolve() } catch (error) { reject(error) } },
      })
    })
    const slot = registrations.get(id)
    assert.ok(slot)
    const first = slot.inject('first-session')
    assert.ok(first.hooks.modelDirectory)
    await first.loadModelDirectory()
    assert.equal(first.hooks.modelDirectory.getSnapshot().groups[0].id, 'test-provider')
    assert.equal(slot.inject('first-session').hooks.modelDirectory, first.hooks.modelDirectory)
    const second = slot.inject('second-session')
    assert.notEqual(second.hooks.modelDirectory, first.hooks.modelDirectory)
    assert.equal(catalogCalls, 1)
  })
}
