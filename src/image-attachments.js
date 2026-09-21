/** 复用官方附件存储，仅在解码前纠正图片的 MIME 声明。 */
import LocalAttachmentStore from '@deepseek-ai/dsh-attachment-local'
import { normalizeImageType } from './image-type.js'

/** 保留官方配置、存储路径、压缩、读取及普通文件行为。 */
export default class ChatImageAttachmentStore extends LocalAttachmentStore {
  /** 校验识别后的图片，损坏文件仍由官方解码器拒绝。 */
  validateImage(input) {
    return super.validateImage(normalizeImageType(input))
  }

  /** 在整批校验前统一类型，保持原有先校验后保存的语义。 */
  saveImages(inputs) {
    return super.saveImages(inputs.map(normalizeImageType))
  }

  /** 保存单张图片，保留原始文件名和字节。 */
  saveImage(input) {
    return super.saveImage(normalizeImageType(input))
  }
}
