# todo.md

## Done (MVP)
- [x] Controller-only guest (`?mode=pad`): pad and nothing else, no video or sound requested, and the host
      keeps no frame pump for it; Invite offers Watch + play or Controller only and the QR follows (2026-10-19)
- [x] Pad layout: always horizontal (portrait rotates the stage), buttons 104/92/82/72 px for 2/3/4/5–6,
      one row for 2–3, offset two rows for 4–6, coin and start bottom centre (2026-10-19)
- [x] Cast button opens a two-step guide for Chrome's tab mirroring (Cast tab, then fullscreen), because a
      page cannot start a tab cast and a receiver page cannot run on a Chromecast. The first receiver-page
      attempt was removed (2026-10-19)
- [x] Vite + React + TypeScript + plain CSS (no Tailwind: zero extra deps), base `/CabinetCast/`
- [x] FBNeo via Nostalgist, drag/drop `.zip`, launch timeout, real romset filename fix
- [x] Canvas video + AudioContext tap → single `MediaStream`
- [x] PeerJS host: room code, magic link, 4 ports, guest roster, auto slot assignment
- [x] PeerJS guest: join by link, autoplay video, "tap for sound", 2-byte input frames
- [x] Slot manager: detected-inputs list (keyboard/gamepad/guest, in port order) with Remove, plus an
      `+ Add player input` menu; the four `<select>` dropdowns are gone (2026-10-19)
- [x] Invite QR: modal with 640px PNG, copy-image (link fallback) and download (2026-10-19)
- [x] Touch controls for mobile guests: d-pad + A/B/C/D + Coin/Start, auto-on for coarse pointers
      (2026-10-19)
- [x] Gamepad API auto-detect: new pads take the lowest free port, disconnect frees it, labels trimmed
      to the device name (2026-10-19)
- [x] Top menu bar for invite/QR/widescreen/fullscreen/stop, with `Shift+F` and `Shift+W` shortcuts for both
      host and guest (2026-10-19)
- [x] Widescreen toggle: 16:9 display stretch of the core's 4:3 picture, persisted and synced across tabs;
      document that FBNeo has no true widescreen render mode (2026-10-19)
- [x] Input icons in slot rows, detected list and guest tag: keyboard, gamepad, arcade stick, phone/touch;
      guests report their source over the data channel (2026-10-19)
- [x] Thumb-sized touch controls: 168px d-pad / 70px buttons portrait, translucent landscape overlay with
      safe-area insets, header/footer hidden (2026-10-19)
- [x] Host-only save states: auto slot every 45s + on hide + on Stop, three manual slots, auto-resume on
      re-drop, Saves panel with timestamps (2026-10-19)
- [x] Stream capped at 30 fps (`captureStream(30)` + sender `maxFramerate`), cutting encode/decode and
      bitrate while input stays per host frame (2026-10-19)
- [x] Keyboard + Gamepad API input, per-port synthetic key injection
- [x] Per-port local keyboard: each port's reader derives from `PORT_KEYS`, so a keyboard slot cannot
      replay another port's input (verified 2026-10-18)
- [x] neogeo.zip stored in IndexedDB and auto-attached
- [x] GitHub Pages workflow → live at https://spuds0588.github.io/CabinetCast/
      (bundle `index-_piwFEK8.js`, commit `7594054`, run `39183112725` success)
- [x] Injection into the core verified against real emulated output: P1 coin+start changed 77.8% of the
      guest frame (attract → play); guest P2 coin×2+start changed 49.8% against a 1.1% idle control
- [x] Pruned dead code (`bitNames`, `PeerSlot` + `Slots.peers`, `Slots.label`) and the RTT ping/stat
      machinery with its badge; no unused exports or CSS left in `src/`
- [x] Test romsets on the dev build: `robby` and `gridlee` boot and play; soaks of 2 and 5 minutes kept the
      guest feed live (0 dropped video events, 2–4% dropped frames, heap flat). `teetert` is not in FBNeo
      and boots to the core's white "Romset is unknown" screen (2026-10-19)
- [x] Ports 3 and 4 got real peers in a three-guest tab test, each holding only its own port's input; a
      fourth guest joined as a spectator with video (2026-10-19)
- [x] Three more romsets: `tmnt2` and `xmen6pu` boot at 60 fps and `tmnt2` accepted a P1 coin; `mslug6` is
      Atomiswave and not in FBNeo, so it paints "Romset is unknown" (2026-10-19)
- [x] Host fps meter with a warning below 30 fps; captured video marked `contentHint = 'motion'` and the
      sender set to `maintain-framerate` so load costs sharpness, not frames (2026-10-19)
- [x] Safari-safe video offer: `safariSafeSdp` strips VP9/AV1/HEVC and their rtx payloads, puts every H.264
      payload ahead of VP8, and runs as the `sdpTransform`; one offer carries audio and video. Verified against
      a real Chrome offer: transformed m-line negotiates `video/H264` and frames decode (2026-10-19)
- [x] Host logs the negotiated codec per guest, and the m-line regex bug that swallowed the first payload is
      fixed (2026-10-19)
- [x] Immersive handheld guest: a live feed on a coarse-pointer, <640px-wide or <500px-tall screen hides
      the header and footer; portrait keeps the feed in the top half with the pad below, landscape fills the
      viewport and floats the pad over it (2026-10-19)
- [x] Arcade diamond for A/B/C/D (C high, B right, D left, A low), sized to fit a 360px-wide phone (2026-10-19)
- [x] Traditional keyboard rows: P1 WASD + J K L U I O, P2 arrows + Z X C V, P3 T F G H + R Y 1–4, P4 numpad;
      no key repeats across ports (2026-10-19)
