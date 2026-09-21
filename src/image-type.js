/** 按图片签名修正声明类型；完整解码和资源限制由附件服务执行。 */
export function normalizeImageType(input) {
  const data = input.data
  const starts = bytes => bytes.every((byte, index) => data[index] === byte)
  let mediaType
  if (starts([0xff, 0xd8, 0xff])) mediaType = 'image/jpeg'
  else if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) mediaType = 'image/png'
  else if (starts([0x47, 0x49, 0x46, 0x38]) && (data[4] === 0x37 || data[4] === 0x39) && data[5] === 0x61) mediaType = 'image/gif'
  else if (starts([0x52, 0x49, 0x46, 0x46]) && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) mediaType = 'image/webp'
  return mediaType === undefined || mediaType === input.mediaType ? input : { ...input, mediaType }
}
