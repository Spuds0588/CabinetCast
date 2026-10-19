import { useCallback, useEffect, useRef, useState } from 'react'
import { getBios, saveBios } from '../core/bios'
import { launchArcade, type ArcadeSession } from '../core/emulator'
import { createKeyboard, padLabel, padMask, pads } from '../core/input'
import { ago, deleteSave, getSave, putSave, romKey, saveTimes, type SaveSlot } from '../core/saves'
import { Slots, type Source } from '../core/slots'
import { useFullscreen, useViewShortcuts, useWidescreen } from '../core/view'
import { HostNet, type HostPeer } from '../net/host'
import { KeyHelp, useHelpShortcut } from './KeyHelp'
import { QrDialog } from './QrDialog'
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
  const [fps, setFps] = useState(0)
  const [qrOpen, setQrOpen] = useState(false)
  const [keysOpen, setKeysOpen] = useState(false)
  const [saves, setSaves] = useState<Partial<Record<SaveSlot, number>>>({})
  const [saveStatus, setSaveStatus] = useState('')
  const [wide, toggleWide] = useWidescreen()
  const fullscreen = useFullscreen(() => cabinet.current)
  useViewShortcuts({ fullscreen: fullscreen.toggle, widescreen: toggleWide })
  useHelpShortcut(setKeysOpen)

  const slots = useRef(new Slots()).current
  const cabinet = useRef<HTMLElement>(null)
  const host = useRef<HostNet | null>(null)
  const session = useRef<ArcadeSession | null>(null)
  const keyboard = useRef<ReturnType<typeof createKeyboard> | null>(null)
  const knownPads = useRef(new Set<number>())
  const fileInput = useRef<HTMLInputElement>(null)
  const romKeyRef = useRef('')
  const savingRef = useRef(false)
  // Set by the Saves panel's forget button: no more auto-saves for this session, so the next launch is fresh.
  const autoPaused = useRef(false)

  const refresh = () => setTick((value) => value + 1)

  const refreshSaves = async (key: string) => setSaves(await saveTimes(key))

  /** Snapshot the running core into the auto slot. Never throws; callers fire and forget. */
  const autosave = useCallback(async () => {
    const active = session.current
    const key = romKeyRef.current
    if (!active || !key || savingRef.current || autoPaused.current) return
    savingRef.current = true
    try {
      const savedAt = await putSave(key, 'auto', await active.saveState())
      setSaves((current) => ({ ...current, auto: savedAt }))
    } catch (cause) {
      console.warn('[Cabinet:Saves] auto-save failed', cause)
    } finally {
      savingRef.current = false
    }
  }, [])

  // Auto-save while playing, and once more when the tab goes away.
  useEffect(() => {
    if (status !== 'running') return
    const timer = setInterval(() => void autosave(), 45_000)
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void autosave()
    }
    addEventListener('visibilitychange', onHidden)
    return () => {
      clearInterval(timer)
      removeEventListener('visibilitychange', onHidden)
    }
  }, [status, autosave])

  useEffect(() => {
    getBios().then((bios) => setBiosReady(Boolean(bios)))
    // One reader, one port: the host keyboard is player 1. Players 2-4 bring a gamepad or a phone.
    const keys = createKeyboard()
    keyboard.current = keys

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
      keys.dispose()
      keyboard.current = null
      host.current?.destroy()
      host.current = null
    }
  }, [slots])

  // Single frame loop: refresh local slot masks and push every port into the core.
  useEffect(() => {
    let frame = 0
    let frames = 0
    let sampled = performance.now()
    const step = (now: number) => {
      const active = session.current
      if (active) {
        slots.sources.forEach((source, port) => {
          if (source.kind === 'keyboard') slots.masks[port] = keyboard.current?.mask() ?? 0
          if (source.kind === 'pad') {
            const pad = navigator.getGamepads()[source.index]
            slots.masks[port] = pad ? padMask(pad) : 0
          }
          active.inject(port, slots.masks[port] ?? 0)
        })
        frames++
        if (now - sampled >= 2000) {
          setFps(Math.round((frames * 1000) / (now - sampled)))
          frames = 0
          sampled = now
        }
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [slots])

  // Gamepads: a new pad takes the lowest free port, a disconnected pad frees its own.
  useEffect(() => {
    const sync = () => {
      const live = pads()
      const indexes = new Set(live.map((pad) => pad.index))
      let changed = false
      slots.sources.forEach((source, port) => {
        if (source.kind !== 'pad' || indexes.has(source.index)) return
        slots.setSource(port, { kind: 'none' })
        knownPads.current.delete(source.index)
        changed = true
      })
      for (const pad of live) {
        if (knownPads.current.has(pad.index)) continue
        const port = slots.assign({ kind: 'pad', index: pad.index })
        if (port === -1) continue
        knownPads.current.add(pad.index)
        console.log(`[Cabinet:SlotMgr] Gamepad "${padLabel(pad)}" assigned to Port ${port + 1}`)
        changed = true
      }
      if (changed) refresh()
    }
    sync()
    // Chrome only exposes a pad after its first button press; polling catches pads that appear late.
    const timer = setInterval(sync, 1000)
    addEventListener('gamepadconnected', sync)
    addEventListener('gamepaddisconnected', sync)
    return () => {
      clearInterval(timer)
      removeEventListener('gamepadconnected', sync)
      removeEventListener('gamepaddisconnected', sync)
    }
  }, [slots])

  // Live input LEDs without re-rendering the whole tree every frame.
  useEffect(() => {
    const timer = setInterval(refresh, 120)
    return () => clearInterval(timer)
  }, [])

  // The emulator canvas stays at 384x288 CSS; scale it to fill the cabinet. Square pixels at 4:3,
  // stretched to a 16:9 box when widescreen is on, and never cropped in fullscreen.
  useEffect(() => {
    const element = cabinet.current
    if (!element) return
    const fit = () => {
      const w = element.clientWidth
      const h = element.clientHeight
      let targetW = w
      let targetH = h
      if (wide) {
        targetW = Math.min(w, (h * 16) / 9)
        targetH = (targetW * 9) / 16
      } else {
        const scale = Math.min(w / 384, h / 288)
        targetW = 384 * scale
        targetH = 288 * scale
      }
      element.style.setProperty('--cabinet-sx', String(targetW / 384))
      element.style.setProperty('--cabinet-sy', String(targetH / 288))
      element.style.setProperty('--cabinet-x', `${(w - targetW) / 2}px`)
      element.style.setProperty('--cabinet-y', `${(h - targetH) / 2}px`)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [wide])

  const startGame = async (file: File) => {
    setError('')
    setSaveStatus('')
    autoPaused.current = false
    setStatus('loading')
    try {
      session.current?.exit()
      session.current = null
      const bios = await getBios()
      const next = await launchArcade(file, bios)
      session.current = next
      romKeyRef.current = romKey(file)
      setRom(next.romName)
      setFps(0)
      setStatus('running')
      // Audio destinations attach slightly after the core boots. Publish once, after they do, so a guest
      // never gets a video-only call replaced by a second call (iOS Safari leaves that second one blank).
      const started = performance.now()
      const publish = () => {
        if (session.current !== next) return
        const stream = next.getStream()
        if (!stream.getAudioTracks().length && performance.now() - started < 3000) {
          setTimeout(publish, 120)
          return
        }
        host.current?.setStream(stream)
      }
      publish()

      void refreshSaves(romKey(file))
      // Drop the same ROM again and it resumes where the last session left off.
      try {
        const auto = await getSave(romKey(file), 'auto')
        if (auto) {
          await next.loadState(auto.state)
          setSaveStatus(`Resumed auto-save from ${ago(auto.savedAt)}`)
          console.log(`[Cabinet:Saves] Resumed auto-save for ${file.name} (${ago(auto.savedAt)})`)
        }
      } catch (cause) {
        console.warn('[Cabinet:Saves] auto-save could not be loaded', cause)
        setSaveStatus('Auto-save could not be loaded')
      }
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

  const stopGame = async () => {
    await autosave()
    session.current?.exit()
    // A fresh core needs a fresh page; the room code is reused on reload.
    location.reload()
  }

  const saveSlot = async (slot: Exclude<SaveSlot, 'auto'>) => {
    const active = session.current
    if (!active || !romKeyRef.current) return
    try {
      const savedAt = await putSave(romKeyRef.current, slot, await active.saveState())
      setSaves((current) => ({ ...current, [slot]: savedAt }))
      setSaveStatus(`Saved to slot ${slot}`)
    } catch (cause) {
      console.warn('[Cabinet:Saves] save failed', cause)
      setSaveStatus('Save failed')
    }
  }

  const clearAuto = async () => {
    if (!romKeyRef.current) return
    autoPaused.current = true
    try {
      await deleteSave(romKeyRef.current, 'auto')
      setSaves((current) => ({ ...current, auto: undefined }))
      setSaveStatus('Auto-save deleted; this session will not auto-save again')
      console.log('[Cabinet:Saves] Auto-save deleted; paused for this session')
    } catch (cause) {
      console.warn('[Cabinet:Saves] clear failed', cause)
    }
  }

  const loadSlot = async (slot: SaveSlot) => {
    const active = session.current
    if (!active || !romKeyRef.current) return
    try {
      const record = await getSave(romKeyRef.current, slot)
      if (!record) return
      await active.loadState(record.state)
      setSaveStatus(`Loaded ${slot === 'auto' ? 'auto-save' : `slot ${slot}`}`)
    } catch (cause) {
      console.warn('[Cabinet:Saves] load failed', cause)
      setSaveStatus('Load failed')
    }
  }

  const syncPeers = () => {
    for (const peer of peers) host.current?.setSlot(peer.id, slots.portOf(peer.id))
  }

  const assignInput = (source: Source) => {
    const port = slots.assign(source)
    if (port === -1) return
    if (source.kind === 'pad') knownPads.current.add(source.index)
    syncPeers()
    refresh()
  }

  const clearInput = (port: number) => {
    slots.setSource(port, { kind: 'none' })
    syncPeers()
    refresh()
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
        <nav className="menubar" aria-label="Cabinet controls">
          <button className="ghost" onClick={copyInvite} disabled={!code}>
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
          <button className="ghost" onClick={() => setQrOpen(true)} disabled={!code}>
            QR code
          </button>
          <button className="ghost" onClick={() => setKeysOpen(true)} title="Default keyboard keys (?)">
            Keys <kbd>?</kbd>
          </button>
          <span className="menu-sep" aria-hidden />
          <button
            className="ghost"
            aria-pressed={wide}
            onClick={toggleWide}
            title="Stretch the core's 4:3 picture to 16:9 (Shift+W)"
          >
            Widescreen <kbd>⇧W</kbd>
          </button>
          <button
            className="ghost"
            aria-pressed={fullscreen.active}
            onClick={fullscreen.toggle}
            title="Fullscreen (Shift+F)"
          >
            Fullscreen <kbd>⇧F</kbd>
          </button>
          {status === 'running' && (
            <button className="ghost stop" onClick={stopGame}>
              Stop
            </button>
          )}
        </nav>
      </header>

      <main className="host">
        <section
          ref={cabinet}
          className={wide ? 'cabinet wide' : 'cabinet'}
          onMouseDown={(event) => event.preventDefault()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            drop(event.dataTransfer.files)
          }}
        >
          <canvas id="cabinet-canvas" width={384} height={288} />
          {status === 'running' && <div className="marquee">{rom}</div>}

          {status === 'running' && fps > 0 && fps < 50 && (
            <div className="paused-note" role="status">
              <strong>Running at {fps} fps</strong>
              <span>
                The core advances one frame per animation frame, so when the browser cannot paint fast enough the game
                runs in slow motion instead of dropping frames, and guests get exactly what this tab renders. Keep this
                window in front and close heavy tabs to get back to 60.
              </span>
            </div>
          )}

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
                <p className="keys">
                  P1 keyboard: WASD to move · J K L U I O buttons · Space coin · Enter start · <kbd>?</kbd> for
                  the map. Players 2–4 join with a gamepad or a phone.
                </p>
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
          <SlotPanel slots={slots} peers={peers} tick={tick} onAssign={assignInput} onClear={clearInput} />

          <div className="panel">
            <h2>Invite</h2>
            <div className="invite">
              <code>{invite || 'starting signaling…'}</code>
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
              {status === 'running' && <span className="tag">{fps} fps</span>}
            </div>
            <p className="muted small">
              <kbd>⇧F</kbd> fullscreen · <kbd>⇧W</kbd> widescreen. Widescreen stretches the core's 4:3 picture;
              FBNeo has no 16:9 render mode.
            </p>
            {status === 'running' && fps > 0 && fps < 30 && (
              <p className="warn">
                Host is drawing {fps} fps. Keep this tab in front; browsers throttle a background tab.
              </p>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Saves</h2>
              <span className="count">this machine</span>
            </div>
            <ul className="saves">
              <li>
                <span className="grow">Auto</span>
                <span className="muted small">{saves.auto ? ago(saves.auto) : '—'}</span>
                <button
                  className="mini"
                  disabled={status !== 'running' || !saves.auto}
                  onClick={() => void loadSlot('auto')}
                >
                  Load
                </button>
                <button
                  className="mini"
                  disabled={!saves.auto}
                  onClick={() => void clearAuto()}
                  title="Forget the auto-save and stop auto-saving this session, so the next launch starts fresh"
                >
                  ×
                </button>
              </li>
              {(['1', '2', '3'] as const).map((slot) => (
                <li key={slot}>
                  <span className="grow">Slot {slot}</span>
                  <span className="muted small">{saves[slot] ? ago(saves[slot]) : 'empty'}</span>
                  <button className="mini" disabled={status !== 'running'} onClick={() => void saveSlot(slot)}>
                    Save
                  </button>
                  <button
                    className="mini"
                    disabled={status !== 'running' || !saves[slot]}
                    onClick={() => void loadSlot(slot)}
                  >
                    Load
                  </button>
                </li>
              ))}
            </ul>
            {saveStatus && (
              <p className="muted small" role="status">
                {saveStatus}
              </p>
            )}
            <p className="muted small">Auto-saves every 45s and when the tab hides. States stay on this machine.</p>
          </div>
        </aside>
      </main>
      {qrOpen && code && <QrDialog invite={invite} code={code} onClose={() => setQrOpen(false)} />}
      {keysOpen && <KeyHelp onClose={() => setKeysOpen(false)} />}
    </div>
  )
}