- [x] Keyboard help dialog (`?`, or the Keys button on the host bar and guest footer) built from `PORT_KEYS`;
      Ctrl/Cmd/Alt combos are no longer swallowed by the input readers (2026-10-19)
- [x] P1 coin and start verified end to end on the new rows: `Space` advanced the attract loop, `Enter`
      started the game (2026-10-19)
- [x] Keyboard is player 1 only: `KEY_BITS` derives from the P1 row, `createKeyboard()` takes no port, Slots
      pins the keyboard to port 0 and refuses it while P1 is taken, the help dialog shows one map, and the
      add-input menu lists devices only. Rows 2–4 stay in `PORT_KEYS` purely as injection codes so guest and
      gamepad input still reaches P2–P4 (2026-10-19)
- [x] Codec pins: `videoSdp(sdp, pin)` with `auto | vp8 | h264`, one codec per pinned offer, rtx kept with
      its codec; all three verified against a real Chrome offer and a live call (2026-10-19)
- [x] Guest sends `{t:'hello', platform}`; Chromium guests get VP8 on the first offer, Apple gets H.264 first
      (2026-10-19)
- [x] Video health over the data channel: codec, resolution, fps, frames decoded, audio bytes, element state;
      host Player panel shows `↑n ↓n` with details, guest shows `No picture · Try VP8` and auto-switches
      codec after 5 s of audio with zero frames (2026-10-19)
- [x] Capture from a fixed 384x288 relay canvas, so the stream is macroblock-aligned and host-layout independent
      (was 402x302) (2026-10-19)
- [x] Guest video no longer uses `image-rendering: pixelated`, and the touch controls no longer use
      `backdrop-filter` (both blank hardware video on some Androids) (2026-10-19)

## Next
- [ ] Prove multiplayer across real devices/networks (`npm run dev -- --host` for a LAN test or use the
      live site); only same-browser tabs have been tested, and only STUN is configured
- [ ] Detect a romset the core rejects: show "Romset is unknown" as an app error instead of reporting
      `running` (`teetert.zip` and `mslug6.zip` are the reproductions)
- [ ] Exercise the deployed site with a real ROM: the live page has never been given a file, only the
      identical dev build has
- [ ] Test a physical gamepad (the Gamepad path was verified with a mocked `navigator.getGamepads`)
- [ ] Hear the audio: a guest receives a live audio track, but no sample has ever been measured (analyser
      peak 0.0 under a gesture-less scripted drop, which is inconclusive)
- [ ] 8 player ports: needs an input path other than per-player keyboard binds (see agents.md)
- [ ] Confirm the phone picture: the codec pins, the VP8-first offer, the aligned 384x288 stream and the
      compositing fixes are all verified in Chromium, but no phone was available to retest. The `↑n ↓n` pair
      in the host's Players panel is what decides the next step
- [ ] Confirm the white-square fix on a real iPhone: codec filtering is verified on the offer and the feed
      renders in Chrome, but no Safari hardware was available to retest the decode path
- [ ] Try the touch overlay on real iOS/Android hardware (pointer capture, audio unlock, safe-area insets)
- [ ] Confirm the 30 fps cap end to end with a foreground host and a second machine; the preview browser
      throttles the background host, so only the track settings and sender parameters were verified
- [ ] Decide whether stream fps should be a host setting (30 vs 60) instead of a constant
- [ ] Test save compatibility: rename/repack a ROM (different key), and load states after a core update
- [ ] Prove native fullscreen in a real browser window: the preview browser blocks it, so entry/exit was
      only verified against a stubbed Fullscreen API
- [ ] Promote the first spectator when a port frees up, instead of leaving it empty until reload
- [ ] Let guests pick their port from the join screen (host confirmation), instead of first-come
- [ ] Mute / volume for the host, and a "fullscreen cabinet" toggle for guests
- [ ] Reconnect a dropped guest into the same slot instead of freeing it immediately
- [ ] Tauri v2 host wrapper (deferred until the web MVP is validated with real ROMs)

## Known limitations
- 4 player ports maximum (RetroArch keyboard binds only exist for players 1-4).
- "Stop game" reloads the page; hot ROM swap needs a fresh core instance.
- An unsupported romset (e.g. `teetert.zip`, `mslug6.zip`) boots the core to its own white "Romset is
  unknown" screen while the app still says `running`; there is no client-side romset validation.
- Host tab must stay visible: input injection and canvas capture run on `requestAnimationFrame`, which a
  background tab throttles to a few frames a second. The host now shows its fps and warns below 30, but
  cannot override the browser.
- Neo Geo sets need a `neogeo.zip` that matches the FBNeo build.
- Only STUN is configured; symmetric NAT pairs need a TURN server.
- Widescreen is a display stretch to 16:9, not extra rendered pixels: FBNeo has no widescreen mode, and the
  captured stream stays 384x288 4:3.
- Save states are keyed by ROM name + byte size in this browser only: renaming or repacking the same set
  loses the saves, and they do not follow to another machine. Re-dropping a ROM always resumes the auto
  save; clear it from the Saves panel to start fresh.
- Stream is 30 fps for everyone; there is no per-guest quality setting.
- Casting is Chrome's tab mirror, started from the browser's Cast menu: a page cannot trigger it, it is
  capped at 720p, and it mirrors the whole tab. Go fullscreen for a clean cabinet; the TV follows the tab
  and carries its audio.
- Duplicate port ownership: `Slots.sources` and `HostNet.ports` both track which peer owns which port,
  so a remap needs a re-sync loop in `HostView`.
