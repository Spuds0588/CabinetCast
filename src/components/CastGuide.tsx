import { useEffect } from 'react'

interface Props {
  fullscreen: boolean
  onFullscreen: () => void
  onClose: () => void
}

/**
 * Chrome's Cast menu mirrors a tab, but only the browser can start that: a page can open a receiver
 * app, not press the toolbar's Cast button. So the button explains the two steps instead of pretending
 * it can cast. Tab mirroring follows the tab into fullscreen, which is why the order matters.
 */
export function CastGuide({ fullscreen, onFullscreen, onClose }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Cast this tab" onClick={onClose}>
      <div className="cast-card" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h2>Cast this tab</h2>
          <button className="icon" onClick={onClose} aria-label="Close cast guide">
            ×
          </button>
        </div>
        <ol>
          <li>
            Open Chrome's <b>Cast</b> menu, the icon in the toolbar or <b>⋮ → Cast…</b>, choose <b>Cast tab</b>, then
            pick your TV.
          </li>
          <li>
            Start the cast first, then come back here and go fullscreen. The TV follows the tab, sound included.
          </li>
        </ol>
        <p className="muted small">
          Only the browser can start a tab cast. Chrome mirrors at up to 720p and the TV scales it; fullscreen hides
          the toolbar, so cast before you go full.
        </p>
        <div className="row">
          <button className="ghost" onClick={onClose}>
            Close
          </button>
          <button className="primary" onClick={onFullscreen}>
            {fullscreen ? 'Exit fullscreen' : 'Fullscreen cabinet'} <kbd>⇧F</kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
