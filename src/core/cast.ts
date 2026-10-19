/**
 * Chromecast support is best effort. Chrome desktop exposes the Presentation API, which hands a URL
 * to a receiver device; when that is missing (Firefox, Safari, the embedded preview browser) the same
 * URL opens in a popup window that can be dragged to a TV or sent with the browser's own Cast menu.
 * Either way the receiver is just another guest: it joins the room and paints the frames it is sent.
 */

type PresentationRequestCtor = new (url: string | string[]) => { start: () => Promise<unknown> }

const presentationApi = () =>
  (navigator as unknown as { presentation?: { PresentationRequest?: PresentationRequestCtor } }).presentation

export const canCast = () => Boolean(presentationApi()?.PresentationRequest)

/** 'cast' when a receiver took the page, 'window' for the popup, 'blocked' if the browser refused it. */
export async function startCast(url: string): Promise<'cast' | 'window' | 'blocked'> {
  const Request = presentationApi()?.PresentationRequest
  if (Request) {
    try {
      await new Request(url).start()
      return 'cast'
    } catch {
      /* picker dismissed or no receiver answered; fall through to the popup */
    }
  }
  const opened = window.open(url, 'cabinetcast-cast', 'popup,width=960,height=720')
  return opened ? 'window' : 'blocked'
}
