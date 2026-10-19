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

export function GuestView({ code, pad = false }: { code: string; pad?: boolean }) {
  const [status, setStatus] = useState<GuestStatus>('connecting')
  const [detail, setDetail] = useState('')
  const [port, setPort] = useState(-1)
  // The host names how many face buttons this game uses; the pad only draws that many.
  const [buttons, setButtons] = useState(4)
  const [audio, setAudio] = useState<MediaStream | null>(null)
  const [painted, setPainted] = useState(false)
  const [sound, setSound] = useState(false)
  const [touch, setTouch] = useState(() => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)
  const [ownKind, setOwnKind] = useState<InputKind>('keyboard')
  // Phones and small windows get the handheld layout: game only, controls over it, no chrome.
  const [compact, setCompact] = useState(() => matchMedia('(pointer: coarse)').matches || innerWidth < 640 || innerHeight < 500)
  const [landscape, setLandscape] = useState(() => innerWidth > innerHeight)
  const [wide, toggleWide] = useWidescreen()
  const [keysOpen, setKeysOpen] = useState(false)
  // Frames per second and capture-to-paint delay, sampled once a second from the decoder itself.
  const [rate, setRate] = useState({ fps: 0, latency: 0, total: 0 })
  const debug = new URLSearchParams(location.search).has('debug')
  const fullscreen = useFullscreen(() => stage.current)
  useViewShortcuts({ fullscreen: fullscreen.toggle, widescreen: toggleWide })
  useHelpShortcut(setKeysOpen)

  const net = useRef<GuestNet | null>(null)
  const video = useRef<HTMLVideoElement>(null)
  const picture = useRef<HTMLCanvasElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const touchMask = useRef(0)
  const frameCount = useRef(0)
  const lastLatency = useRef(0)

  // The net object outlives any single render, so the frame sink is read through a ref.
  const sink = useRef<(bitmap: ImageBitmap, latency: number) => void>(() => undefined)
  sink.current = (bitmap, latency) => {
    const canvas = picture.current
    if (canvas) {
      // The host picks the frame size; follow it instead of assuming 384x288.
      if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
        canvas.width = bitmap.width
        canvas.height = bitmap.height
      }
      const context = canvas.getContext('2d')
      context?.drawImage(bitmap, 0, 0)
    }
    bitmap.close()
    frameCount.current += 1
    lastLatency.current = latency
    setPainted(true)
  }

  useEffect(() => {
    // A controller-only guest never asks for a picture, and the host stops encoding for it.
    const guest = new GuestNet(
      code.toLowerCase(),
      {
        onStatus: (next, message) => {
          setStatus(next)
          setDetail(message ?? '')
        },
        onAudio: setAudio,
        onSlot: setPort,
        onButtons: setButtons,
        onFrame: (bitmap, latency) => sink.current(bitmap, latency),
      },
      !pad,
    )
    net.current = guest
    if (debug) Object.assign(globalThis, { __guestNet: guest })
    return () => {
      guest.destroy()
      net.current = null
    }
  }, [code, debug, pad])

  // The call carries sound only; play it muted until the player asks for audio, which is the tap
  // mobile browsers require anyway.
  useEffect(() => {
    if (!video.current || !audio) return
    video.current.srcObject = audio
    video.current.play().catch(() => undefined)
  }, [audio])

  useEffect(() => {
    const timer = setInterval(() => {
      setRate((prev) => ({ fps: frameCount.current, latency: lastLatency.current, total: prev.total + frameCount.current }))
      frameCount.current = 0
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const update = () => {
      setCompact(matchMedia('(pointer: coarse)').matches || innerWidth < 640 || innerHeight < 500)
      setLandscape(innerWidth > innerHeight)
    }
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

  const live = status === 'connected' && painted
  // A live feed on a phone-sized screen gets the cabinet and nothing else; the toggle only matters on desktop.
  const handheld = live && compact
  const showTouch = live && (touch || compact)
  // Sideways phones should use the whole panel: the 4:3 picture is stretched to the viewport, the same
  // transform the Widescreen button applies. Turn widescreen off to get the original arcade shape.
  const fill = wide || (handheld && landscape)
  const canFullscreen = Boolean(document.fullscreenEnabled || document.documentElement.requestFullscreen)

  // Never leave a held touch button latched when the overlay is hidden or the feed stops.
  useEffect(() => {
    if (!live) touchMask.current = 0
  }, [live])

  const toggleTouch = () =>
    setTouch((on) => {
      if (on) touchMask.current = 0
      return !on
    })

  // In-person mode: the phone is a controller next to the host's screen, so there is no picture at all.
  // The pad is always laid out horizontally; a portrait phone gets the whole stage turned on its side
  // rather than a cramped vertical version of the same controls.
  if (pad) {
    return (
      <div className={`app guest pad${landscape ? '' : ' rotated'}`}>
        <div className="pad-stage">
          <div className="pad-tag">
            <span className="lamp" />
            {code || '····'} · {port === -1 ? 'Spectator' : `P${port + 1}`} · {STATUS_TEXT[status]}
          </div>
          <TouchControls layout="pad" buttons={buttons} onChange={(mask) => (touchMask.current = mask)} />
        </div>
      </div>
    )
  }

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

      <div ref={stage} className={['stage', wide && 'wide', fill && 'fill'].filter(Boolean).join(' ')}>
        <canvas ref={picture} className="frames" width={384} height={288} />
        {/* Sound only; the picture is painted from frames. */}
        <video ref={video} autoPlay playsInline muted={!sound} />

        {!painted && (
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

        {painted && !sound && (
          <button className="sound" onClick={enableSound}>
            Tap for sound
          </button>
        )}

        {/* The handheld layout hides the footer, so fullscreen needs its own control there. */}
        {handheld && canFullscreen && (
          <button
            className="stage-fullscreen"
            onClick={fullscreen.toggle}
            aria-label={fullscreen.active ? 'Exit fullscreen' : 'Fullscreen'}
            title={fullscreen.active ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen.active ? '⤡' : '⛶'}
          </button>
        )}

        {painted && (
          <div className="video-note live" role="status">
            <span>
              LIVE · {rate.fps} fps{debug ? ` · ${rate.latency} ms · ${rate.total} frames` : ''}
            </span>
          </div>
        )}
      </div>

      {showTouch && <TouchControls buttons={buttons} onChange={(mask) => (touchMask.current = mask)} />}

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
