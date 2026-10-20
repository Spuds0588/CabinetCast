import { toDataURL } from 'qrcode'
import { useEffect, useRef, useState } from 'react'

interface Props {
  invite: string
  code: string
  /** What the scan does; the invite QR joins, the roster QR is controller only. */
  title?: string
  note?: string
  onClose: () => void
}

export function QrDialog({ invite, code, title = 'Scan to join', note, onClose }: Props) {
  const [png, setPng] = useState('')
  const [status, setStatus] = useState('')
  const statusTimer = useRef<number | undefined>(undefined)

  const flash = (message: string) => {
    clearTimeout(statusTimer.current)
    setStatus(message)
    statusTimer.current = window.setTimeout(() => setStatus(''), 4000)
  }

  useEffect(() => () => clearTimeout(statusTimer.current), [])

  useEffect(() => {
    let cancelled = false
    toDataURL(invite, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#08080d', light: '#ffffff' },
    })
      .then((url) => !cancelled && setPng(url))
      .catch(() => !cancelled && setStatus('Could not generate the QR code.'))
    return () => {
      cancelled = true
    }
  }, [invite])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const copy = async () => {
    try {
      if (typeof ClipboardItem === 'undefined') throw new Error('image clipboard is unavailable')
      const blob = await (await fetch(png)).blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      flash('QR image copied')
    } catch {
      try {
        await navigator.clipboard.writeText(invite)
        flash('Image copy was blocked; the invite link was copied instead.')
      } catch {
        flash('Copy was blocked by the browser.')
      }
    }
  }

  const download = () => {
    const anchor = document.createElement('a')
    anchor.href = png
    anchor.download = `invite-${code || 'arcade'}.png`
    anchor.click()
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="qr-card" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Close QR code">
            ×
          </button>
        </div>
        {png ? (
          <img src={png} alt={`QR code for ${invite}`} width={320} height={320} />
        ) : (
          <p className="muted">Generating QR code…</p>
        )}
        <code className="qr-url">{invite}</code>
        {note && <p className="muted small qr-note">{note}</p>}
        <div className="row">
          <button className="primary" onClick={copy} disabled={!png}>
            Copy image
          </button>
          <button className="ghost" onClick={download} disabled={!png}>
            Download PNG
          </button>
        </div>
        {status && (
          <p className="muted small" role="status">
            {status}
          </p>
        )}
      </div>
    </div>
  )
}
