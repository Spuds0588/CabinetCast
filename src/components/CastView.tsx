import { useEffect, useRef, useState } from 'react'
import { GuestNet, type GuestStatus } from '../net/guest'

const STATUS_TEXT: Record<GuestStatus, string> = {
  connecting: 'Connecting',
  waiting: 'Waiting for the host',
  connected: 'Connected',
  'not-found': 'Room not found',
  error: 'Connection lost',
}

/**
 * The receiving end of a cast: the host's frames, full screen, no controls and no chrome. It joins
 * like any other guest, so a Cast device never needs anything installed beyond a browser. It takes
 * picture and sound but no player port.
 */
export function CastView({ code }: { code: string }) {
  const [status, setStatus] = useState<GuestStatus>('connecting')
  const [painted, setPainted] = useState(false)
  const [full, setFull] = useState(false)
  const [soundBlocked, setSoundBlocked] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const shell = useRef<HTMLDivElement>(null)
  const audio = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const net = new GuestNet(
      code.toLowerCase(),
      {
        onStatus: setStatus,
        onAudio: (stream) => {
          const element = audio.current
          if (!element) return
          element.srcObject = stream
          element.play().catch(() => setSoundBlocked(true))
        },
        onSlot: () => undefined,
        onButtons: () => undefined,
        onFrame: (bitmap) => {
          const element = canvas.current
          if (element) {
            if (element.width !== bitmap.width || element.height !== bitmap.height) {
              element.width = bitmap.width
              element.height = bitmap.height
            }
            element.getContext('2d')?.drawImage(bitmap, 0, 0)
            setPainted(true)
          }
          bitmap.close()
        },
      },
      true,
      true,
    )
    return () => net.destroy()
  }, [code])

  useEffect(() => {
    const sync = () => setFull(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  // A popup opened from the Cast button inherits the click, so this often just works. A receiver
  // page (Presentation API) is already full screen and refuses, which is fine.
  useEffect(() => {
    const target = shell.current
    if (!target) return
    const go = () => {
      target.requestFullscreen?.().catch(() => undefined)
    }
    go()
    document.addEventListener('click', go, { once: true })
    return () => document.removeEventListener('click', go)
  }, [])

  const unmute = () => {
    audio.current
      ?.play()
      .then(() => setSoundBlocked(false))
      .catch(() => undefined)
  }

  return (
    <div className="cast" ref={shell}>
      <canvas ref={canvas} width={512} height={384} />
      <audio ref={audio} autoPlay playsInline />
      {!painted && (
        <div className="cast-note">
          <p className="eyebrow">{status === 'not-found' ? 'No cabinet' : 'CabinetCast'}</p>
          <h1>{code.toUpperCase()}</h1>
          <p className="muted">{STATUS_TEXT[status]}</p>
          {status === 'connected' && <p className="muted small">The picture starts when the host launches a game.</p>}
        </div>
      )}
      {!full && (
        <button className="cast-full" onClick={() => void shell.current?.requestFullscreen?.().catch(() => undefined)}>
          Fullscreen
        </button>
      )}
      {soundBlocked && (
        <button className="cast-sound" onClick={unmute}>
          Tap for sound
        </button>
      )}
    </div>
  )
}
