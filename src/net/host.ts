import Peer, { type DataConnection, type MediaConnection } from 'peerjs'
import { ENDPOINT, randomCode, type HostMessage } from '../core/protocol'

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
}

export interface HostPeer {
  id: string
  port: number
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
      if (this.stream) this.callGuest(id)
    })
    conn.on('close', () => this.drop(id))
    conn.on('error', () => this.drop(id))
    conn.on('data', (data) => this.receive(id, data))
  }

  private receive(id: string, data: unknown) {
    if (data instanceof ArrayBuffer) return this.events.onInput(id, new DataView(data).getUint16(0, true))
    if (data instanceof Uint8Array) return this.events.onInput(id, (data[0] ?? 0) | ((data[1] ?? 0) << 8))
  }

  private drop(id: string) {
    if (!this.conns.delete(id)) return
    log(`Guest ${id} disconnected`)
    this.calls.get(id)?.close()
    this.calls.delete(id)
    this.callSignatures.delete(id)
    this.ports.delete(id)
    this.events.onLeave(id)
    this.roster()
  }

  private callGuest(id: string) {
    if (!this.stream || this.callSignatures.get(id) === this.streamSignature) return
    this.calls.get(id)?.close()
    const call = this.peer.call(id, this.stream)
    if (!call) return
    this.callSignatures.set(id, this.streamSignature)
    this.calls.set(id, call)
    call.on('close', () => {
      this.calls.delete(id)
      this.callSignatures.delete(id)
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
    this.events.onRoster([...this.conns.keys()].map((id) => ({ id, port: this.ports.get(id) ?? -1 })))
  }

  destroy() {
    this.closed = true
    for (const call of this.calls.values()) call.close()
    for (const conn of this.conns.values()) conn.close()
    this.peer.destroy()
  }
}
