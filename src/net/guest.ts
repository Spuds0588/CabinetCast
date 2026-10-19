import Peer, { type DataConnection, type MediaConnection, type PeerError } from 'peerjs'
import { ENDPOINT, FRAME_HEADER, FRAME_TAG, type GuestMessage, type HostMessage, type InputKind } from '../core/protocol'

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
}

export type GuestStatus = 'connecting' | 'waiting' | 'connected' | 'not-found' | 'error'

export interface GuestEvents {
  onStatus(status: GuestStatus, detail?: string): void
  /** Sound only; pictures arrive through `onFrame`. */
  onAudio(stream: MediaStream): void
  onSlot(port: number): void
  /** How many face buttons this game has, as set by the host. */
  onButtons(count: number): void
  /** One decoded picture, plus how long it took from capture on the host to a bitmap here. */
  onFrame(bitmap: ImageBitmap, latency: number): void
}

const log = (message: string) => console.log(`[Cabinet:NetGuest] ${message}`)

export class GuestNet {
  private readonly peer: Peer
  private conn: DataConnection | null = null
  private call: MediaConnection | null = null
  private destroyed = false
  private source: InputKind | null = null
  private sentSource: InputKind | null = null
  /** Newest frame waiting while the decoder is busy. Older ones are dropped, never queued. */
  private pending: Uint8Array | null = null
  private decoding = false

  constructor(
    private readonly code: string,
    private readonly events: GuestEvents,
    /** False for a controller-only guest: it never asks for, or decodes, a picture. */
    private readonly wantsVideo = true,
  ) {
    this.peer = new Peer({ config: ICE })

    this.peer.on('open', () => {
      log(`Signaling ready, joining room "${code}"`)
      this.events.onStatus('waiting')
      const conn = this.peer.connect(ENDPOINT(code), { reliable: false, serialization: 'binary' })
      this.conn = conn
      conn.on('open', () => {
        log(`Connected to room "${code}"`)
        this.events.onStatus('connected')
        this.send({ t: 'hello', platform: /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'apple' : 'other' })
        this.send({ t: 'mode', video: this.wantsVideo })
        this.flushSource()
      })
      conn.on('close', () => !this.destroyed && this.events.onStatus('error', 'host closed the connection'))
      conn.on('data', (data) => this.receive(data))
    })

    // The host still calls for the audio track; answer it, but there is no video to wait for.
    this.peer.on('call', (call) => {
      call.answer()
      this.call = call
      call.on('stream', (stream) => this.events.onAudio(stream))
      call.on('close', () => {
        if (this.call === call) this.call = null
      })
    })

    this.peer.on('error', (error: PeerError<string>) => {
      log(`Peer error: ${error.type} ${error.message}`)
      this.events.onStatus(error.type === 'peer-unavailable' ? 'not-found' : 'error', error.message)
    })
    this.peer.on('disconnected', () => !this.destroyed && this.peer.reconnect())
  }

  private receive(data: unknown) {
    if (data instanceof Uint8Array) return this.queueFrame(data)
    if (data instanceof ArrayBuffer) return this.queueFrame(new Uint8Array(data))
    if (typeof data !== 'string') return
    try {
      const message = JSON.parse(data) as HostMessage
      if (message.t === 'slot') this.events.onSlot(message.port)
      else if (message.t === 'buttons') this.events.onButtons(message.count)
    } catch {
      /* ignore malformed control messages */
    }
  }

  /** Keep at most one frame in flight: a stale picture is worth less than the next one. */
  private queueFrame(bytes: Uint8Array) {
    if (!this.wantsVideo || bytes[0] !== FRAME_TAG) return
    if (this.decoding) {
      this.pending = bytes
      return
    }
    void this.decode(bytes)
  }

  private async decode(bytes: Uint8Array) {
    this.decoding = true
    try {
      const captured = new DataView(bytes.buffer, bytes.byteOffset + 1, 8).getFloat64(0, true)
      const jpeg = bytes.subarray(FRAME_HEADER)
      const bitmap = await createImageBitmap(new Blob([jpeg.slice().buffer], { type: 'image/jpeg' }))
      if (!this.destroyed) this.events.onFrame(bitmap, Math.max(0, Date.now() - captured))
    } catch {
      /* a torn or undecodable frame is skipped; the next one arrives in ~33ms */
    }
    this.decoding = false
    const next = this.pending
    this.pending = null
    if (next) void this.decode(next)
  }

  private send(message: GuestMessage) {
    if (this.conn?.open) this.conn.send(JSON.stringify(message))
  }

  /** Send a 2-byte input frame for this guest's assigned port. */
  sendInput(mask: number) {
    if (this.conn?.open) this.conn.send(new Uint8Array([mask & 0xff, (mask >> 8) & 0xff]))
  }

  /** Tell the host what this player is holding, so the roster can show the right icon. */
  sendSource(kind: InputKind) {
    this.source = kind
    this.flushSource()
  }

  private flushSource() {
    if (!this.conn?.open || !this.source || this.source === this.sentSource) return
    this.sentSource = this.source
    this.send({ t: 'source', kind: this.source })
  }

  destroy() {
    this.destroyed = true
    this.call?.close()
    this.conn?.close()
    this.peer.destroy()
  }
}
