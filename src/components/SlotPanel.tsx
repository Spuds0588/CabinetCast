import { useState } from 'react'
import { padKind, padLabel, pads } from '../core/input'
import { PORTS } from '../core/protocol'
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

export function SlotPanel({ slots, peers, onAssign, onClear, tick }: Props) {
  const [menu, setMenu] = useState(false)
  const detectedPads = pads()
  const free = slots.sources.some((source) => source.kind === 'none')
  // The keyboard has no keys outside player 1, so it can only be added while P1 is free.
  const keyboardFree = slots.sources[0].kind === 'none'

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

  const assign = (source: Source) => {
    onAssign(source)
    setMenu(false)
  }

  const keyboardPorts = slots.sources.flatMap((source, port) => (source.kind === 'keyboard' ? [port] : []))
  const padRows = detectedPads.map((pad) => ({
    pad,
    port: slots.sources.findIndex((source) => source.kind === 'pad' && source.index === pad.index),
  }))
  const unassignedPads = padRows.filter((row) => row.port === -1)

  // One list in port order: assigned sources first, then anything still waiting for a port.
  type Row = { key: string; port: number; name: string; kind: 'keyboard' | 'pad' | 'peer'; icon: IconKind; padIndex?: number }
  const rank = (port: number) => (port === -1 ? PORTS : port)
  // Keyboard always has a row, so it can be added back after being removed from every port.
  const keyboardRows: Row[] = keyboardPorts.length
    ? keyboardPorts.map((port) => ({ key: `keyboard-${port}`, port, name: 'Keyboard', kind: 'keyboard', icon: 'keyboard' }))
    : [{ key: 'keyboard-0', port: -1, name: 'Keyboard', kind: 'keyboard', icon: 'keyboard' }]
  const inputRows: Row[] = padRows.map(({ pad, port }) => ({
    key: `pad-${pad.index}`,
    port,
    name: padLabel(pad),
    kind: 'pad',
    icon: padKind(pad),
    padIndex: pad.index,
  }))
  const peerRows: Row[] = peers.map((peer) => ({
    key: peer.id,
    port: slots.portOf(peer.id),
    name: `Guest ${peer.id.slice(-4)}`,
    kind: 'peer',
    icon: peerSource(peer.id),
  }))

  /** Two counters in one glance: what this host encodes, and what the guest's own decoder reports. */
  const videoTags = (id: string) => {
    const peer = peers.find((candidate) => candidate.id === id)
    if (!peer) return null
    const sent = peer.sent
    const video = peer.video
    const up = sent?.fps ?? 0
    const down = video?.fps ?? 0
    return (
      <span className="video-tags">
        <span
          className={up ? 'tag mini-tag' : 'tag mini-tag bad'}
          title={sent ? `Host encoding ${sent.codec} · ${sent.frames} frames · ${sent.limitation}` : 'Not encoding yet'}
        >
          ↑{up}
        </span>
        <span
          className={video && video.frames > 0 ? 'tag mini-tag' : 'tag mini-tag bad'}
          title={
            video
              ? `Guest decoding ${video.codec} · ${video.width}×${video.height} · ${video.frames} frames · ${video.element} · ${video.pin}`
              : 'Guest has not reported its video yet'
          }
        >
          ↓{down}
        </span>
      </span>
    )
  }
  const rows = [...keyboardRows, ...inputRows, ...peerRows].sort((a, b) => rank(a.port) - rank(b.port))

  const assignRow = (row: Row) => {
    if (row.kind === 'keyboard') return assign({ kind: 'keyboard' })
    if (row.kind === 'pad' && row.padIndex !== undefined) return assign({ kind: 'pad', index: row.padIndex })
  }

  return (
    <div className="panel" data-tick={tick}>
      <div className="panel-head">
        <h2>Players</h2>
        <span className="count">
          {peers.length} guest{peers.length === 1 ? '' : 's'}
        </span>
      </div>

      <ul className="slots">
        {slots.sources.map((source, port) => (
          <li key={port} className={slots.masks[port] ? 'slot live' : 'slot'}>
            <span className="port">P{port + 1}</span>
            <span className="signal" aria-hidden />
            <InputIcon kind={kindOf(source)} />
            <span className={source.kind === 'none' ? 'slot-name empty' : 'slot-name'}>{label(source)}</span>
            {source.kind === 'keyboard' || source.kind === 'pad' ? (
              <button className="icon" onClick={() => onClear(port)} aria-label={`Remove ${label(source)} from port ${port + 1}`}>
                ×
              </button>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>

      <h2 className="sub">Detected inputs</h2>
      <ul className="inputs">
        {rows.map((row) => (
          <li key={row.key}>
            <InputIcon kind={row.icon} />
            <span className="grow">{row.name}</span>
            {row.kind === 'peer' && videoTags(row.key)}
            {row.port !== -1 && <span className="tag">P{row.port + 1}</span>}
            {row.kind === 'peer' ? (
              row.port === -1 && <span className="tag">spectator</span>
            ) : row.port === -1 ? (
              <button
                className="mini"
                onClick={() => assignRow(row)}
                disabled={row.kind === 'keyboard' ? !keyboardFree : !free}
                title={row.kind === 'keyboard' && !keyboardFree ? 'Player 1 is taken; the keyboard has no other port' : undefined}
              >
                Assign
              </button>
            ) : (
              <button className="mini" onClick={() => onClear(row.port)}>
                Remove
              </button>
            )}
          </li>
        ))}
        {!rows.length && <li className="muted small">No inputs yet. Press a key or connect a gamepad.</li>}
      </ul>

      {!peers.length && <p className="muted small">Guests appear here when they join.</p>}

      <div className="add-input">
        <button className="ghost" onClick={() => setMenu((open) => !open)} disabled={!free}>
          {free ? '+ Add player input' : 'All ports filled'}
        </button>
        {menu && free && (
          <div className="input-menu">
            {unassignedPads.map(({ pad }) => (
              <button key={pad.index} onClick={() => assign({ kind: 'pad', index: pad.index })}>
                {padLabel(pad)}
              </button>
            ))}
            {!unassignedPads.length && (
              <p className="muted small">Connect a gamepad. Players 2–4 need their own device.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
