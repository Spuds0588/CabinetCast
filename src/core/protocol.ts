/** Shared protocol constants: input bitmasks, per-port RetroArch key bindings, peer messages. */

export const INPUT_BITS = {
  UP: 1 << 0,
  DOWN: 1 << 1,
  LEFT: 1 << 2,
  RIGHT: 1 << 3,
  BUTTON_1: 1 << 4, // A / attack
  BUTTON_2: 1 << 5, // B / jump
  BUTTON_3: 1 << 6, // C
  BUTTON_4: 1 << 7, // D
  BUTTON_5: 1 << 8, // E
  BUTTON_6: 1 << 9, // F
  COIN: 1 << 10, // select / insert coin
  START: 1 << 11,
} as const

/** Bit -> RetroArch joypad button name, in the order laid out by CabinetCast.md §2.2. */
export const BIT_TO_JOYPAD: [number, string][] = [
  [INPUT_BITS.UP, 'up'],
  [INPUT_BITS.DOWN, 'down'],
  [INPUT_BITS.LEFT, 'left'],
  [INPUT_BITS.RIGHT, 'right'],
  [INPUT_BITS.BUTTON_1, 'y'],
  [INPUT_BITS.BUTTON_2, 'b'],
  [INPUT_BITS.BUTTON_3, 'a'],
  [INPUT_BITS.BUTTON_4, 'x'],
  [INPUT_BITS.BUTTON_5, 'l'],
  [INPUT_BITS.BUTTON_6, 'r'],
  [INPUT_BITS.COIN, 'select'],
  [INPUT_BITS.START, 'start'],
]

/** RetroArch/libretro supports keyboard bindings for players 1-4 only (input_player[1-4]_*). */
export const PORTS = 4

/**
 * Frames per second sent to guests. The core still runs at 60 and input is per-frame, but halving the
 * captured frames halves encode and decode work and the bitrate the network has to carry.
 */
export const STREAM_FPS = 30

/** Keys are listed in player order (B1..B6 = A..F), then mapped onto RetroArch's joypad names. */
const pad = (up: string, down: string, left: string, right: string, b1: string, b2: string, b3: string, b4: string, b5: string, b6: string, select: string, start: string) =>
  ({ up, down, left, right, y: b1, b: b2, a: b3, x: b4, l: b5, r: b6, select, start })

/**
 * One unique physical key (DOM `KeyboardEvent.code`) per action per port. Keys never repeat across
 * ports, otherwise one port's keypress would drive another. Hotkey-risky keys (f1, escape) are avoided.
 * P1 and P2 use the two layouts arcade players reach for first: WASD + J/K/L, then arrows + Z/X/C/V.
 * This is the single contract: the input reader, the help dialog and the core's key bindings all derive
 * from it, so adding or moving a key never needs a second table.
 */
export const PORT_KEYS = [
  pad('KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI', 'KeyO', 'Space', 'Enter'),
  pad('ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'Tab', 'Backspace'),
  pad('KeyT', 'KeyG', 'KeyF', 'KeyH', 'KeyR', 'KeyY', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Comma', 'Period'),
  pad('Numpad8', 'Numpad2', 'Numpad4', 'Numpad6', 'Numpad7', 'Numpad9', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract', 'NumpadAdd', 'Numpad0', 'Numpad5'),
]

/** DOM codes RetroArch spells differently in retroarch.cfg. Everything else is mechanical. */
const RETRO_NAMES: Record<string, string> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  NumpadDivide: 'divide', NumpadMultiply: 'multiply', NumpadSubtract: 'subtract', NumpadAdd: 'add',
}
const retroName = (code: string) =>
  RETRO_NAMES[code] ??
  (code.startsWith('Numpad')
    ? `num${code.slice(-1)}`
    : code.startsWith('Digit')
      ? code.slice(5)
      : code.replace(/^Key/, '').toLowerCase())

/** retroarchConfig fragment that binds every port's 12 actions to its own keys. */
export const PORT_KEY_CONFIG = Object.fromEntries(
  PORT_KEYS.flatMap((keys, port) => Object.entries(keys).map(([action, code]) => [`input_player${port + 1}_${action}`, retroName(code)])),
)

/** Hotkeys we disable so a synthetic player keypress can never open a menu or quit the game. */
export const NEUTRALIZED_HOTKEYS = {
  input_menu_toggle: 'nul',
  input_exit_emulator: 'nul',
  input_save_state: 'nul',
  input_load_state: 'nul',
  input_state_slot_increase: 'nul',
  input_state_slot_decrease: 'nul',
  input_toggle_fast_forward: 'nul',
  input_hold_fast_forward: 'nul',
  input_toggle_slowmotion: 'nul',
  input_rewind: 'nul',
  input_toggle_fullscreen: 'nul',
  input_screenshot: 'nul',
  input_shader_next: 'nul',
  input_shader_prev: 'nul',
}

const BIT_OF = Object.fromEntries(BIT_TO_JOYPAD.map(([bit, action]) => [action, bit]))

/**
 * Physical key -> bitmask, one table per port, derived from PORT_KEYS so no key can drive two ports.
 * No alias keys: every keyboard layout gets its own row here and nowhere else.
 */
export const KEY_BITS: Record<string, number>[] = PORT_KEYS.map((keys) =>
  Object.fromEntries(Object.entries(keys).map(([action, code]) => [code, BIT_OF[action]])),
)

export const ENDPOINT = (code: string) => `cab-${code}`
const ROOM_CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export const randomCode = (length = 5) =>
  Array.from({ length }, () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]).join('')

export type HostMessage = { t: 'slot'; port: number; spectator: boolean }

/** What a player is holding. Guests report theirs; the host derives it for local sources. */
export type InputKind = 'keyboard' | 'gamepad' | 'arcade' | 'touch'

export type GuestMessage = { t: 'source'; kind: InputKind }
