import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { keyLabel } from '../core/input'
import { INPUT_BITS, KEY_BITS, PORTS } from '../core/protocol'

const DIRECTIONS = [INPUT_BITS.UP, INPUT_BITS.LEFT, INPUT_BITS.DOWN, INPUT_BITS.RIGHT]
const BUTTONS: [number, string][] = [
  [INPUT_BITS.BUTTON_1, 'A'],
  [INPUT_BITS.BUTTON_2, 'B'],
  [INPUT_BITS.BUTTON_3, 'C'],
  [INPUT_BITS.BUTTON_4, 'D'],
  [INPUT_BITS.BUTTON_5, 'E'],
  [INPUT_BITS.BUTTON_6, 'F'],
]

/** The code a port binds to one bit, read back out of the same table the input reader uses. */
const keyFor = (port: number, bit: number) =>
  keyLabel(Object.keys(KEY_BITS[port]).find((code) => KEY_BITS[port][code] === bit) ?? '?')

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
          Each local slot reads only its own row. A guest on a keyboard sends the Player 1 row. Gamepads are
          picked up as soon as you press a button on them.
        </p>

        <div className="key-ports">
          {Array.from({ length: PORTS }, (_, port) => (
            <section className="key-port" key={port}>
              <h3>
                <span className="tag">P{port + 1}</span>
              </h3>
              <dl className="key-rows">
                <div>
                  <dt>Move</dt>
                  <dd>
                    {DIRECTIONS.map((bit) => (
                      <kbd key={bit}>{keyFor(port, bit)}</kbd>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>Buttons</dt>
                  <dd>
                    {BUTTONS.map(([bit, name]) => (
                      <kbd key={name}>
                        <i>{name}</i>
                        {keyFor(port, bit)}
                      </kbd>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>Coin / Start</dt>
                  <dd>
                    <kbd>{keyFor(port, INPUT_BITS.COIN)}</kbd>
                    <kbd>{keyFor(port, INPUT_BITS.START)}</kbd>
                  </dd>
                </div>
              </dl>
            </section>
          ))}
        </div>

        <p className="muted small">
          Press <kbd>?</kbd> anywhere to bring this back.
        </p>
      </div>
    </div>
  )
}
