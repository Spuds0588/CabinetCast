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
- **Per-port input is a keyboard-offset trick.** Nostalgist's `pressDown` fires a synthetic keyboard event
  for the key bound to `input_playerN_<button>` in `retroarch.cfg`. That means:
  - every port needs its own unique key per action (see `PORT_KEYS` in `src/core/protocol.ts`),
  - `PORT_KEYS` is the single contract: `PORT_KEY_CONFIG` (the core's binds) and `KEY_BITS` (the readers'
    key tables) are both derived from it. `createKeyboard(port)` reads only that port's keys, so a
    "Local keyboard" slot can never replay another port's input. No alias keys: WASD collides with
    P2's KeyD, which is why they are gone,
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
- **Touch controls are sized for thumbs, not for a screenshot.** 70px face buttons and a 168px d-pad with
  12–14px gaps in portrait; 68/158px in landscape. Microsoft's touch-layout guidance is the reference:
  movement under the left thumb, actions under the right, only two simultaneous thumbs, occasional buttons
  (Coin/Start) out of the primary ring. The sideways layout is a fixed overlay over a letterboxed 4:3 feed;
  keep buttons translucent and respect `env(safe-area-inset-*)`.
- **Save states are host-only and live in IndexedDB** (`src/core/saves.ts`, `cabinet_saves`), keyed by
  `name#size`. Nostalgist exposes `saveState()` / `loadState()`; a state is a Blob, a few KB for FBNeo. The
  auto slot is written every 45s, on `visibilitychange` hidden, and before Stop; it is loaded right after a
  re-drop. Clearing the auto slot is the only way to start that ROM fresh.
- **Stream fps is one constant.** `STREAM_FPS` in protocol feeds both `captureStream()` and the sender's
  `maxFramerate`. Input is still injected every host rAF, so lowering it does not add input latency; it
  trades video smoothness for encode/decode and bitrate. Do not claim it makes input faster.
- **View shortcuts must not collide with player keys.** `Shift+F` / `Shift+W` live in `src/core/view.ts` and
  run in the capture phase with `stopImmediatePropagation`, because plain `F` is P2's right arrow. Never add
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
- Touch overlay: it needs a live stream and controls switched on (desktop pointers default them off). The
  landscape rule is `orientation: landscape` plus `max-height: 600px`, so resizing the preview to 844x390
  shows the overlay; the host tab stays the video source. Synthetic `PointerEvent`s (`pointerdown`/`pointerup`
  with `pointerType: 'touch'`) drive the same handlers; pointer capture throws for a fake `pointerId` and is
  already caught.

## Logging
Prefix everything so pasted logs are greppable: `[Cabinet:Core]`, `[Cabinet:Storage]`, `[Cabinet:SlotMgr]`,
`[Cabinet:NetHost]`, `[Cabinet:NetGuest]`, `[Cabinet:Input]`.

## Design system
Dark cabinet UI: `--bg #08080d`, panels `#12121b`, amber `#ffb02e` for primary/room code, teal for peers,
monospace uppercase micro-labels, 12px radii. Keep controls in the right rail; the cabinet stays 4:3.
