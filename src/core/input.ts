import { INPUT_BITS, KEY_BITS } from './protocol'

const DEADZONE = 0.4

/** Physical keyboard for one port -> bitmask. Ignored while typing in a field. */
export function createKeyboard(port = 0) {
  const bits = KEY_BITS[port] ?? {}
  const held = new Set<string>()
  const ignored = (event: KeyboardEvent) =>
    event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)
  const down = (event: KeyboardEvent) => {
    if (!bits[event.code] || event.repeat || ignored(event)) return
    held.add(event.code)
    event.preventDefault()
  }
  const up = (event: KeyboardEvent) => held.delete(event.code)
  const clear = () => held.clear()
  addEventListener('keydown', down)
  addEventListener('keyup', up)
  addEventListener('blur', clear)
  return {
    mask: () => [...held].reduce((mask, code) => mask | bits[code], 0),
    dispose: () => {
      removeEventListener('keydown', down)
      removeEventListener('keyup', up)
      removeEventListener('blur', clear)
    },
  }
}

/** Standard Gamepad API mapping -> bitmask. Browsers normalize most pads to `standard`. */
export function padMask(pad: Gamepad): number {
  const pressed = (index: number) => pad.buttons[index]?.pressed ?? false
  const axisX = pad.axes[0] ?? 0
  const axisY = pad.axes[1] ?? 0
  let mask = 0
  if (pressed(12) || axisY < -DEADZONE) mask |= INPUT_BITS.UP
  if (pressed(13) || axisY > DEADZONE) mask |= INPUT_BITS.DOWN
  if (pressed(14) || axisX < -DEADZONE) mask |= INPUT_BITS.LEFT
  if (pressed(15) || axisX > DEADZONE) mask |= INPUT_BITS.RIGHT
  if (pressed(0)) mask |= INPUT_BITS.BUTTON_1
  if (pressed(1)) mask |= INPUT_BITS.BUTTON_2
  if (pressed(2)) mask |= INPUT_BITS.BUTTON_3
  if (pressed(3)) mask |= INPUT_BITS.BUTTON_4
  if (pressed(4)) mask |= INPUT_BITS.BUTTON_5
  if (pressed(5)) mask |= INPUT_BITS.BUTTON_6
  if (pressed(8)) mask |= INPUT_BITS.COIN
  if (pressed(9)) mask |= INPUT_BITS.START
  return mask
}

/** Connected pads, in browser order. */
export const pads = () =>
  [...(navigator.getGamepads?.() ?? [])].filter((pad): pad is Gamepad => Boolean(pad))

/** Chrome's pad id ends in a vendor/product blob; keep just the device name. */
export const padLabel = (pad: Gamepad) => pad.id.replace(/\s*\(.*$/, '') || `Gamepad ${pad.index + 1}`

/** Fight sticks report as ordinary gamepads, so the id is the only hint for which icon to show. */
export const padKind = (pad: Gamepad): 'arcade' | 'gamepad' =>
  /arcade|fight ?stick|fightstick|hori|qanba|mayflash|tankstick/i.test(pad.id) ? 'arcade' : 'gamepad'
