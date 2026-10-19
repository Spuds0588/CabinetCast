import { useEffect, useRef, useState } from 'react'
import { createKeyboard, padKind, padMask } from '../core/input'
import type { InputKind } from '../core/protocol'
import { useFullscreen, useViewShortcuts, useWidescreen } from '../core/view'
import { GuestNet, type GuestStatus } from '../net/guest'
import { InputIcon } from './InputIcon'
import { KeyHelp, useHelpShortcut } from './KeyHelp'
import { TouchControls } from './TouchControls'

const STATUS_TEXT: Record<GuestStatus, string> = {
  connecting: 'Opening secure channel…',
  waiting: 'Knocking on the cabinet…',
  connected: 'Connected',
  'not-found': 'Room not found',
  error: 'Connection lost',
}

export function GuestView({ code }: { code: string }) {
  const [status, setStatus] = useState<GuestStatus>('connecting')
  const [detail, setDetail] = useState('')
  const [port, setPort] = useState(-1)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [sound, setSound] = useState(false)
  const [touch, setTouch] = useState(() => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)
  const [ownKind, setOwnKind] = useState<InputKind>('keyboard')
  // Phones and small windows get the handheld layout: game only, controls over it, no chrome.
  const [compact, setCompact] = useState(() => matchMedia('(pointer: coarse)').matches || innerWidth < 640 || innerHeight < 500)
  const [wide, toggleWide] = useWidescreen()
  const [keysOpen, setKeysOpen] = useState(false)
  const fullscreen = useFullscreen(() => stage.current)
  useViewShortcuts({ fullscreen: fullscreen.toggle, widescreen: toggleWide })
  useHelpShortcut(setKeysOpen)

  const net = useRef<GuestNet | null>(null)
  const video = useRef<HTMLVideoElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const touchMask = useRef(0)

  useEffect(() => {
    const guest = new GuestNet(code.toLowerCase(), {
      onStatus: (next, message) => {
        setStatus(next)
        setDetail(message ?? '')
      },
      onStream: setStream,
      onSlot: setPort,
    })
    net.current = guest
    return () => {
      guest.destroy()
      net.current = null
    }
  }, [code])

  useEffect(() => {
    if (video.current && stream) video.current.srcObject = stream
  }, [stream])

  useEffect(() => {
    const update = () => setCompact(matchMedia('(pointer: coarse)').matches || innerWidth < 640 || innerHeight < 500)
    addEventListener('resize', update)
    return () => removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const keys = createKeyboard()
    let frame = 0
    let lastMask = -1
    let lastSent = 0
    const step = (now: number) => {
      const pad = [...(navigator.getGamepads?.() ?? [])].find((candidate): candidate is Gamepad => Boolean(candidate))
      const mask = keys.mask() | (pad ? padMask(pad) : 0) | touchMask.current
      if (net.current && (mask !== lastMask || now - lastSent > 400)) {
        net.current.sendInput(mask)
        lastMask = mask
        lastSent = now
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      keys.dispose()
    }
  }, [])

  // Tell the host which controller to draw next to this player, and keep it current.
  useEffect(() => {
    const report = () => {
      const pad = [...(navigator.getGamepads?.() ?? [])].find((candidate): candidate is Gamepad => Boolean(candidate))
      const kind: InputKind = pad ? padKind(pad) : touch || compact ? 'touch' : 'keyboard'
      setOwnKind(kind)
      net.current?.sendSource(kind)
    }
    report()
    const timer = setInterval(report, 1500)
    return () => clearInterval(timer)
  }, [touch, compact])

  const enableSound = () => {
    setSound(true)
    video.current?.play().catch(() => undefined)
  }

  const live = status === 'connected' && Boolean(stream)
  // A live feed on a phone-sized screen gets the cabinet and nothing else; the toggle only matters on desktop.
  const handheld = live && compact
  const showTouch = live && (touch || compact)

  // Never leave a held touch button latched when the overlay is hidden or the feed stops.
  useEffect(() => {
    if (!live) touchMask.current = 0
  }, [live])

  const toggleTouch = () =>
    setTouch((on) => {
      if (on) touchMask.current = 0
      return !on
    })

  return (
    <div className={handheld ? 'app guest handheld' : 'app guest'}>
      <header className="topbar">
        <div className="brand">
          <span className="lamp" />
          CABINET<span>CAST</span>
        </div>
        <div className="room">
          <span className="label">room</span>
          <b>{code || '····'}</b>
        </div>
        <div className="statusline">
          {live && <span className="live">LIVE</span>}
          <span>{STATUS_TEXT[status]}</span>
        </div>
      </header>

      <div ref={stage} className={wide ? 'stage wide' : 'stage'}>
        <video ref={video} autoPlay playsInline muted={!sound} />

        {!stream && (
          <div className="gate">
            <div className="gate-inner">
              <p className="eyebrow">{status === 'not-found' ? 'No cabinet' : 'Waiting'}</p>
              <h1>{status === 'not-found' ? 'Room not found' : 'Waiting for the host'}</h1>
              <p className="muted">
                {status === 'not-found'
                  ? `No cabinet is broadcasting as "${code}". Check the link with your host; room codes expire when they close the tab.`
                  : detail || 'The feed starts as soon as the host inserts a ROM.'}
              </p>
            </div>
          </div>
        )}

        {stream && !sound && (
          <button className="sound" onClick={enableSound}>
            Tap for sound
          </button>
        )}
      </div>

      {showTouch && <TouchControls onChange={(mask) => (touchMask.current = mask)} />}

      <footer className="guestfoot">
        <span className="tag">
          <InputIcon kind={ownKind} size={14} />
          {port === -1 ? 'Spectator' : `Player ${port + 1}`}
        </span>
        <span className="muted small">WASD · J K L U I O buttons · Space coin · Enter start · any gamepad</span>
        <button className="ghost mini" onClick={() => setKeysOpen(true)} title="Default keyboard keys (?)">
          Keys
        </button>
        <button className="ghost mini" aria-pressed={wide} onClick={toggleWide} title="Stretch the 4:3 feed to 16:9 (Shift+W)">
          Widescreen
        </button>
        <button
          className="ghost mini"
          aria-pressed={fullscreen.active}
          onClick={fullscreen.toggle}
          title="Fullscreen (Shift+F)"
        >
          Fullscreen
        </button>
        <button className="ghost mini" aria-pressed={touch} onClick={toggleTouch}>
          {touch ? 'Touch controls ✓' : 'Touch controls'}
        </button>
      </footer>

      {keysOpen && <KeyHelp onClose={() => setKeysOpen(false)} />}
    </div>
  )
}
