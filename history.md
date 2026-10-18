# history.md — decision log

Newest first. Read this before re-deciding something; it records what was tried and rejected.

## 2026-10-18 — Web MVP built and shipped to GitHub Pages

**Shipped:** host/guest split, FBNeo in-browser, PeerJS multiplayer, 4 ports, BIOS storage, invite links.

**Decisions**
- **Plain CSS instead of Tailwind** (PRD asked for Tailwind). The UI is one screen and ~250 lines of CSS;
  Tailwind would add a Vite plugin and config for no gain. Revisit only if the component count explodes.
- **`nostalgist` + `peerjs` + React only.** No zip library (FBNeo opens the archive itself), no state
  manager, no router (one `URLSearchParams` check in `App.tsx`).
- **No React StrictMode.** It double-mounts effects, which opened two PeerJS rooms and two emulator
  instances in dev.
- **Magic links carry `?room=CODE`.** Peer id is `cab-<code>`; the code is 5 chars from an unambiguous
  alphabet and is persisted in `sessionStorage` so reloads keep old invites valid.
- **Media over WebRTC tracks, not JPEG/PCM over data channels** (which is what the sister projects do).
  Canvas `captureStream` + a patched `AudioNode.connect` gives one `MediaStream` for `peer.call`.

**Bugs found and fixed**
1. `rom: file` → Nostalgist renames it `data1.zip` → FBNeo says "Romset is unknown" and shows a white error
   screen. Fixed by passing `{ fileName, fileContent }`. This was the single biggest time sink; three
   different freeware sets failed identically before the FS listing exposed `content/data1.zip`.
2. RetroArch overwrites the canvas `id` and inline size, so `#cabinet-canvas` styles stopped applying after
   boot. Now styled as `.cabinet canvas`, fixed at 384x288 CSS, scaled with a `--cabinet-scale` transform.
   This also keeps the captured stream near native arcade resolution instead of ~1 MP per frame.
3. RetroArch's audio is invisible to the page; patched `AudioNode.prototype.connect` to mirror into a
   `MediaStreamAudioDestinationNode` (one per AudioContext).
4. Per-port input needs unique keyboard binds per port; the bindings must be written into
   `retroarchConfig` because Nostalgist's `pressDown` reads the config file for `input_playerN_*`.
   Hotkeys are neutralised so synthetic keys cannot trigger the RetroArch menu.

**Verification performed**
- `tsc --noEmit` + `vite build` clean.
- FBNeo boots `robby.zip` (`Driver robby was successfully started`) and renders; canvas stream 300x225–402x302.
- Guest tab: `Connected`, `Received host stream (audio+video)`, video 100% non-black, frames changing, RTT
  reported. Host roster shows the guest, auto-assigned to P2, and P2's activity LED lights when the guest
  holds a key — the data channel, slot mapping, and injection call all run.
- Not verified: that FBNeo itself reacts to the injected keys. The preview browser composites at ~2 fps and
  refuses screenshots while the emulator runs, so a real romset test on a normal machine is the next step.

**Rejected**
- `canvas.toDataURL()` / `drawImage(webglCanvas)` for verification: the GL buffer is cleared after
  compositing, always returns black. Used a guest-side `<video>` → 2D canvas instead.
- Sending JPEG frames + PCM over the data channel (sister projects' approach): more code, worse latency,
  no hardware video encoder.
- `size: 'auto'` for the canvas: makes RetroArch render at CSS x DPR (~0.5 MP) and inflates the stream.
