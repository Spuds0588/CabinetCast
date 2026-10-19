import { useEffect, useRef, useState } from 'react'
import { getBios, saveBios } from '../core/bios'
import { launchArcade, type ArcadeSession } from '../core/emulator'
import { createKeyboard, padMask } from '../core/input'
import { PORT_KEYS } from '../core/protocol'
import { Slots, type Source } from '../core/slots'
import { HostNet, type HostPeer } from '../net/host'
import { SlotPanel } from './SlotPanel'

type Status = 'starting' | 'idle' | 'loading' | 'running' | 'error'

export function HostView() {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<Status>('starting')
  const [error, setError] = useState('')
  const [rom, setRom] = useState('')
  const [biosReady, setBiosReady] = useState(false)
  const [peers, setPeers] = useState<HostPeer[]>([])
  const [copied, setCopied] = useState(false)
  const [tick, setTick] = useState(0)

  const slots = useRef(new Slots()).current
  const host = useRef<HostNet | null>(null)
  const session = useRef<ArcadeSession | null>(null)
  const keyboards = useRef<ReturnType<typeof createKeyboard>[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = () => setTick((value) => value + 1)

  useEffect(() => {
    getBios().then((bios) => setBiosReady(Boolean(bios)))
    // One reader per port: each keyboard slot only sees the keys PORT_KEYS declares for that port.
    const keys = PORT_KEYS.map((_, port) => createKeyboard(port))
    keyboards.current = keys

    let disposed = false
    HostNet.start({
      onRoster: setPeers,
      onJoin(id) {
        const port = slots.assignPeer(id)
        host.current?.setSlot(id, port)
        console.log(`[Cabinet:SlotMgr] Peer "${id}" assigned to Port ${port + 1}`)
        refresh()
      },
      onLeave(id) {
        slots.releasePeer(id)
        refresh()
      },
      onInput(id, mask) {
        const port = slots.portOf(id)
        if (port !== -1) slots.masks[port] = mask
      },
      // Reuse the room code across reloads so shared invites stay valid.
    }, sessionStorage.getItem('cabinetcast:room'))
      .then((net) => {
        if (disposed) return net.destroy()
        host.current = net
        setCode(net.code)
        setStatus('idle')
        if (session.current) net.setStream(session.current.getStream())
      })
      .catch((cause: unknown) => {
        setStatus('error')
        setError(`Signaling unavailable: ${String(cause)}`)
      })

    return () => {
      disposed = true
      keys.forEach((reader) => reader.dispose())
      host.current?.destroy()
      host.current = null
    }
  }, [slots])

  // Single frame loop: refresh local slot masks and push every port into the core.
  useEffect(() => {
    let frame = 0
    const step = () => {
      const active = session.current
      if (active) {
        slots.sources.forEach((source, port) => {
          if (source.kind === 'keyboard') slots.masks[port] = keyboards.current[port]?.mask() ?? 0
          if (source.kind === 'pad') {
            const pad = navigator.getGamepads()[source.index]
            slots.masks[port] = pad ? padMask(pad) : 0
          }
          active.inject(port, slots.masks[port] ?? 0)
        })
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [slots])

  // Live input LEDs without re-rendering the whole tree every frame.
  useEffect(() => {
    const timer = setInterval(refresh, 120)
    return () => clearInterval(timer)
  }, [])

  // The emulator canvas stays at 384x288 CSS; scale it to fill the cabinet.
  useEffect(() => {
    const cabinet = document.querySelector<HTMLElement>('.cabinet')
    if (!cabinet) return
    const fit = () => cabinet.style.setProperty('--cabinet-scale', String(cabinet.clientWidth / 384))
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(cabinet)
    return () => observer.disconnect()
  }, [])

  const startGame = async (file: File) => {
    setError('')
    setStatus('loading')
    try {
      session.current?.exit()
      session.current = null
      const bios = await getBios()
      const next = await launchArcade(file, bios)
      session.current = next
      setRom(next.romName)
      setStatus('running')
      host.current?.setStream(next.getStream())
      // Audio destinations can be attached slightly after the core boots.
      setTimeout(() => host.current?.setStream(next.getStream()), 1500)
    } catch (cause) {
      console.error('[Cabinet:Core] launch failed', cause)
      setStatus('error')
      setError(String((cause as Error)?.message ?? cause))
    }
  }

  const drop = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file || status === 'running' || status === 'loading') return
    if (/neogeo\.zip$/i.test(file.name)) {
      await saveBios(file)
      setBiosReady(true)
      return
    }
    if (!/\.zip$/i.test(file.name)) {
      setError('Arcade sets must be .zip archives.')
      return
    }
    startGame(file)
  }

  const invite = `${location.origin}${location.pathname}?room=${code}`

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(invite)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Clipboard blocked. Copy the link manually.')
    }
  }

  const empty = status !== 'running'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="lamp" />
          CABINET<span>CAST</span>
        </div>
        <div className="room">
          <span className="label">room</span>
          <b>{code || '····'}</b>
        </div>
        <button className="ghost" onClick={copyInvite} disabled={!code}>
          {copied ? 'Copied ✓' : 'Copy invite link'}
        </button>
      </header>

      <main className="host">
        <section
          className="cabinet"
          onMouseDown={(event) => event.preventDefault()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            drop(event.dataTransfer.files)
          }}
        >
          <canvas id="cabinet-canvas" width={384} height={288} />
          {status === 'running' && <div className="marquee">{rom}</div>}

          {empty && (
            <div className="gate">
              <div className="gate-inner">
                <p className="eyebrow">Drop a ROM</p>
                <h1>{status === 'loading' ? 'Booting core…' : 'Insert cartridge'}</h1>
                <p className="muted">
                  Drag your arcade <code>.zip</code> here, or pick a file. Nothing leaves this browser except the video
                  stream to your guests.
                </p>
                <div className="gate-actions">
                  <button className="primary" onClick={() => fileInput.current?.click()} disabled={status === 'loading'}>
                    Choose ROM
                  </button>
                  <span className="bios">{biosReady ? 'neogeo.zip stored ✓' : 'neogeo.zip optional'}</span>
                </div>
                {error && <p className="error">{error}</p>}
                <p className="keys">P1 keyboard: arrows · Z X C V · A S · Space = coin · Enter = start</p>
              </div>
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".zip"
            hidden
            onChange={(event) => drop(event.target.files)}
          />
        </section>

        <aside>
          <SlotPanel
            slots={slots}
            peers={peers}
            tick={tick}
            onChange={(port, source: Source) => {
              slots.setSource(port, source)
              // Tell every guest where it landed; a remap can leave another guest unassigned.
              for (const peer of peers) host.current?.setSlot(peer.id, slots.portOf(peer.id))
              refresh()
            }}
          />

          <div className="panel">
            <h2>Invite</h2>
            <div className="invite">
              <code>{invite || 'starting signaling…'}</code>
              <button className="ghost" onClick={copyInvite} disabled={!code}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="muted small">
              Guests open this link on any device, no install. Host keeps the ROM and the emulator; only the AV stream
              is sent.
            </p>
          </div>

          <div className="panel">
            <h2>Session</h2>
            <div className="row">
              <span className="tag">{status}</span>
              {status === 'running' && (
                <button
                  className="ghost"
                  onClick={() => {
                    session.current?.exit()
                    // A fresh core needs a fresh page; the room code is reused on reload.
                    location.reload()
                  }}
                >
                  Stop game
                </button>
              )}
              <button className="ghost" onClick={() => document.querySelector('.cabinet')?.requestFullscreen()}>
                Fullscreen
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
