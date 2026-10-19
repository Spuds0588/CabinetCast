import { useEffect, useRef, useState } from 'react'
import { padKind, padLabel, pads } from '../core/input'
import type { Slots, Source } from '../core/slots'
import type { HostPeer } from '../net/host'
import { InputIcon, type IconKind } from './InputIcon'

interface Props {
  slots: Slots
  peers: HostPeer[]
  onAssign: (source: Source) => void
  onClear: (port: number) => void
  tick: number
}

/**
 * The roster is one row of small tags: port, icon, name, live dot. Four full-height rows were a lot
 * of screen for information that is usually just "the keyboard and two controllers". Adding a player
 * is the rare path, so it sits behind + Player: it offers the free inputs (keyboard, unassigned pads)
 * and the port is chosen automatically. Gamepads and joining guests never need it.
 */
export function SlotPanel({ slots, peers, onAssign, onClear, tick }: Props) {
  const [menu, setMenu] = useState(false)
  const add = useRef<HTMLDivElement>(null)
  const detectedPads = pads()
  const free = slots.sources.some((source) => source.kind === 'none')
  // The keyboard has no keys outside player 1, so it can only be added while P1 is free.
  const keyboardFree = slots.sources[0].kind === 'none'

  useEffect(() => {
    if (!menu) return
    const onPointer = (event: PointerEvent) => {
      if (!add.current?.contains(event.target as Node)) setMenu(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenu(false)
    addEventListener('pointerdown', onPointer)
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('pointerdown', onPointer)
      removeEventListener('keydown', onKey)
    }
  }, [menu])

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

  const waiting = detectedPads.filter(
    (pad) => !slots.sources.some((source) => source.kind === 'pad' && source.index === pad.index),
  )

  const assign = (source: Source) => {
    onAssign(source)
    setMenu(false)
  }

  return (
    <div className="panel" data-tick={tick}>
      <div className="panel-head">
        <h2>Players</h2>
        <div className="add-input" ref={add}>
          <button
            className="player-add"
            onClick={() => setMenu((open) => !open)}
            disabled={!free}
            title={
              free
                ? 'Tie a detected controller to a free port'
                : waiting.length
                  ? `All four ports are playing. ${waiting.length} controller${waiting.length === 1 ? '' : 's'} waiting.`
                  : 'All four ports are playing'
            }
          >
            + Player
          </button>
          {menu && free && (
            <div className="input-menu">
              {keyboardFree && <button onClick={() => assign({ kind: 'keyboard' })}>Keyboard</button>}
              {waiting.map((pad) => (
                <button key={pad.index} onClick={() => assign({ kind: 'pad', index: pad.index })}>
                  {padLabel(pad)}
                </button>
              ))}
              {!keyboardFree && !waiting.length && (
                <p className="muted small">
                  Connect a gamepad, or share the invite link. Guests take a port automatically.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="player-tags">
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
          <span key={watcher.id} className="player-tag watcher" title="Spectating: all four ports are playing">
            <InputIcon kind={watcher.icon} size={14} />
            <span className="tag-name">{watcher.name}</span>
            <span className="tag-rate">↓{watcher.rate}</span>
            <span className="tag-note">watching</span>
          </span>
        ))}
      </div>

      {!players.length && !watchers.length && <p className="muted small">Press a key or connect a gamepad.</p>}
    </div>
  )
}
