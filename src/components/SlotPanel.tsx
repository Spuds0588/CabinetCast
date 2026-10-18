import type { Slots, Source } from '../core/slots'
import type { HostPeer } from '../net/host'
import { connectedPads } from '../core/input'

interface Props {
  slots: Slots
  peers: HostPeer[]
  onChange: (port: number, source: Source) => void
  tick: number
}

const value = (source: Source) =>
  source.kind === 'pad' ? `pad:${source.index}` : source.kind === 'peer' ? `peer:${source.id}` : source.kind

export function SlotPanel({ slots, peers, onChange, tick }: Props) {
  const pads = connectedPads()
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Player slots</h2>
        <span className="count">{peers.length} guest{peers.length === 1 ? '' : 's'}</span>
      </div>

      <ul className="slots">
        {slots.sources.map((source, port) => (
          <li key={port} className={slots.masks[port] ? 'slot live' : 'slot'} data-tick={tick}>
            <span className="port">P{port + 1}</span>
            <span className="signal" aria-hidden />
            <select
              value={value(source)}
              onChange={(event) => {
                const next = event.target.value
                onChange(
                  port,
                  next === 'none'
                    ? { kind: 'none' }
                    : next === 'keyboard'
                      ? { kind: 'keyboard' }
                      : next.startsWith('pad:')
                        ? { kind: 'pad', index: Number(next.slice(4)) }
                        : { kind: 'peer', id: next.slice(5) },
                )
              }}
            >
              <option value="none">Empty</option>
              <option value="keyboard">Local keyboard</option>
              {pads.map((index) => (
                <option key={index} value={`pad:${index}`}>
                  Gamepad {index + 1}
                </option>
              ))}
              {peers.map((peer) => (
                <option key={peer.id} value={`peer:${peer.id}`}>
                  Guest {peer.id.slice(-4)} {peer.rtt === null ? '' : `(${peer.rtt}ms)`}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      {peers.length === 0 ? (
        <p className="muted">Nobody has joined yet. Share the invite link to fill the cabinet.</p>
      ) : (
        <ul className="peers">
          {peers.map((peer) => (
            <li key={peer.id}>
              <span className="dot" />
              <span className="grow">Guest {peer.id.slice(-4)}</span>
              <span className="tag">{peer.port === -1 ? 'spectator' : `P${peer.port + 1}`}</span>
              <span className="tag">{peer.rtt === null ? 'live' : `${peer.rtt} ms`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
