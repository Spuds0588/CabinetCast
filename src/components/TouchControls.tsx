import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { INPUT_BITS } from '../core/protocol'

const DIRECTIONS = INPUT_BITS.UP | INPUT_BITS.DOWN | INPUT_BITS.LEFT | INPUT_BITS.RIGHT

/** The face buttons in core order, so a two-button game shows A and B and nothing else. */
const FACE = [
  { bit: INPUT_BITS.BUTTON_1, label: 'A', area: 'a' },
  { bit: INPUT_BITS.BUTTON_2, label: 'B', area: 'b' },
  { bit: INPUT_BITS.BUTTON_3, label: 'C', area: 'c' },
  { bit: INPUT_BITS.BUTTON_4, label: 'D', area: 'd' },
  { bit: INPUT_BITS.BUTTON_5, label: 'E', area: 'e' },
  { bit: INPUT_BITS.BUTTON_6, label: 'F', area: 'f' },
]

interface Props {
  onChange: (mask: number) => void
  buttons?: number
  /** 'overlay' floats over a video feed; 'pad' is the controller-only page. */
  layout?: 'overlay' | 'pad'
}

/** On-screen controls for touch devices. Emits the same 12-bit mask as the keyboard and gamepad. */
export function TouchControls({ onChange, buttons = 6, layout = 'overlay' }: Props) {
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

  const dpad = (
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
  )

  const count = Math.max(2, Math.min(buttons, FACE.length))
  const faces = FACE.slice(0, count)

  if (layout === 'pad') {
    // Fewer buttons means each one can be bigger. Two and three sit in one row; four to six get a
    // two-row arcade stack with the lower row offset, which keeps every button inside thumb reach.
    const sizeClass = count <= 2 ? 'pad-2' : count === 3 ? 'pad-3' : count === 4 ? 'pad-4' : 'pad-56'
    const rows =
      count <= 3
        ? [faces]
        : [faces.slice(0, Math.ceil(count / 2)), faces.slice(Math.ceil(count / 2))]

    return (
      <div className={`touch touchpad ${sizeClass}`} aria-label="Touch controls">
        {dpad}
        <div className="pad-meta">
          {button(INPUT_BITS.COIN, 'Coin', 'wide')}
          {button(INPUT_BITS.START, 'Start', 'wide')}
        </div>
        <div className="pad-face">
          {rows.map((row, index) => (
            <div key={index} className={index === 0 ? 'pad-row' : 'pad-row offset'}>
              {row.map((face) => button(face.bit, face.label))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="touch" aria-label="Touch controls">
      {dpad}

      <div className="touch-right">
        <div className="touch-meta">
          {button(INPUT_BITS.COIN, 'Coin', 'wide')}
          {button(INPUT_BITS.START, 'Start', 'wide')}
        </div>
        {/* Four buttons keep the arcade diamond; any other count uses a plain grid whose column
            count follows the count, so a two-button pad does not reserve room for six. */}
        <div
          className={buttons === 4 ? 'face' : 'face grid'}
          style={
            buttons === 4
              ? undefined
              : { gridTemplateColumns: `repeat(${Math.min(Math.max(buttons, 2), 3)}, var(--face-size))` }
          }
        >
          {faces.map((face) => button(face.bit, face.label, '', face.area))}
        </div>
      </div>
    </div>
  )
}
