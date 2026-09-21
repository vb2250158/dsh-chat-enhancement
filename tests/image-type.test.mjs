import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeImageType } from '../src/image-type.js'

test('按内容纠正四种受支持图片，保留原文件和数据', () => {
  for (const [mediaType, bytes] of [
    ['image/jpeg', [255, 216, 255, 224]],
    ['image/png', [137, 80, 78, 71, 13, 10, 26, 10]],
    ['image/gif', [...Buffer.from('GIF89a')]],
    ['image/gif', [...Buffer.from('GIF87a')]],
    ['image/webp', [...Buffer.from('RIFFxxxxWEBP')]],
  ]) {
    const input = { data: new Uint8Array(bytes), mediaType: 'image/incorrect', name: '聊天图片.png' }
    const result = normalizeImageType(input)
    assert.equal(result.mediaType, mediaType)
    assert.equal(result.data, input.data)
    assert.equal(result.name, input.name)
    assert.equal(input.mediaType, 'image/incorrect')
    assert.equal(normalizeImageType(result), result)
  }
})

test('未知、空白及截断签名交由原校验器处理', () => {
  for (const bytes of [[], [255, 216], [...Buffer.from('GIF88a')], [...Buffer.from('<svg/>')]]) {
    const input = { data: new Uint8Array(bytes), mediaType: 'image/png' }
    assert.equal(normalizeImageType(input), input)
  }
})
