import Peer, { type DataConnection, type MediaConnection } from 'peerjs'
import {
  ENDPOINT,
  randomCode,
  STREAM_FPS,
  type CodecPin,
  type GuestMessage,
  type HostMessage,
  type InputKind,
  type SentHealth,
  type VideoHealth,
} from '../core/protocol'
import { videoSdp } from './sdp'

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
}

export interface HostPeer {
  id: string
  port: number
  source?: InputKind
  /** What the guest's own video element reports. */
  video?: VideoHealth
  /** What this host is actually encoding and sending. */
  sent?: SentHealth
  pin?: CodecPin
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
  private readonly health = new Map<string, VideoHealth>()
  private readonly sent = new Map<string, SentHealth>()
  private readonly pins = new Map<string, CodecPin>()
  private readonly greeted = new Set<string>()
  private readonly samplers = new Map<string, number>()
  private stream: MediaStream | null = null
  private streamSignature = ''
  private callSignatures = new Map<string, string>()
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
      // Give the guest's hello a moment to name its platform before the first offer is built.
      if (this.stream) setTimeout(() => this.conns.has(id) && this.callGuest(id), 150)
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
        this.greet(id, message.platform)
      } else if (message.t === 'source') {
        this.sources.set(id, message.kind)
        this.roster()
      } else if (message.t === 'health') {
        this.health.set(id, message.health)
        this.roster()
      } else if (message.t === 'retry') {
        this.retry(id, message.pin)
      }
    } catch {
      /* ignore malformed control messages */
    }
  }

  /**
   * Start a guest on the codec its engine paints reliably: H.264 for Safari, VP8 for Chromium, which
   * decodes VP8 on every Android device. A later retry always overrides this.
   */
  private greet(id: string, platform: 'apple' | 'other') {
    if (this.greeted.has(id)) return
    this.greeted.add(id)
    if (!this.pins.has(id)) this.pins.set(id, platform === 'apple' ? 'auto' : 'vp8')
    this.roster()
    if (this.stream) this.callGuest(id)
  }

  /**
   * Re-offer the call pinned to one codec. A guest that hears audio but decodes no frames asks for this,
   * so a device stuck on one decoder gets a second chance without the player reloading anything.
   */
  private retry(id: string, pin: CodecPin) {
    if (!this.stream || this.closed) return
    this.pins.set(id, pin)
    this.callSignatures.delete(id)
    this.sent.delete(id)
    log(`Guest ${id.slice(0, 4)} asked for ${pin} video; re-offering`)
    this.callGuest(id)
    this.roster()
  }

  private drop(id: string) {
    if (!this.conns.delete(id)) return
    log(`Guest ${id} disconnected`)
    this.calls.get(id)?.close()
    this.calls.delete(id)
    this.callSignatures.delete(id)
    this.ports.delete(id)
    this.sources.delete(id)
    this.health.delete(id)
    this.sent.delete(id)
    this.pins.delete(id)
    this.greeted.delete(id)
    this.stopSampler(id)
    this.events.onLeave(id)
    this.roster()
  }

  private stopSampler(id: string) {
    const timer = this.samplers.get(id)
    if (timer !== undefined) clearInterval(timer)
    this.samplers.delete(id)
  }

  /** Track what this host encodes for a guest. An idle sender and an idle decoder need different fixes. */
  private watch(id: string, pc: RTCPeerConnection) {
    this.stopSampler(id)
    const sample = () => {
      void pc
        .getStats()
        .then((report) => {
          for (const stat of report.values()) {
            if (stat.type !== 'outbound-rtp' || stat.kind !== 'video') continue
            const codec = stat.codecId ? report.get(stat.codecId) : undefined
            const mime = (codec as { mimeType?: string } | undefined)?.mimeType ?? '—'
            const next: SentHealth = {
              codec: mime,
              fps: Math.round((stat as { framesPerSecond?: number }).framesPerSecond ?? 0),
              frames: (stat as { framesEncoded?: number }).framesEncoded ?? 0,
              limitation: (stat as { qualityLimitationReason?: string }).qualityLimitationReason ?? '—',
            }
            const previous = this.sent.get(id)
            this.sent.set(id, next)
            // The negotiated codec is the first thing to check when a guest has sound but no picture.
            if (!previous || previous.codec !== next.codec) log(`Guest ${id.slice(0, 4)} video codec: ${next.codec}`)
            if (next.limitation !== 'none') log(`Guest ${id.slice(0, 4)} video limitation: ${next.limitation}`)
            this.roster()
            return
          }
        })
        .catch(() => undefined)
    }
    sample()
    this.samplers.set(id, window.setInterval(sample, 1000))
  }

  private callGuest(id: string) {
    if (!this.stream || this.callSignatures.get(id) === this.streamSignature) return
    this.calls.get(id)?.close()
    this.stopSampler(id)
    const pin = this.pins.get(id) ?? 'auto'
    // One offer with both tracks, with the codecs the guest's engine is known to choke on removed.
    const call = this.peer.call(id, this.stream, { sdpTransform: (sdp: string) => videoSdp(sdp, pin) })
    if (!call) return
    const pc = call.peerConnection
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'connected') this.watch(id, pc)
    })
    // A re-offer keeps the peer, but Chrome's default encoder policy trades frame rate for sharpness;
    // a game wants the frames.
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue
      try {
        const params = sender.getParameters()
        params.degradationPreference = 'maintain-framerate'
        params.encodings = params.encodings.map((encoding) => ({ ...encoding, maxFramerate: STREAM_FPS }))
        sender.setParameters(params).catch((error) => log(`Encoder tuning skipped: ${String(error)}`))
      } catch {
        /* tuning is best effort; never stop a call over it */
      }
    }
    this.send(id, { t: 'codec', pin })
    this.callSignatures.set(id, this.streamSignature)
    this.calls.set(id, call)
    // A replaced call closes after its replacement is already registered; never let it clear the new one.
    call.on('close', () => {
      if (this.calls.get(id) !== call) return
      this.calls.delete(id)
      this.callSignatures.delete(id)
      this.stopSampler(id)
    })
    call.on('error', (error) => log(`Call to ${id} failed: ${error.type}`))
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

  /** Broadcast an emulator stream to everyone connected, and to later arrivals. */
  setStream(stream: MediaStream) {
    const signature = stream.getTracks().map((track) => track.id).join()
    if (signature === this.streamSignature) return
    this.streamSignature = signature
    this.stream = stream
    log(`Broadcasting AV stream to ${this.conns.size} peer(s) (${stream.getTracks().map((track) => track.kind).join('+')})`)
    for (const id of this.conns.keys()) this.callGuest(id)
  }

  roster() {
    this.events.onRoster(
      [...this.conns.keys()].map((id) => ({
        id,
        port: this.ports.get(id) ?? -1,
        source: this.sources.get(id),
        video: this.health.get(id),
        sent: this.sent.get(id),
        pin: this.pins.get(id) ?? 'auto',
      })),
    )
  }

  destroy() {
    this.closed = true
    for (const id of this.samplers.keys()) this.stopSampler(id)
    for (const call of this.calls.values()) call.close()
    for (const conn of this.conns.values()) conn.close()
    this.peer.destroy()
  }
}
