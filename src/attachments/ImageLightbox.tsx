import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './ImageLightbox.module.css'

/** Strings resolved by the experimental preview owner. */
export interface ImageLightboxLabels {
  dialog: string
  close: string
}

/** Preview with public Modal-owned Escape, focus containment and focus restoration. */
export function ImageLightbox({
  src,
  alt,
  labels,
  onClose,
}: {
  src: string
  alt: string
  labels: ImageLightboxLabels
  onClose: () => void
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={labels.dialog}
      closeLabel={labels.close}
    >
      <img className={css.image} src={src} alt={alt} />
    </Modal>
  )
}
