import { PORTS } from './protocol'

/** Where a port's input comes from. */
export type Source =
  | { kind: 'none' }
  | { kind: 'keyboard' }
  | { kind: 'pad'; index: number }
  | { kind: 'peer'; id: string }

/** Four logical player ports. Local sources refresh every frame; peer masks arrive over the wire. */
export class Slots {
  sources: Source[] = [{ kind: 'keyboard' }, ...Array.from({ length: PORTS - 1 }, () => ({ kind: 'none' } as Source))]
  masks: number[] = new Array(PORTS).fill(0)

  /** Assign a joining peer to the lowest unowned port, or -1 for spectator. */
  assignPeer(id: string): number {
    const owned = this.portOf(id)
    if (owned !== -1) return owned
    const port = this.sources.findIndex((source) => source.kind === 'none')
    if (port === -1) return -1
    this.setSource(port, { kind: 'peer', id })
    return port
  }

  releasePeer(id: string) {
    const port = this.portOf(id)
    if (port !== -1) this.setSource(port, { kind: 'none' })
  }

  portOf(id: string): number {
    return this.sources.findIndex((source) => source.kind === 'peer' && source.id === id)
  }

  /** Set a port's source, keeping a peer or gamepad from owning two ports at once. */
  setSource(port: number, source: Source) {
    const key = ownerKey(source)
    if (key) this.sources = this.sources.map((current, index) => (index !== port && ownerKey(current) === key ? { kind: 'none' } : current))
    this.sources[port] = source
    this.masks[port] = 0
  }
}

const ownerKey = (source: Source) => (source.kind === 'pad' ? `pad${source.index}` : source.kind === 'peer' ? `peer${source.id}` : '')
