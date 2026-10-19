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

export const bitNames = Object.entries(INPUT_BITS).map(([name, bit]) => ({ name, bit }))

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

const pad = (up: string, down: string, left: string, right: string, a: string, b: string, x: string, y: string, l: string, r: string, select: string, start: string) =>
  ({ up, down, left, right, a, b, x, y, l, r, select, start })

/**
 * One unique physical key (DOM `KeyboardEvent.code`) per action per port. Keys never repeat across
 * ports, otherwise one port's keypress would drive another. Hotkey-risky keys (f1, escape) are avoided.
 * This is the single contract: the input reader and the core's key bindings are both derived from it.
 */
export const PORT_KEYS = [
  pad('ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyA', 'KeyS', 'Space', 'Enter'),
  pad('KeyE', 'KeyD', 'KeyQ', 'KeyF', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'KeyH', 'KeyJ', 'KeyK'),
  pad('KeyB', 'KeyN', 'KeyG', 'KeyT', 'KeyL', 'KeyM', 'Comma', 'Period', 'Tab', 'Backspace', 'Insert', 'Delete'),
  pad('Numpad8', 'Numpad2', 'Numpad4', 'Numpad6', 'Numpad7', 'Numpad9', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract', 'NumpadAdd', 'Numpad0', 'Numpad5'),
]

/** DOM codes RetroArch spells differently in retroarch.cfg. Everything else is mechanical. */
const RETRO_NAMES: Record<string, string> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  NumpadDivide: 'divide', NumpadMultiply: 'multiply', NumpadSubtract: 'subtract', NumpadAdd: 'add',
}
const retroName = (code: string) =>
  RETRO_NAMES[code] ?? (code.startsWith('Numpad') ? `num${code.slice(-1)}` : code.replace(/^Key/, '').toLowerCase())

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
 * No alias keys: WASD would collide with P2's declared binds (KeyD is P2 down).
 */
export const KEY_BITS: Record<string, number>[] = PORT_KEYS.map((keys) =>
  Object.fromEntries(Object.entries(keys).map(([action, code]) => [code, BIT_OF[action]])),
)

export const ENDPOINT = (code: string) => `cab-${code}`
export const ROOM_CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export const randomCode = (length = 5) =>
  Array.from({ length }, () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]).join('')

export type HostMessage =
  | { t: 'pong'; ts: number }
  | { t: 'slot'; port: number; spectator: boolean }

export type GuestMessage = { t: 'ping'; ts: number } | { t: 'stat'; rtt: number }
