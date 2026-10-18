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
 * One unique keyboard key per action per port. Keys must never repeat across ports, otherwise one
 * port's synthetic keypress would drive another port. Hotkey-risky keys (f1, escape) are avoided.
 * Port 1's keys are also the physical keys guests use locally.
 */
export const PORT_KEYS = [
  pad('up', 'down', 'left', 'right', 'z', 'x', 'c', 'v', 'a', 's', 'space', 'enter'),
  pad('e', 'd', 'q', 'f', 'y', 'u', 'i', 'o', 'p', 'h', 'j', 'k'),
  pad('b', 'n', 'g', 't', 'l', 'm', 'comma', 'period', 'tab', 'backspace', 'insert', 'delete'),
  pad('num8', 'num2', 'num4', 'num6', 'num7', 'num9', 'divide', 'multiply', 'subtract', 'add', 'num0', 'num5'),
]

/** retroarchConfig fragment that binds every port's 12 actions to its own keys. */
export const PORT_KEY_CONFIG = Object.fromEntries(
  PORT_KEYS.flatMap((keys, port) => Object.entries(keys).map(([action, key]) => [`input_player${port + 1}_${action}`, key])),
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

/** Physical keyboard -> bitmask, used by the host (port 1) and by every guest. */
export const KEY_TO_BITS: Record<string, number> = {
  ArrowUp: INPUT_BITS.UP,
  ArrowDown: INPUT_BITS.DOWN,
  ArrowLeft: INPUT_BITS.LEFT,
  ArrowRight: INPUT_BITS.RIGHT,
  KeyW: INPUT_BITS.UP,
  KeyS: INPUT_BITS.DOWN,
  KeyA: INPUT_BITS.LEFT,
  KeyD: INPUT_BITS.RIGHT,
  KeyZ: INPUT_BITS.BUTTON_1,
  KeyX: INPUT_BITS.BUTTON_2,
  KeyC: INPUT_BITS.BUTTON_3,
  KeyV: INPUT_BITS.BUTTON_4,
  KeyQ: INPUT_BITS.BUTTON_5,
  KeyE: INPUT_BITS.BUTTON_6,
  Space: INPUT_BITS.COIN,
  ShiftLeft: INPUT_BITS.COIN,
  Enter: INPUT_BITS.START,
  Digit5: INPUT_BITS.COIN,
  Digit1: INPUT_BITS.START,
}

export const ENDPOINT = (code: string) => `cab-${code}`
export const ROOM_CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export const randomCode = (length = 5) =>
  Array.from({ length }, () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]).join('')

export type HostMessage =
  | { t: 'pong'; ts: number }
  | { t: 'slot'; port: number; spectator: boolean }

export type GuestMessage = { t: 'ping'; ts: number } | { t: 'stat'; rtt: number }
