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

  /**
   * Put a source on the lowest free port, or return -1 if every port is taken. The local keyboard is
   * player 1 or nothing: there are no keys for the other ports, so it is only added when P1 is free.
   */
  assign(source: Source): number {
    if (source.kind === 'keyboard') {
      if (this.sources[0]?.kind !== 'none') return -1
      this.setSource(0, source)
      return 0
    }
    const port = this.sources.findIndex((current) => current.kind === 'none')
    if (port === -1) return -1
    this.setSource(port, source)
    return port
  }

  /** Assign a joining peer to the lowest unowned port, or -1 for spectator. */
  assignPeer(id: string): number {
    const owned = this.portOf(id)
    return owned !== -1 ? owned : this.assign({ kind: 'peer', id })
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
    // The keyboard only exists on port 0; asking for another port still means player 1.
    const target = source.kind === 'keyboard' ? 0 : port
    if (key) this.sources = this.sources.map((current, index) => (index !== target && ownerKey(current) === key ? { kind: 'none' } : current))
    this.sources[target] = source
    this.masks[target] = 0
  }
}

const ownerKey = (source: Source) => (source.kind === 'pad' ? `pad${source.index}` : source.kind === 'peer' ? `peer${source.id}` : '')
