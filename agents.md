# agents.md — CabinetCast working rules

Read this before touching code. Update `todo.md` and `history.md` when you finish a task.

## What this is
CabinetCast: the host runs one FBNeo arcade core in the browser and broadcasts its canvas + audio over
WebRTC to guests who join with a magic link. Guests only send a 2-byte input mask back. Web MVP,
hosted on GitHub Pages. Tauri packaging is deferred.

## Principles
1. **YAGNI.** No state library, no UI kit, no zip library, no `lodash`. Native APIs first.
2. **One-line solutions.** If a helper passes ~15 lines, check whether a browser API already does it.
3. **Fewest files.** `src/core` (emulator, input, slots, bios), `src/net` (host, guest), `src/components`.
4. **Full files only.** Never leave `// ...rest unchanged` placeholders in code you hand over.
5. **Push back.** Flag anything that hurts latency, frame budget, or bandwidth before building it.

## Non-obvious constraints (learned the hard way)
- **Nostalgist renames bare `File`/`Blob` ROMs to `data1.zip`** and FBNeo identifies the romset from that
  filename, so a bare File silently boots into "Romset is unknown". Always pass
  `rom: { fileName: file.name, fileContent: file }`. Same for the BIOS (`neogeo.zip`).
- **RetroArch rewrites the canvas `id` to `canvas`** and sets inline width/height. Style it as
  `.cabinet canvas` and keep the CSS size at 384x288: RetroArch sizes its rendering buffer from CSS size,
  so a large CSS canvas means a large, expensive video stream. We scale with `transform` instead.
- **Per-port input is a keyboard-offset trick, and only player 1 has a keyboard.** Nostalgist's `pressDown`
  fires a synthetic keyboard event for the key bound to `input_playerN_<button>` in `retroarch.cfg`. That
  means:
  - every port needs its own unique key per action (see `PORT_KEYS` in `src/core/protocol.ts`) even though
    rows 1–3 are never read from a physical keyboard: they exist only so injected input (a phone guest, a
    gamepad) has a distinct code to fire. Removing them breaks players 2–4 completely,
  - `P1_KEYS` is the only readable layout and `KEY_BITS` is derived from it alone. `createKeyboard()` takes
    no port: the host keyboard is player 1, full stop. Players 2–4 bring a gamepad or a phone,
  - `Slots.setSource` clamps a keyboard to port 0 and `Slots.assign` refuses it when P1 is taken, so a
    keyboard can never land on a port whose keys do not exist. `SlotPanel` disables its Assign button for
    the same reason and does not offer a keyboard in `+ Add player input`,
  - the `?` dialog shows the single P1 map and says players 2–4 need their own device,
  - the canvas is blurred at launch and a `focus` handler blurs it again, so a click cannot hand native
    keys to the core (which would drive the 2–4 bindings that only exist for injection),
  - plain keys are `preventDefault`ed, but Ctrl/Cmd/Alt + key is left alone so Ctrl+W still closes the tab,
  - RetroArch only ships keyboard binds for players 1–4, so **MPV is 4 ports**, extra peers spectate,
  - hotkeys are set to `nul` so a synthetic player key cannot open a menu or quit the game,
  - the canvas is blurred at launch so physical keys never reach the core natively; all input is injected.
- **Audio cannot be captured from an API**, so `audioTap.ts` patches `AudioNode.connect` and mirrors
  anything wired to an `AudioContext.destination` into a `MediaStreamAudioDestinationNode`.
- **A romset the core rejects is not an app error.** FBNeo paints its own white "Romset is unknown"
  screen, but `launchArcade` already resolved once the core booted, so the UI reports `running` and guests
  see that screen. `teetert.zip` is exactly this: FBNeo ships no teetert driver.
- **PeerJS `reliable: false`** = unordered, zero retransmits. That is what we want for input.
- **QR encoding uses `qrcode`** (`toDataURL` → 640px PNG). It is the one dependency that exists purely to
  avoid hand-writing an encoder; do not replace it with a canvas hack or a hosted QR API (the invite link
  would leak, and offline use is the point).
- **Input sources all speak one 12-bit mask.** Keyboard readers, `padMask()`, and `TouchControls` produce
  the same bits and `HostView`/`GuestView` OR them per frame. Add a button to all three together, or the
  mapping drifts. Gamepads assume the `standard` mapping; a non-standard pad still reports a label but its
  buttons land where the browser puts them.
- **Pads are polled, not event-driven.** Chrome hides a pad until its first button press, so `HostView`
  polls `navigator.getGamepads()` every second and reconciles both directions: unknown pad → lowest free
  port, missing pad → free its port. Slots remain the single owner of port placement.
- **Input sources are reported, not guessed.** Each guest sends `{t:'source', kind}` over the same unreliable
  channel when its mode changes; `HostNet` keeps the latest per peer. Sticks are still gamepads to the API,
  so `padKind()` can only guess from the id (`arcade|fightstick|hori|qanba|mayflash`). New input types need a
  value on `InputKind`, an icon in `InputIcon`, and a mapping in `SlotPanel`/`GuestView`.
