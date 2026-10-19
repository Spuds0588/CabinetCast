import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { keyLabel } from '../core/input'
import { INPUT_BITS, KEY_BITS } from '../core/protocol'

const DIRECTIONS = [INPUT_BITS.UP, INPUT_BITS.LEFT, INPUT_BITS.DOWN, INPUT_BITS.RIGHT]
const BUTTONS: [number, string][] = [
  [INPUT_BITS.BUTTON_1, 'A'],
  [INPUT_BITS.BUTTON_2, 'B'],
  [INPUT_BITS.BUTTON_3, 'C'],
  [INPUT_BITS.BUTTON_4, 'D'],
  [INPUT_BITS.BUTTON_5, 'E'],
  [INPUT_BITS.BUTTON_6, 'F'],
]

/** The code that binds to one bit, read back out of the same table the input reader uses. */
const keyFor = (bit: number) => keyLabel(Object.keys(KEY_BITS).find((code) => KEY_BITS[code] === bit) ?? '?')

/** `?` opens the help; Shift+/ is not bound to any player, so it cannot collide. */
export function useHelpShortcut(setOpen: Dispatch<SetStateAction<boolean>>) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
      event.preventDefault()
      setOpen((open) => !open)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [setOpen])
}

export function KeyHelp({ onClose }: { onClose: () => void }) {
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
    <div className="modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className="keys-card" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h2>Keyboard</h2>
          <button className="icon" onClick={onClose} aria-label="Close keyboard help">
            ×
          </button>
        </div>
        <p className="muted small">
          The host keyboard is player 1. A guest on a keyboard uses this same row; players 2–4 join with a
          gamepad, an arcade stick, or a phone.
        </p>

        <div className="key-ports">
          <section className="key-port">
            <h3>
              <span className="tag">P1</span>
            </h3>
            <dl className="key-rows">
              <div>
                <dt>Move</dt>
                <dd>
                  {DIRECTIONS.map((bit) => (
                    <kbd key={bit}>{keyFor(bit)}</kbd>
                  ))}
                </dd>
              </div>
              <div>
                <dt>Buttons</dt>
                <dd>
                  {BUTTONS.map(([bit, name]) => (
                    <kbd key={name}>
                      <i>{name}</i>
                      {keyFor(bit)}
                    </kbd>
                  ))}
                </dd>
              </div>
              <div>
                <dt>Coin / Start</dt>
                <dd>
                  <kbd>{keyFor(INPUT_BITS.COIN)}</kbd>
                  <kbd>{keyFor(INPUT_BITS.START)}</kbd>
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <p className="muted small">
          Players 2–4 need their own device: press a button on a gamepad to claim the next free port, or have
          them scan the QR code. Press <kbd>?</kbd> anywhere to bring this back.
        </p>
      </div>
    </div>
  )
}
