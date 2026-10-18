import Peer, { type DataConnection, type PeerError } from 'peerjs'
import { ENDPOINT, type GuestMessage, type HostMessage } from '../core/protocol'

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
  onLatency(ms: number): void
}

const log = (message: string) => console.log(`[Cabinet:NetGuest] ${message}`)

export class GuestNet {
  private readonly peer: Peer
  private conn: DataConnection | null = null
  private pings = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private destroyed = false

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
        this.startPing()
      })
      conn.on('close', () => !this.destroyed && this.events.onStatus('error', 'host closed the connection'))
      conn.on('data', (data) => this.receive(data))
    })

    // The host pushes the AV stream as a call; answer it so the tracks start flowing.
    this.peer.on('call', (call) => {
      call.answer()
      call.on('stream', (stream) => {
        log(`Received host stream (${stream.getTracks().map((track) => track.kind).join('+')})`)
        this.events.onStream(stream)
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
      if (message.t === 'pong') {
        const rtt = Math.round(performance.now() - message.ts)
        this.events.onLatency(rtt)
        if (this.pings % 5 === 0) this.send({ t: 'stat', rtt })
      }
    } catch {
      /* ignore malformed control messages */
    }
  }

  private startPing() {
    this.timer = setInterval(() => {
      this.pings += 1
      this.send({ t: 'ping', ts: performance.now() })
    }, 1000)
  }

  private send(message: GuestMessage) {
    if (this.conn?.open) this.conn.send(JSON.stringify(message))
  }

  /** Send a 2-byte input frame for this guest's assigned port. */
  sendInput(mask: number) {
    if (this.conn?.open) this.conn.send(new Uint8Array([mask & 0xff, (mask >> 8) & 0xff]))
  }

  destroy() {
    this.destroyed = true
    if (this.timer) clearInterval(this.timer)
    this.conn?.close()
    this.peer.destroy()
  }
}
