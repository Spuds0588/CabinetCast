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
  - RetroArch only ships keyboard binds for players 1–4, so **MPV is 4 ports**, extra peers spectate,
  - hotkeys are set to `nul` so a synthetic player key cannot open a menu or quit the game,
  - the canvas is blurred at launch so physical keys never reach the core natively; all input is injected.
- **Audio cannot be captured from an API**, so `audioTap.ts` patches `AudioNode.connect` and mirrors
  anything wired to an `AudioContext.destination` into a `MediaStreamAudioDestinationNode`.
- **PeerJS `reliable: false`** = unordered, zero retransmits. That is what we want for input.
- The dev/preview environment here composites at ~2 fps and `preview_screenshot` fails while the emulator
  runs. Trust `?debug=1` console logs and guest-side pixel readback, not local rAF timings.

## Testing
- `npm run typecheck` and `npm run build` must pass before a commit.
- Legally free FBNeo romsets for smoke tests live in `public/testroms/` (gitignored): `gridlee.zip`,
  `robby.zip`, `teetert.zip` from mamedev.org. `gridlee` is in the FBNeo DAT but this core build reports
  "Romset is unknown" for it, so use `robby.zip` (known good).
- Cross-browser guest test: open `/?room=CODE` in a second tab. Expect `[Cabinet:NetGuest] Connected`,
  `Received host stream (audio+video)`, and a live `<video>`.

## Logging
Prefix everything so pasted logs are greppable: `[Cabinet:Core]`, `[Cabinet:Storage]`, `[Cabinet:SlotMgr]`,
`[Cabinet:NetHost]`, `[Cabinet:NetGuest]`, `[Cabinet:Input]`.

## Design system
Dark cabinet UI: `--bg #08080d`, panels `#12121b`, amber `#ffb02e` for primary/room code, teal for peers,
monospace uppercase micro-labels, 12px radii. Keep controls in the right rail; the cabinet stays 4:3.