- **Touch controls are sized for thumbs, not for a screenshot.** A/B/C/D sit in an arcade diamond (the
  2x2 grid is rotated 45° and each label is rotated back), 56px face buttons and a 146px d-pad in portrait,
  60/158px in landscape. Microsoft's touch-layout guidance is the reference:
  movement under the left thumb, actions under the right, only two simultaneous thumbs, occasional buttons
  (Coin/Start) out of the primary ring. Portrait keeps the feed in the top half of the screen with the controls
  below it; landscape turns the whole viewport into the cabinet and floats the controls over the side bars.
  Keep buttons translucent and respect `env(safe-area-inset-*)`.
- **Save states are host-only and live in IndexedDB** (`src/core/saves.ts`, `cabinet_saves`), keyed by
  `name#size`. Nostalgist exposes `saveState()` / `loadState()`; a state is a Blob, a few KB for FBNeo. The
  auto slot is written every 45s, on `visibilitychange` hidden, and before Stop; it is loaded right after a
  re-drop. Clearing the auto slot is the only way to start that ROM fresh.
- **Stream fps is one constant.** `STREAM_FPS` in protocol feeds both `captureStream()` and the sender's
  `maxFramerate`. Input is still injected every host rAF, so lowering it does not add input latency; it
  trades video smoothness for encode/decode and bitrate. Do not claim it makes input faster.
- **Codec policy lives in `videoSdp(sdp, pin)`** (`src/net/sdp.ts`), never in a raw `peer.call(id, stream)`.
  VP9/AV1/HEVC and their rtx are always dropped: iOS Safari advertises them and then paints a white
  rectangle while audio and input keep working. `auto` keeps H.264 and VP8, with H.264 first, because the
  offer's payload order is what the encoder follows when the answer accepts several codecs. `vp8` and
  `h264` keep exactly one codec each — with both in the list, Chrome answers with VP8 no matter what order
  the H.264 payloads are in, so a codec switch is impossible without stripping the offer. RTX survives as
  long as the codec it retransmits does. One call must carry audio and video together: a video-only call
  followed by a video+audio call renegotiates the same m-line and some Safari versions never paint after it.
- **The first offer follows the guest, not the host.** On `conn.open` the guest sends `{t:'hello', platform}`
  and `HostNet` waits 150 ms for it, then offers `auto` (H.264 first) to Apple and `vp8` to everything else.
  This is the fix for an Android phone that heard audio and drove its port but painted a white rectangle:
  Chromium decodes VP8 on every device, H.264 hardware decoders are the fussy path. Retries override the
  hello choice; a retry the guest asked for is authoritative on the guest side too (`requested` in
  `GuestNet`), so a dropped or late `{t:'codec'}` confirmation cannot loop it back onto the failed codec.
- **A guest with sound and no picture asks for the other codec.** `GuestNet` samples `getStats()` every
  second and sends `{t:'health'}` with the negotiated codec, resolution, fps, `framesDecoded`, audio bytes
  received and the `<video>` element's state. `GuestView` shows a `No picture / Try VP8` chip after two
  frame-less samples, and after 5 s with audio but zero frames it automatically asks for the next codec in
  the ladder (`vp8` → `h264` → `auto`, or `h264` → `vp8` → `auto` on Apple). The host re-offers the call
  pinned to that codec. The host's Players panel shows the pair `↑n ↓n` — encoded fps and the guest's own
  decoded fps. `↑0` is a sender problem, `↑n ↓0` is the guest's decoder, `↑n ↓n` with a blank screen is
  compositing/rendering on the guest. Ask for that pair before theorising about codecs.
- **The stream is captured from a relay canvas, not the core's canvas.** RetroArch sizes its drawing buffer
  from the canvas' on-screen rect, and the cabinet scales that canvas with a transform, so the captured
  track came out 402x302 on a 1280px window — a size that changes with the host's layout and is not
  macroblock-aligned. `launchArcade` draws the core canvas into a fixed 384x288 relay every rAF and captures
  the relay (30 fps), so every host sends the same aligned size. The relay draw is registered after
  RetroArch's own rAF, which is what makes the WebGL readback current; do not move it into a timer.
- **No compositing effects on the guest video.** `image-rendering: pixelated` on `.stage video` and
  `backdrop-filter` on the touch controls are both gone: Android Chrome can fail to composite a WebRTC
  frame under either and leaves a white rectangle where the picture should be. The controls are opaque
  enough to read without the blur. Keep the video element free of filters and transforms, and keep the
  debug chip (`?debug`) as the on-device readout, because a phone has no console you can read.
- **An `m=` line has exactly two fixed tokens.** `m=video <port> <proto> <payloads…>`; `UDP/TLS/RTP/SAVPF`
  is one token, so `^m=video (\S+ \S+)` captures the header and the rest is payloads. Matching a third
  `\S+` swallows the first payload, which silently defeats any payload reordering while the rebuilt line
  still looks valid. If SDP handling changes, check the m-line against a real `createOffer()` — the host log
  now prints the negotiated codec per guest (`Guest ab12 video codec: video/H264`).
