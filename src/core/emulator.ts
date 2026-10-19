import { Nostalgist } from 'nostalgist'
import { audioTracks, installAudioTap } from './audioTap'
import { BIT_TO_JOYPAD, NEUTRALIZED_HOTKEYS, PORT_KEY_CONFIG, PORTS } from './protocol'

export interface ArcadeSession {
  romName: string
  /** Audio only: pictures now travel as frames over the data channel, the call carries sound. */
  getAudio(): MediaStream
  /** The fixed 384x288 relay the frame pump encodes. */
  getCanvas(): HTMLCanvasElement
  /** Apply one port's 12-bit input mask, injecting only the bits that changed. */
  inject(port: number, mask: number): void
  /** Snapshot the whole core, including SRAM and the current frame. */
  saveState(): Promise<Blob>
  loadState(state: Blob): Promise<void>
  exit(): void
}

const log = (message: string) => console.log(`[Cabinet:Core] ${message}`)
const isDebug = () => new URLSearchParams(location.search).has('debug')
const LAUNCH_TIMEOUT = 45_000

export async function launchArcade(file: File, bios?: Blob): Promise<ArcadeSession> {
  installAudioTap()
  log(`Launching FBNeo with ROM: ${file.name} (${file.size} bytes)${bios ? ' + neogeo.zip' : ''}`)

  const element = document.querySelector<HTMLCanvasElement>('#cabinet-canvas')
  if (!element) throw new Error('cabinet canvas is not mounted')

  const launch = Nostalgist.launch({
    core: 'fbneo',
    // fileName is explicit: Nostalgist renames bare File/Blob inputs to data1.zip, and FBNeo
    // identifies the romset from the content filename.
    rom: { fileName: file.name, fileContent: file },
    bios: bios ? { fileName: 'neogeo.zip', fileContent: bios } : undefined,
    element,
    // Native arcade resolution: small enough to stream cheaply, upscaled with image-rendering.
    size: { width: 384, height: 288 },
    respondToGlobalEvents: false,
    // Player 1-4 keyboard binds plus disabled hotkeys, so synthetic input cannot hit a menu action.
    retroarchConfig: { ...PORT_KEY_CONFIG, ...NEUTRALIZED_HOTKEYS, log_verbosity: isDebug() } as never,
    onLog: ({ message, level }) => (isDebug() || level === 'error') && console.log(`[Cabinet:Core] ${level} ${message}`),
  })

  // A wrong-version romset can leave the core spinning without ever signalling a boot.
  const emulator = await Promise.race([
    launch,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Core did not boot within 45s. Check that the ROM set matches FBNeo.')), LAUNCH_TIMEOUT),
    ),
  ])

  // Native focus would let physical keys reach RetroArch itself, including the player 2-4 bindings that
  // exist only for injected input. Every input is injected, so the canvas never keeps focus.
  element.addEventListener('focus', () => element.blur())
  element.blur()
  if (isDebug()) Object.assign(globalThis, { __cabinetCore: emulator })

  // RetroArch sizes its buffer from the canvas' on-screen rect, which the cabinet scales, so the raw
  // canvas is not a predictable size (it was 402x302 on a 1280px window). Copy it into a fixed 384x288
  // relay and capture that: the stream is then always macroblock-aligned and identical on every host,
  // which matters because some hardware decoders will not paint an unaligned H.264 frame at all.
  const relay = document.createElement('canvas')
  relay.width = 384
  relay.height = 288
  const paint = relay.getContext('2d')
  let relayFrame = 0
  const copy = () => {
    paint?.drawImage(element, 0, 0, relay.width, relay.height)
    relayFrame = requestAnimationFrame(copy)
  }
  relayFrame = requestAnimationFrame(copy)

  const getAudio = () => new MediaStream(audioTracks())
  const lastMasks = new Array<number>(PORTS).fill(0)

  log(`Running: ${file.name} (canvas ${element.width}x${element.height} → relay ${relay.width}x${relay.height})`)

  return {
    romName: file.name,
    getAudio,
    getCanvas: () => relay,
    async saveState() {
      const { state } = await emulator.saveState()
      return state
    },
    loadState(state) {
      return emulator.loadState(state)
    },
    inject(port, mask) {
      const previous = lastMasks[port] ?? 0
      if (previous === mask) return
      lastMasks[port] = mask
      for (const [bit, button] of BIT_TO_JOYPAD) {
        if ((previous & bit) === (mask & bit)) continue
        if (mask & bit) emulator.pressDown({ button, player: port + 1 })
        else emulator.pressUp({ button, player: port + 1 })
      }
    },
    exit() {
      log('Exiting emulator')
      cancelAnimationFrame(relayFrame)
      emulator.exit()
    },
  }
}
