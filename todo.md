# todo.md

## Done (MVP)
- [x] Vite + React + TypeScript + plain CSS (no Tailwind: zero extra deps), base `/CabinetCast/`
- [x] FBNeo via Nostalgist, drag/drop `.zip`, launch timeout, real romset filename fix
- [x] Canvas video + AudioContext tap → single `MediaStream`
- [x] PeerJS host: room code, magic link, 4 ports, guest roster + latency, auto slot assignment
- [x] PeerJS guest: join by link, autoplay video, "tap for sound", 2-byte input frames, RTT
- [x] Slot manager with hot-swap dropdowns (keyboard / gamepad / guest / empty)
- [x] Keyboard + Gamepad API input, per-port synthetic key injection
- [x] Per-port local keyboard: each port's reader derives from `PORT_KEYS`, so a keyboard slot cannot
      replay another port's input (verified 2026-10-18)
- [x] neogeo.zip stored in IndexedDB and auto-attached
- [x] GitHub Pages workflow → live at https://spuds0588.github.io/CabinetCast/ (run 39137299796)
- [x] Injection into the core verified against real emulated output: P1 coin+start changed 77.8% of the
      guest frame (attract → play); guest P2 coin×2+start changed 49.8% against a 1.1% idle control

## Next
- [ ] Exercise the deployed site with a real ROM: the live page has never been given a file, only the
      identical dev build has
- [ ] Hear the audio: a guest receives a live audio track, but no sample has ever been measured (analyser
      peak 0.0 under a gesture-less scripted drop, which is inconclusive)
- [ ] Prove multiplayer across two machines/networks; only same-browser host+guest has been tested, and
      only STUN is configured
- [ ] Ports 3 and 4 have never been assigned a real peer
- [ ] Delete dead code: `bitNames`, `PeerSlot`, and the ping/pong + `stat` messages that only feed the
      RTT badge
- [ ] 8 player ports: needs an input path other than per-player keyboard binds (see agents.md)
- [ ] Touch controls for mobile guests (d-pad + 4 buttons overlay)
- [ ] Mute / volume for the host, and a "fullscreen cabinet" toggle for guests
- [ ] Reconnect a dropped guest into the same slot instead of freeing it immediately
- [ ] Tauri v2 host wrapper (deferred until the web MVP is validated with real ROMs)

## Known limitations
- 4 player ports maximum (RetroArch keyboard binds only exist for players 1-4).
- "Stop game" reloads the page; hot ROM swap needs a fresh core instance.
- Host tab must stay visible: input injection runs on `requestAnimationFrame`, which a hidden tab
  throttles to about one frame a second.
- Neo Geo sets need a `neogeo.zip` that matches the FBNeo build.
- Only STUN is configured; symmetric NAT pairs need a TURN server.
- Duplicate port ownership: `Slots.sources` and `HostNet.ports` both track which peer owns which port,
  so a remap needs a re-sync loop in `HostView`.
