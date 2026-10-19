import { useCallback, useEffect, useRef, useState } from 'react'

const WIDE_KEY = 'cabinetcast:widescreen'

/**
 * FBNeo renders the arcade's native 4:3 picture and has no widescreen mode (RetroArch's aspect ratio
 * options are frontend scaling, not extra pixels), so this stretches the displayed frame to 16:9.
 * The captured stream stays 4:3 either way; only the viewer's screen changes.
 */
export function useWidescreen(): [boolean, () => void] {
  const [wide, setWide] = useState(() => localStorage.getItem(WIDE_KEY) === '1')

  useEffect(() => {
    localStorage.setItem(WIDE_KEY, wide ? '1' : '0')
  }, [wide])

  // Host and guest tabs on one machine share the preference; keep them from disagreeing.
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === WIDE_KEY && event.newValue) setWide(event.newValue === '1')
    }
    addEventListener('storage', sync)
    return () => removeEventListener('storage', sync)
  }, [])

  return [wide, () => setWide((value) => !value)]
}

const requestFullscreen = async (element: HTMLElement) => {
  if (element.requestFullscreen) return element.requestFullscreen()
  // iPhone Safari has no element fullscreen; a video can still go fullscreen natively.
  const video = element.querySelector('video') as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
  video?.webkitEnterFullscreen?.()
}

/** Fullscreen for one element (the cabinet or the guest stage), with a webkit video fallback. */
export function useFullscreen(getTarget: () => HTMLElement | null) {
  const [active, setActive] = useState(false)
  const target = useRef(getTarget)
  target.current = getTarget

  useEffect(() => {
    const sync = () => setActive(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        const webkit = document as Document & { webkitExitFullscreen?: () => Promise<void> | void }
        if (document.exitFullscreen) await document.exitFullscreen()
        else await webkit.webkitExitFullscreen?.()
      } else {
        await requestFullscreen(target.current() ?? document.documentElement)
      }
    } catch (error) {
      console.warn('[Cabinet:View] fullscreen refused', error)
    }
  }, [])

  return { active, toggle }
}

/**
 * Shift+F fullscreen, Shift+W widescreen. Both are captured before the per-port keyboard readers
 * (which listen on window in the bubble phase), because plain F is Port 2's right arrow.
 */
export function useViewShortcuts(actions: { fullscreen: () => void; widescreen: () => void }) {
  const latest = useRef(actions)
  latest.current = actions

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.code !== 'KeyF' && event.code !== 'KeyW') return
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.code === 'KeyF') latest.current.fullscreen()
      else latest.current.widescreen()
    }
    addEventListener('keydown', onKey, true)
    return () => removeEventListener('keydown', onKey, true)
  }, [])
}