- **Handheld guest mode is a size decision, not a touch decision.** `compact` is a coarse pointer, or width
  < 640, or height < 500; `handheld` is `live && compact` and hides the header, footer and stage frame so the
  feed fills the viewport with the controls floating over it. Gating it on the touch flag left phones with
  desktop-mode pointers stuck in the full UI. Do not add chrome back inside `.handheld`; the only overlays
  allowed are the sound prompt and the touch pad.
- **View shortcuts must not collide with player keys.** `Shift+F` / `Shift+W` live in `src/core/view.ts` and
  run in the capture phase with `stopImmediatePropagation`, because `W` is player 1's up key. Never add
  a plain-letter UI shortcut: all free letters are one gamepad remap away from being a player key.
- **Widescreen is a stretch, not a render mode.** FBNeo draws native 4:3; RetroArch's aspect settings scale
  the frontend output. `.cabinet.wide` / `.stage.wide` stretch the picture to 16:9, and the canvas fit in
  `HostView` must keep `--cabinet-sx/sy` exact or black bars appear. Never claim 16:9 rendering.
- **Fullscreen targets an element** (`.cabinet` on the host, `.stage` on the guest), not the page, so the
  UI disappears and the canvas fit has to handle a viewport-shaped box (contain in 4:3, 16:9 box when wide).
  iOS needs the video-element fallback in `useFullscreen`.
- The preview panel only leaves one tab unthrottled. A host tab in the background drops to 3–25 rAF/s
  while `document.visibilityState` still says `visible`, so measure fps with rAF, not visibility. Guest
  decode figures are only meaningful while the host tab is the active preview; otherwise the host tab,
  not the network, is the cap. The host UI's fps tag exposes this.

## Testing
- `npm run typecheck` and `npm run build` must pass before a commit.
- Legally free FBNeo romsets for smoke tests live in the gitignored `testroms/` folder, served in dev only
  by the `testRoms` middleware in `vite.config.ts` (`/testroms/robby.zip`) — never from `public/`, so a
  production build cannot ship them: `gridlee.zip`, `robby.zip`, `teetert.zip`, `tmnt2.zip`,
  `xmen6pu.zip`, `mslug6.zip` from mamedev.org. `robby`, `gridlee`, `tmnt2` and `xmen6pu` boot and play.
  `teetert` and `mslug6` do not: FBNeo has no driver for either, so they paint the core's white "Romset
  is unknown" screen (see below).
- To load a ROM headlessly, fetch `/testroms/robby.zip` in the page, wrap it in a `File` and dispatch a
  `drag`+`drop` with a `DataTransfer` on `.cabinet`. The drop is not a user gesture, so Chrome will not
  start the emulator's AudioContext during such a run: silence there proves nothing about audio.
- Cross-browser guest test: open `/?room=CODE` in a second tab. Expect `[Cabinet:NetGuest] Connected`,
  `Received host stream (audio+video)`, and a live `<video>`.
- No physical gamepad? Stub it: replace `navigator.getGamepads` with `() => [fakePad]` where `fakePad` is a
  plain object with `index`, `id`, `mapping: 'standard'`, `axes`, and 17 `{ pressed, value }` buttons, then
  wait for the 1s poll. Mutating `pressed`/`axes` exercises the frame loop; returning `null` tests
  disconnect. This does not exercise real driver quirks.
- Fullscreen cannot be entered in the preview browser (the request hangs); stub `Element.prototype.requestFullscreen`
  and `document.exitFullscreen` and drive `fullscreenchange` to test the wiring. That is not proof of native
  fullscreen — check it in a normal Chrome tab.
- Save states: save, change the screen, load, and compare browser screenshots (canvas readback is black).
  IndexedDB `cabinet_saves` lists the blobs and their timestamps. Auto-resume is visible as a status line in
  the Saves panel after re-dropping the same ROM.
- Touch overlay: it needs a live stream. Portrait 390x844 and landscape 844x390 both switch to `.handheld`
  (width < 640, height < 500), so the preview browser can show it without device emulation; the host tab
  stays the video source. Synthetic `PointerEvent`s (`pointerdown`/`pointerup`
  with `pointerType: 'touch'`) drive the same handlers; pointer capture throws for a fake `pointerId` and is
  already caught.

## Logging
Prefix everything so pasted logs are greppable: `[Cabinet:Core]`, `[Cabinet:Storage]`, `[Cabinet:SlotMgr]`,
`[Cabinet:NetHost]`, `[Cabinet:NetGuest]`, `[Cabinet:Input]`.

## Design system
Dark cabinet UI: `--bg #08080d`, panels `#12121b`, amber `#ffb02e` for primary/room code, teal for peers,
monospace uppercase micro-labels, 12px radii. Keep controls in the right rail; the cabinet stays 4:3.
