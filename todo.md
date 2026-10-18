# todo.md

## Done (MVP)
- [x] Vite + React + TypeScript + plain CSS (no Tailwind: zero extra deps), base `/CabinetCast/`
- [x] FBNeo via Nostalgist, drag/drop `.zip`, launch timeout, real romset filename fix
- [x] Canvas video + AudioContext tap → single `MediaStream`
- [x] PeerJS host: room code, magic link, 4 ports, guest roster + latency, auto slot assignment
- [x] PeerJS guest: join by link, autoplay video, "tap for sound", 2-byte input frames, RTT
- [x] Slot manager with hot-swap dropdowns (keyboard / gamepad / guest / empty)
- [x] Keyboard + Gamepad API input, per-port synthetic key injection
- [x] neogeo.zip stored in IndexedDB and auto-attached
- [x] GitHub Pages workflow

## Next
- [ ] Verify in-game reaction to injected input with a real romset (could not be confirmed headlessly)
- [ ] 8 player ports: needs an input path other than per-player keyboard binds (see agents.md)
- [ ] Touch controls for mobile guests (d-pad + 4 buttons overlay)
- [ ] Mute / volume for the host, and a "fullscreen cabinet" toggle for guests
- [ ] Show stream bitrate + resolution in the host session panel
- [ ] Reconnect a dropped guest into the same slot instead of freeing it immediately
- [ ] Tauri v2 host wrapper (deferred until the web MVP is validated with real ROMs)

## Known limitations
- 4 player ports maximum (RetroArch keyboard binds only exist for players 1-4).
- "Stop game" reloads the page; hot ROM swap needs a fresh core instance.
- Host tab must stay visible: input injection runs on `requestAnimationFrame`.
- Neo Geo sets need a `neogeo.zip` that matches the FBNeo build.
- Only STUN is configured; symmetric NAT pairs need a TURN server.
