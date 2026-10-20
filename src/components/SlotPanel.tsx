import { padKind, padLabel, pads } from '../core/input'
import type { Slots, Source } from '../core/slots'
import type { HostPeer } from '../net/host'
import { InputIcon, type IconKind } from './InputIcon'

interface Props {
  slots: Slots
  peers: HostPeer[]
  onClear: (port: number) => void
  /** Opens the controller-only QR: a phone joins as a pad, nothing else. */
  onPhone: () => void
  tick: number
}

/**
 * The roster is one centered row of small tags under the cabinet: port, icon, name, live dot.
 * Gamepads connect themselves and guests take a port on join, so the only manual add is a phone:
 * the tag at the end of the row shows the QR a phone scans to become a controller.
 */
export function SlotPanel({ slots, peers, onClear, onPhone, tick }: Props) {
  const detectedPads = pads()
  const free = slots.sources.some((source) => source.kind === 'none')

  const label = (source: Source) => {
    if (source.kind === 'keyboard') return 'Keyboard'
    if (source.kind === 'peer') return `Guest ${source.id.slice(-4)}`
    if (source.kind === 'pad') {
      const pad = detectedPads.find((candidate) => candidate.index === source.index)
      return pad ? padLabel(pad) : `Gamepad ${source.index + 1}`
    }
    return 'Empty'
  }

  const peerSource = (id: string): IconKind => peers.find((peer) => peer.id === id)?.source ?? 'guest'

  const kindOf = (source: Source): IconKind => {
    if (source.kind === 'keyboard') return 'keyboard'
    if (source.kind === 'pad') {
      const pad = detectedPads.find((candidate) => candidate.index === source.index)
      return pad ? padKind(pad) : 'gamepad'
    }
    if (source.kind === 'peer') return peerSource(source.id)
    return 'empty'
  }

  const rateOf = (source: Source) =>
    source.kind === 'peer' ? peers.find((peer) => peer.id === source.id)?.frames : undefined

  const players = slots.sources.flatMap((source, port) =>
    source.kind === 'none'
      ? []
      : [{ port, source, name: label(source), icon: kindOf(source), rate: rateOf(source), live: slots.masks[port] !== 0 }],
  )

  // Guests beyond the four ports still get a tag, so the host can see the feed is reaching them.
  const watchers = peers.flatMap((peer) =>
    slots.portOf(peer.id) === -1
      ? [{ id: peer.id, name: `Guest ${peer.id.slice(-4)}`, icon: peerSource(peer.id), rate: peer.frames ?? 0 }]
      : [],
  )

  return (
    <div className="roster" data-tick={tick}>
      {/* A group, not a list: the pill row also holds the phone button, which is not an item. */}
      <div className="player-tags" role="group" aria-label="Players">
        {players.map((player) => (
          <span
            key={player.port}
            className={['player-tag', `port-${player.port + 1}`, player.live ? 'live' : ''].filter(Boolean).join(' ')}
          >
            <span className="dot" aria-hidden />
            <b className="tag-port">P{player.port + 1}</b>
            <InputIcon kind={player.icon} size={14} />
            <span className="tag-name">{player.name}</span>
            {player.rate !== undefined && (
              <span className="tag-rate" title="Frames per second this guest is receiving">
                ↓{player.rate}
              </span>
            )}
            {(player.source.kind === 'keyboard' || player.source.kind === 'pad') && (
              <button
                className="tag-x"
                onClick={() => onClear(player.port)}
                aria-label={`Remove ${player.name} from port ${player.port + 1}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {watchers.map((watcher) => (
          <span
            key={watcher.id}
            className="player-tag watcher"
            title="Spectating: all four ports are playing"
          >
            <InputIcon kind={watcher.icon} size={14} />
            <span className="tag-name">{watcher.name}</span>
            <span className="tag-rate">↓{watcher.rate}</span>
            <span className="tag-note">watching</span>
          </span>
        ))}
        <button
          className="player-add"
          aria-haspopup="dialog"
          onClick={onPhone}
          disabled={!free}
          title={free ? 'Show a QR code a phone can scan to play as a controller' : 'All four ports are playing'}
        >
          <InputIcon kind="touch" size={13} />
          + Phone controller
        </button>
      </div>
    </div>
  )
}
