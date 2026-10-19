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
 * Frames per second pushed to guests over the data channel. The core still runs at 60 and input is
 * per-frame; this is only how often a picture is captured, encoded and sent.
 */
export const FRAME_FPS = 30

/** JPEG quality for those frames. At 384x288 this is sharp and roughly 15-25 KB a frame. */
export const FRAME_QUALITY = 0.72

/** First byte of a binary host -> guest message that carries one picture frame. */
export const FRAME_TAG = 0xca

/** Tag (1 byte) + capture time as a float64 in epoch milliseconds (8 bytes). */
export const FRAME_HEADER = 9

/**
 * What a host trades for smoothness. FBNeo draws 384x288, so the wider presets add no detail, only a
 * finer JPEG grid and softer upscaling on a big screen; they cost bandwidth in proportion.
 */
export const FRAME_PRESETS = [
  { id: 'low', label: 'Low', width: 384, height: 288, quality: 0.6 },
  { id: 'balanced', label: 'Balanced', width: 512, height: 384, quality: 0.72 },
  { id: 'sharp', label: 'Sharp', width: 768, height: 576, quality: 0.8 },
] as const

export type FramePreset = (typeof FRAME_PRESETS)[number]
export type FrameOptions = { width: number; height: number; quality: number }

/** Keys are listed in player order (B1..B6 = A..F), then mapped onto RetroArch's joypad names. */
const pad = (up: string, down: string, left: string, right: string, b1: string, b2: string, b3: string, b4: string, b5: string, b6: string, select: string, start: string) =>
  ({ up, down, left, right, y: b1, b: b2, a: b3, x: b4, l: b5, r: b6, select, start })

/**
 * The one physical keyboard layout: player 1. This is what the reader and the help dialog use.
 * WASD moves, J K L U I O are A-F, Space is coin, Enter is start.
 */
const P1_KEYS = pad('KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI', 'KeyO', 'Space', 'Enter')

/**
 * One unique key per action per port, for all four ports. Only row 0 (`P1_KEYS`) is ever read from a
 * physical keyboard: players 2-4 need their own device, a gamepad or a phone. Rows 1-3 still have to
 * exist because injected input fires a synthetic key event for that port's binding, so the core needs a
 * distinct code per port. Hotkey-risky keys (f1, escape) are avoided.
 */
export const PORT_KEYS = [
  P1_KEYS,
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

/** Player 1's physical key -> bitmask. The keyboard reader and the help dialog both read this table. */
export const KEY_BITS: Record<string, number> = Object.fromEntries(
  Object.entries(P1_KEYS).map(([action, code]) => [code, BIT_OF[action]]),
)

export const ENDPOINT = (code: string) => `cab-${code}`
const ROOM_CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export const randomCode = (length = 5) =>
  Array.from({ length }, () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]).join('')

/** What a player is holding. Guests report theirs; the host derives it for local sources. */
export type InputKind = 'keyboard' | 'gamepad' | 'arcade' | 'touch'

export type HostMessage = { t: 'slot'; port: number; spectator: boolean }

export type GuestMessage =
  /** Sent the moment the data channel opens, before any call is offered. */
  | { t: 'hello'; platform: 'apple' | 'other' }
  | { t: 'source'; kind: InputKind }
