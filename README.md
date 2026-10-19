# CabinetCast

One arcade cabinet, many couches. The host runs an arcade core in the browser and streams the cabinet screen
to friends who join with a link. No install, no accounts, no ROM uploads: guests only send controller input.

Built for shared-screen arcade games, the ones where everybody plays on the same monitor.

## Play

- **Host:** https://spuds0588.github.io/CabinetCast/ — drop an arcade `.zip`, share the invite link.
- **Guest:** open the invite link. Arrows, `Z X C V`, `A S` buttons, `Space` coin, `Enter` start, or any gamepad.

Host keyboard is player 1 by default; each guest takes the next free port. Use the slot dropdowns to move a
guest, a gamepad, or the keyboard to any port, or to leave a port empty.

## What it is built on

- `nostalgist` runs the FinalBurn Neo libretro core as WebAssembly, entirely in the host's browser.
- Canvas video + tapped audio become one `MediaStream` sent to each guest over WebRTC (PeerJS signaling).
- Input is a 2-byte bitmask per frame over an unordered, unreliable data channel, injected back into the core.

ROMs never leave the host machine. Only the video and audio stream is sent to guests.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173/CabinetCast/
npm run build    # typecheck + production build
```

`npm run build` output is deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## Notes

- 4 player ports (RetroArch keyboard bindings exist for players 1–4). Extra guests spectate.
- Neo Geo sets need a `neogeo.zip` matching the core; drop it once and it is stored in IndexedDB.
- Only STUN is configured. Symmetric NAT pairs need a TURN server to connect.
- Bring your own legally owned ROMs. Nothing is bundled except the option to drop `neogeo.zip`.

See [agents.md](agents.md) for engineering rules and the non-obvious API constraints,
[history.md](history.md) for the decision log, and [todo.md](todo.md) for what is next.
