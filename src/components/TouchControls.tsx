import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { INPUT_BITS } from '../core/protocol'

const DIRECTIONS = INPUT_BITS.UP | INPUT_BITS.DOWN | INPUT_BITS.LEFT | INPUT_BITS.RIGHT

/** On-screen controls for touch devices. Emits the same 12-bit mask as the keyboard and gamepad. */
export function TouchControls({ onChange }: { onChange: (mask: number) => void }) {
  const held = useRef(0)
  const [mask, setMask] = useState(0)

  const commit = (next: number) => {
    if (next === held.current) return
    held.current = next
    setMask(next)
    onChange(next)
  }

  const setBit = (bit: number, down: boolean) => commit(down ? held.current | bit : held.current & ~bit)

  const movePad = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    let next = held.current & ~DIRECTIONS
    if (x < -0.15) next |= INPUT_BITS.LEFT
    if (x > 0.15) next |= INPUT_BITS.RIGHT
    if (y < -0.15) next |= INPUT_BITS.UP
    if (y > 0.15) next |= INPUT_BITS.DOWN
    commit(next)
  }

  const releasePad = () => commit(held.current & ~DIRECTIONS)

  const button = (bit: number, label: string, className = '', ...extra: string[]) => (
    <button
      type="button"
      className={['touch-btn', className, ...extra, mask & bit ? 'on' : ''].filter(Boolean).join(' ')}
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault()
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          /* capture is an enhancement; a released pointer outside the button still clears */
        }
        setBit(bit, true)
      }}
      onPointerUp={() => setBit(bit, false)}
      onPointerCancel={() => setBit(bit, false)}
      onLostPointerCapture={() => setBit(bit, false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {label}
    </button>
  )

  return (
    <div className="touch" aria-label="Touch controls">
      <div
        className="dpad"
        role="group"
        aria-label="Direction pad"
        onPointerDown={(event) => {
          event.preventDefault()
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch {
            /* same as the buttons */
          }
          movePad(event)
        }}
        onPointerMove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && movePad(event)}
        onPointerUp={releasePad}
        onPointerCancel={releasePad}
        onLostPointerCapture={releasePad}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className={`dpad-arrow up${mask & INPUT_BITS.UP ? ' on' : ''}`}>▲</span>
        <span className={`dpad-arrow right${mask & INPUT_BITS.RIGHT ? ' on' : ''}`}>▶</span>
        <span className={`dpad-arrow down${mask & INPUT_BITS.DOWN ? ' on' : ''}`}>▼</span>
        <span className={`dpad-arrow left${mask & INPUT_BITS.LEFT ? ' on' : ''}`}>◀</span>
        <span className="dpad-hub" />
      </div>

      <div className="touch-right">
        <div className="touch-meta">
          {button(INPUT_BITS.COIN, 'Coin', 'wide')}
          {button(INPUT_BITS.START, 'Start', 'wide')}
        </div>
        <div className="face">
          {button(INPUT_BITS.BUTTON_1, 'A', '', 'a')}
          {button(INPUT_BITS.BUTTON_2, 'B', '', 'b')}
          {button(INPUT_BITS.BUTTON_3, 'C', '', 'c')}
          {button(INPUT_BITS.BUTTON_4, 'D', '', 'd')}
        </div>
      </div>
    </div>
  )
}
