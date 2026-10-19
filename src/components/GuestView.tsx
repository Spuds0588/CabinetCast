import { useEffect, useRef, useState } from 'react'
import { createKeyboard, padMask } from '../core/input'
import { GuestNet, type GuestStatus } from '../net/guest'

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
  const [rtt, setRtt] = useState<number | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [sound, setSound] = useState(false)

  const net = useRef<GuestNet | null>(null)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const guest = new GuestNet(code.toLowerCase(), {
      onStatus: (next, message) => {
        setStatus(next)
        setDetail(message ?? '')
      },
      onStream: setStream,
      onSlot: setPort,
      onLatency: setRtt,
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
    if (video.current) video.current.muted = !sound
  }, [sound])

  useEffect(() => {
    const keys = createKeyboard()
    let frame = 0
    let lastMask = -1
    let lastSent = 0
    const step = (now: number) => {
      const pad = [...(navigator.getGamepads?.() ?? [])].find((candidate): candidate is Gamepad => Boolean(candidate))
      const mask = keys.mask() | (pad ? padMask(pad) : 0)
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

  const enableSound = () => {
    setSound(true)
    video.current?.play().catch(() => undefined)
  }

  const live = status === 'connected' && Boolean(stream)

  return (
    <div className="app guest">
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
          {rtt !== null && <span className="tag">{rtt} ms</span>}
        </div>
      </header>

      <div className="stage">
        <video ref={video} autoPlay playsInline />

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

      <footer className="guestfoot">
        <span className="tag">{port === -1 ? 'Spectator' : `Player ${port + 1}`}</span>
        <span className="muted small">Arrows · Z X C V · A S buttons · Space coin · Enter start · any gamepad</span>
      </footer>
    </div>
  )
}
