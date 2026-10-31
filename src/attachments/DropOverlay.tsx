import { createPortal } from 'react-dom'
import css from './DropOverlay.module.css'

/** Caller-owned, localized availability text; no drop handler or upload ownership. */
export interface DropOverlayLabels {
  title: string
  desc?: string | undefined
}

/** Decorative, pointer-transparent invitation; the caller owns accepting files. */
export function DropOverlay({
  disabled,
  labels,
}: {
  disabled: boolean
  labels: DropOverlayLabels
}) {
  return createPortal(
    <div className={css.mask} role="status">
      <div className={css.wrap}>
        <div className={css.title}>{labels.title}</div>
        {!disabled && labels.desc !== undefined && (
          <div className={css.desc}>{labels.desc}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
