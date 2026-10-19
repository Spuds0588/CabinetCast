import Peer, { type DataConnection, type MediaConnection } from 'peerjs'
import {
  ENDPOINT,
  FRAME_FPS,
  FRAME_HEADER,
  FRAME_QUALITY,
  FRAME_TAG,
  randomCode,
  type GuestMessage,
  type HostMessage,
  type InputKind,
} from '../core/protocol'

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
}

/** A guest's data channel stalls if we queue frames faster than the network drains them. */
const MAX_BUFFERED = 512 * 1024
/** The lowest JPEG quality the pump will fall back to while the channel is backed up. */
const QUALITY_FLOOR = 0.5

export interface HostPeer {
  id: string
  port: number
  source?: InputKind
  /** Frames per second this host is actually pushing to that guest. */
  frames?: number
}

export interface HostEvents {
  onRoster(peers: HostPeer[]): void
  onJoin(id: string): void
  onLeave(id: string): void
  onInput(id: string, mask: number): void
}

const log = (message: string) => console.log(`[Cabinet:NetHost] ${message}`)

export class HostNet {
  readonly code: string
  private readonly peer: Peer
  private readonly conns = new Map<string, DataConnection>()
  private readonly calls = new Map<string, MediaConnection>()
  private readonly ports = new Map<string, number>()
  private readonly sources = new Map<string, InputKind>()
  private readonly rates = new Map<string, number>()
  private readonly pumps = new Map<string, number>()
  private readonly greeted = new Set<string>()
  private audio: MediaStream | null = null
  private audioSignature = ''
  private canvas: HTMLCanvasElement | null = null
  /** JPEG quality the host asked for; the pump drops below it only under channel pressure. */
  private quality = FRAME_QUALITY
  /** Face buttons guests should draw; the host sets it per game. Four is the arcade default. */
  private buttons = 4
  private opened!: Promise<void>
  private closed = false

  private constructor(code: string, private readonly events: HostEvents) {
    this.code = code
    this.peer = new Peer(ENDPOINT(code), { config: ICE })
    this.opened = new Promise<void>((resolve, reject) => {
      this.peer.on('open', () => {
        log(`Room "${code}" open, invite id ${ENDPOINT(code)}`)
        resolve()
      })
      this.peer.on('error', (error) => {
        if (this.peer.disconnected && !this.closed) this.peer.reconnect()
        reject(error)
      })
    })
    this.peer.on('connection', (conn) => this.accept(conn))
    this.peer.on('disconnected', () => !this.closed && this.peer.reconnect())
  }

