import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCodeReference, codeReferenceAddress, createCodeReferenceNavigation } from '../src/code-references.js'

test('正文代码链接解析单行、范围及转义路径，拒绝网页和无效范围', () => {
  assert.deepEqual(parseCodeReference('C:/项目/a%20b.js#L73-L74'), { path: 'C:/项目/a b.js', startLine: 73, endLine: 74 })
  assert.deepEqual(parseCodeReference('src/index.js#L1'), { path: 'src/index.js', startLine: 1, endLine: 1 })
  for (const value of ['https://example.com/a#L1', 'javascript:alert(1)#L1', '//host/share#L1', 'a#L0', 'a#L9-L2', 'a#L999999999999999999', 'a%00#L1', '%broken#L1', '#L1', '73–74 行']) assert.equal(parseCodeReference(value), null, value)
  assert.equal(codeReferenceAddress('a b', './src/a #.js'), 'dsh-resource://file/session/a%20b/src/a%20%23.js')
})

test('点击复用原预览器并加载至末行，重点击更新意图、切换会话隔离地址', () => {
  const calls = []
  const nav = createCodeReferenceNavigation({ openResourceIn: (...args) => calls.push(args) })
  let notifications = 0
  const unsubscribe = nav.subscribe(() => notifications++)
  assert.equal(nav.open('one', 'src/a.js#L73-L74'), true)
  assert.deepEqual(calls[0], ['one', 'dsh-resource://file/session/one/src/a.js', { kind: 'text', params: { line: 74 } }])
  const first = nav.getSnapshot()
  nav.open('one', 'src/a.js#L73-L74')
  assert.ok(nav.getSnapshot().revision > first.revision)
  nav.open('two', 'src/a.js#L73-L74')
  assert.notEqual(nav.getSnapshot().address, first.address)
  assert.equal(nav.open('two', 'https://example.com#L1'), false)
  assert.equal(notifications, 3)
  unsubscribe(); nav.open('two', 'a.js#L1')
  assert.equal(notifications, 3)
  nav.dispose(); assert.equal(nav.getSnapshot(), null)
})
