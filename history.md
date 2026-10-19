# history.md — decision log

Newest first. Read this before re-deciding something; it records what was tried and rejected.

## 2026-10-18 — Audit, per-port keyboard fix, docs corrected

**Defect fixed:** every "Local keyboard" slot replayed P1's input. `createKeyboard()` accumulated
`KEY_TO_BITS`, a P1-only table, and `HostView` copied that one mask into whichever port said
`kind: 'keyboard'` — so a second keyboard slot mirrored P1 while `PORT_KEYS[1..3]` sat unread.
`PORT_KEYS` is now written in DOM `KeyboardEvent.code` vocabulary and is the single contract: the core's
binds (`PORT_KEY_CONFIG`, through a small `retroName()` translation) and the readers' key tables
(`KEY_BITS`) are both derived from it, and `createKeyboard(port)` reads only its own port's keys.

**Decision:** the WASD / shift / `1` / `5` P1 aliases are gone. WASD cannot coexist with the contract —
`KeyD` is P2's *down*, so keeping it as P1 *right* meant one keypress driving two ports. All 48
`retroarch.cfg` bind strings were diffed against the previous output and are unchanged.

**Verified through the UI (dev build, `robby.zip`, guest on P2):** holding `KeyE` or `KeyD` lights only
P2; `ArrowUp`, `KeyA` and `Space` light only P1; unbound keys (`KeyW`, `KeyR`) light nothing; a guest's
held `ArrowLeft` still lights only P2. Frame evidence for the injection itself: P1 coin+start changed
77.8% of the guest frame (attract → play), guest P2 coin×2+start changed 49.8% against a 1.1% idle
control. `tsc --noEmit` and `vite build` clean.

**Deployment audited:** https://spuds0588.github.io/CabinetCast/ serves (HTML + 383 KB JS + CSS, 200s),
the host UI opens a PeerJS room on the live origin, and a live guest link for a nonexistent room lands on
"Room not found". Workflow "Deploy to GitHub Pages" run `39137299796` succeeded in 47s (2026-10-18T14:45Z).

**Still open (do not claim otherwise):** the deployed page has never been given a ROM; no guest audio has
ever been heard (`AudioContext` cannot start without a user gesture, and the scripted drop is not one);
cross-network play is untested and STUN-only; ports 3–4 never had a peer; `bitNames`, `PeerSlot` and the
RTT ping/stat messages are dead weight.

**Docs corrected** in the same pass: `agents.md` pointed at `public/testroms/`; the test ROMs live in the
gitignored `testroms/` folder served by a dev-only Vite middleware.

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
- Not verified *at the time*: that FBNeo reacts to the injected keys. Resolved the same day — see the
  audit entry above (P1 77.8%, P2 49.8% vs 1.1% idle).

**Rejected**
- `canvas.toDataURL()` / `drawImage(webglCanvas)` for verification: the GL buffer is cleared after
  compositing, always returns black. Used a guest-side `<video>` → 2D canvas instead.
- Sending JPEG frames + PCM over the data channel (sister projects' approach): more code, worse latency,
  no hardware video encoder.
- `size: 'auto'` for the canvas: makes RetroArch render at CSS x DPR (~0.5 MP) and inflates the stream.