  /** Start a room, reusing a previous code and retrying once if the id is taken. */
  static async start(events: HostEvents, preferred?: string | null): Promise<HostNet> {
    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      const net = new HostNet(attempt === 0 && preferred ? preferred : randomCode(), events)
      try {
        await net.opened
        sessionStorage.setItem('cabinetcast:room', net.code)
        if (new URLSearchParams(location.search).has('debug')) Object.assign(globalThis, { __hostNet: net })
        return net
      } catch (error) {
        lastError = error
        net.destroy()
      }
    }
    throw lastError
  }

  private accept(conn: DataConnection) {
    const id = conn.peer
    this.conns.set(id, conn)
    // PeerJS opens a fresh connection per guest; drop any stale one for the same id first.
    conn.on('open', () => {
      log(`Guest ${id} connected`)
      this.events.onJoin(id)
      this.roster()
      // The call is audio only, so it can go out immediately; frames start as soon as the pump
      // exists, and the guest simply ignores any that arrive before it has decoded one.
      if (this.audio) this.callGuest(id)
      this.startFrames(id)
      this.send(id, { t: 'buttons', count: this.buttons })
    })
    conn.on('close', () => this.drop(id))
    conn.on('error', () => this.drop(id))
    conn.on('data', (data) => this.receive(id, data))
  }

  private receive(id: string, data: unknown) {
    if (data instanceof ArrayBuffer) return this.events.onInput(id, new DataView(data).getUint16(0, true))
    if (data instanceof Uint8Array) return this.events.onInput(id, (data[0] ?? 0) | ((data[1] ?? 0) << 8))
    if (typeof data !== 'string') return
    try {
      const message = JSON.parse(data) as GuestMessage
      if (message.t === 'hello') {
        this.greet(id)
      } else if (message.t === 'source') {
        this.sources.set(id, message.kind)
        this.roster()
      }
    } catch {
      /* ignore malformed control messages */
    }
  }

  private greet(id: string) {
    if (this.greeted.has(id)) return
    this.greeted.add(id)
    this.roster()
    if (this.audio) this.callGuest(id)
    this.startFrames(id)
    this.send(id, { t: 'buttons', count: this.buttons })
  }

  private drop(id: string) {
    if (!this.conns.delete(id)) return
    log(`Guest ${id} disconnected`)
    this.stopFrames(id)
    this.calls.get(id)?.close()
    this.calls.delete(id)
    this.ports.delete(id)
    this.sources.delete(id)
    this.rates.delete(id)
    this.greeted.delete(id)
    this.events.onLeave(id)
    this.roster()
  }

  /**
   * Push the relay canvas to one guest as JPEG frames. This replaces the video track entirely: the
   * guest paints decoded bitmaps into a 2D canvas, so no device has to negotiate a decoder, and a
   * frame that cannot be delivered is replaced by the next one instead of waiting in a jitter buffer.
   */
  private startFrames(id: string) {
    this.stopFrames(id)
    const canvas = this.canvas
    if (!canvas) return
    let busy = false
    let sent = 0
    let sampled = performance.now()
    // PeerJS gives an unordered channel but still retransmits, so a congested link shows up as a
    // growing buffer. Hold the frame, and trade quality before resolution when that happens.
    let quality = this.quality
    let pressure = 0

    const tick = async () => {
      const conn = this.conns.get(id)
      if (busy || !conn?.open || this.closed) return
      const channel = (conn as unknown as { dataChannel?: RTCDataChannel }).dataChannel
      if (channel && channel.bufferedAmount > MAX_BUFFERED) {
        pressure = Math.min(pressure + 1, 6)
        if (pressure >= 3) quality = QUALITY_FLOOR
        return
      }
      if (pressure > 0) {
        pressure -= 1
        if (pressure === 0) quality = this.quality
      }
      busy = true
      try {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
        if (!blob || !this.conns.has(id)) return
        const frame = new Uint8Array(FRAME_HEADER + blob.size)
        frame[0] = FRAME_TAG
        new DataView(frame.buffer).setFloat64(1, Date.now(), true)
        frame.set(new Uint8Array(await blob.arrayBuffer()), FRAME_HEADER)
        conn.send(frame)
        sent += 1
        const now = performance.now()
        if (now - sampled >= 1000) {
          this.rates.set(id, Math.round((sent * 1000) / (now - sampled)))
          sent = 0
          sampled = now
          this.roster()
        }
      } catch {
        /* one dropped frame is not worth stopping the stream over */
      } finally {
        busy = false
      }
    }

    this.pumps.set(
      id,
      window.setInterval(() => void tick(), 1000 / FRAME_FPS),
    )
  }

  private stopFrames(id: string) {
    const timer = this.pumps.get(id)
    if (timer !== undefined) clearInterval(timer)
    this.pumps.delete(id)
    this.rates.delete(id)
  }

  private callGuest(id: string) {
    if (!this.audio || this.calls.has(id)) return
    const call = this.peer.call(id, this.audio)
    if (!call) return
    this.calls.set(id, call)
    call.on('close', () => {
      if (this.calls.get(id) !== call) return
      this.calls.delete(id)
    })
    call.on('error', (error) => log(`Audio call to ${id} failed: ${error.type}`))
  }

  private send(id: string, message: HostMessage) {
    const conn = this.conns.get(id)
    if (conn?.open) conn.send(JSON.stringify(message))
  }

  setSlot(id: string, port: number) {
    this.ports.set(id, port)
    this.send(id, { t: 'slot', port, spectator: port === -1 })
    this.roster()
  }

  /** Sound over a media call. Video never touches the media pipeline any more. */
  setAudio(stream: MediaStream) {
    const signature = stream.getTracks().map((track) => track.id).join()
    if (signature === this.audioSignature) return
    this.audioSignature = signature
    this.audio = stream
    log(`Broadcasting audio to ${this.conns.size} peer(s) (${stream.getTracks().length} track(s))`)
    for (const call of this.calls.values()) call.close()
    this.calls.clear()
    for (const id of this.conns.keys()) this.callGuest(id)
  }

  /** The relay the frame pump encodes. Setting it starts pumps for guests already connected. */
  setCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    for (const id of this.conns.keys()) this.startFrames(id)
  }

  /** How many face buttons this game has; every guest is told, including later arrivals. */
  setButtons(count: number) {
    this.buttons = count
    for (const id of this.conns.keys()) this.send(id, { t: 'buttons', count })
  }

  /** Change the JPEG quality and restart the pumps so every guest uses it immediately. */
  setFrameOptions(options: { quality: number }) {
    this.quality = Math.min(0.95, Math.max(0.3, options.quality))
    for (const id of this.conns.keys()) this.startFrames(id)
  }

  roster() {
    this.events.onRoster(
      [...this.conns.keys()].map((id) => ({
        id,
        port: this.ports.get(id) ?? -1,
        source: this.sources.get(id),
        frames: this.rates.get(id),
      })),
    )
  }

  destroy() {
    this.closed = true
    for (const id of this.pumps.keys()) this.stopFrames(id)
    for (const call of this.calls.values()) call.close()
    for (const conn of this.conns.values()) conn.close()
    this.peer.destroy()
  }
}
