import Peer, { type DataConnection, type MediaConnection, type PeerError } from 'peerjs'
import {
  ENDPOINT,
  type CodecPin,
  type GuestMessage,
  type HostMessage,
  type InputKind,
  type VideoHealth,
} from '../core/protocol'

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
}

export type GuestStatus = 'connecting' | 'waiting' | 'connected' | 'not-found' | 'error'

export interface GuestEvents {
  onStatus(status: GuestStatus, detail?: string): void
  onStream(stream: MediaStream): void
  onSlot(port: number): void
  /** Once a second: what the receiver is decoding, so a stalled picture can be diagnosed on screen. */
  onHealth(health: VideoHealth): void
  /** The `<video>` element's own state, folded into the health report. */
  videoState(): string
}

const log = (message: string) => console.log(`[Cabinet:NetGuest] ${message}`)

export class GuestNet {
  private readonly peer: Peer
  private conn: DataConnection | null = null
  private call: MediaConnection | null = null
  private destroyed = false
  private source: InputKind | null = null
  private sentSource: InputKind | null = null
  private pin: CodecPin = 'auto'
  /** Set once this guest asks for a codec; from then on the local request wins over host confirmations. */
  private requested: CodecPin | null = null
  private sampler = 0

  constructor(private readonly code: string, private readonly events: GuestEvents) {
    this.peer = new Peer({ config: ICE })

    this.peer.on('open', () => {
      log(`Signaling ready, joining room "${code}"`)
      this.events.onStatus('waiting')
      const conn = this.peer.connect(ENDPOINT(code), { reliable: false, serialization: 'binary' })
      this.conn = conn
      conn.on('open', () => {
        log(`Connected to room "${code}"`)
        this.events.onStatus('connected')
        // The first offer is built from this: Safari needs H.264 first, Chromium decodes VP8 everywhere.
        this.send({ t: 'hello', platform: /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'apple' : 'other' })
        this.flushSource()
      })
      conn.on('close', () => !this.destroyed && this.events.onStatus('error', 'host closed the connection'))
      conn.on('data', (data) => this.receive(data))
    })

    // The host pushes the AV stream as a call; answer it so the tracks start flowing.
    this.peer.on('call', (call) => {
      call.answer()
      this.call = call
      call.on('stream', (stream) => {
        log(`Received host stream (${stream.getTracks().map((track) => track.kind).join('+')})`)
        this.events.onStream(stream)
        this.watch(call.peerConnection)
      })
      // A re-offer replaces this call; its close must not stop the replacement's sampler.
      call.on('close', () => {
        if (this.call !== call) return
        this.call = null
        this.stopSampler()
      })
    })

    this.peer.on('error', (error: PeerError<string>) => {
      log(`Peer error: ${error.type} ${error.message}`)
      this.events.onStatus(error.type === 'peer-unavailable' ? 'not-found' : 'error', error.message)
    })
    this.peer.on('disconnected', () => !this.destroyed && this.peer.reconnect())
  }

  private receive(data: unknown) {
    if (typeof data !== 'string') return
    try {
      const message = JSON.parse(data) as HostMessage
      if (message.t === 'slot') this.events.onSlot(message.port)
      // The host names the codec it offered, so the health readout shows what is really being decoded.
      if (message.t === 'codec' && !this.requested) this.pin = message.pin
    } catch {
      /* ignore malformed control messages */
    }
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

  /** Ask the host to re-offer pinned to one codec, e.g. after audio arrived but no picture. */
  retryVideo(pin: CodecPin) {
    this.pin = pin
    this.requested = pin
    this.send({ t: 'retry', pin })
    log(`Asking the host for ${pin} video`)
  }

  private flushSource() {
    if (!this.conn?.open || !this.source || this.source === this.sentSource) return
    this.sentSource = this.source
    this.send({ t: 'source', kind: this.source })
  }

  private stopSampler() {
    if (this.sampler) clearInterval(this.sampler)
    this.sampler = 0
  }

  /**
   * Read the receiver's own counters once a second. `framesDecoded` staying at zero while audio bytes
   * climb is the signature of a decoder that never got a frame it could use, and it is invisible from
   * the host's side of the call.
   */
  private watch(pc: RTCPeerConnection) {
    this.stopSampler()
    let lastFrames = 0
    let lastAt = 0
    const sample = () => {
      void pc
        .getStats()
        .then((report) => {
          let video: RTCInboundRtpStreamStats | undefined
          let audio: RTCInboundRtpStreamStats | undefined
          for (const stat of report.values()) {
            if (stat.type !== 'inbound-rtp') continue
            if (stat.kind === 'video') video = stat
            if (stat.kind === 'audio') audio = stat
          }
          const codec = video?.codecId ? report.get(video.codecId) : undefined
          const frames = video?.framesDecoded ?? 0
          const now = performance.now()
          const elapsed = lastAt ? (now - lastAt) / 1000 : 1
          const fps = video?.framesPerSecond ?? (lastAt ? (frames - lastFrames) / elapsed : 0)
          lastFrames = frames
          lastAt = now
          const health: VideoHealth = {
            codec: (codec as { mimeType?: string } | undefined)?.mimeType ?? '—',
            width: video?.frameWidth ?? 0,
            height: video?.frameHeight ?? 0,
            fps: Math.round(fps || 0),
            frames,
            audio: audio?.bytesReceived ?? 0,
            element: this.events.videoState(),
            pin: this.pin,
          }
          this.events.onHealth(health)
          this.send({ t: 'health', health })
        })
        .catch(() => undefined)
    }
    sample()
    this.sampler = window.setInterval(sample, 1000)
  }

  destroy() {
    this.destroyed = true
    this.stopSampler()
    this.call?.close()
    this.conn?.close()
    this.peer.destroy()
  }
}
