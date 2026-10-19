# CabinetCast

**[Play the web player →](https://spuds0588.github.io/CabinetCast/)**

One arcade cabinet, many couches. The host runs an arcade core in the browser and streams the cabinet screen
to friends who join with a link. No install, no accounts, no ROM uploads: guests only send controller input.

Built for shared-screen arcade games, the ones where everybody plays on the same monitor.

## Play

- **Host:** https://spuds0588.github.io/CabinetCast/ — drop an arcade `.zip`, share the invite link or QR code.
  The Saves panel keeps a host-only auto save plus three manual slots; drop the same ROM again to resume
  where you left off.
- **Guest:** open the invite link. Arrows, `Z X C V`, `A S` buttons, `Space` coin, `Enter` start, any gamepad,
  or the on-screen touch controls on a phone. Turn the phone sideways for a full-screen cabinet with
  translucent controls over the side bars.

Host keyboard is player 1 by default; each guest takes the next free port. The Players panel lists every
detected input and lets you move any keyboard, gamepad or guest to another port, or add one by hand.

The top menu bar has the invite link, QR code, widescreen and fullscreen toggles, and Stop. Fullscreen is
`Shift+F`, widescreen is `Shift+W`. Widescreen stretches the core's 4:3 picture to 16:9 for viewers who
prefer a filled screen; FBNeo has no true widescreen render mode, and the stream itself stays 4:3.

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

`npm run build` output is deployed to GitHub Pages by `.github/workflows/deploy.yml`. Video is streamed at
30 fps; input is still sampled every host frame.

## Notes

- 4 player ports (RetroArch keyboard bindings exist for players 1–4). Extra guests spectate. Each row is
  tagged with the keyboard, gamepad, arcade stick or phone the player is actually using.
- Save states live in the host's IndexedDB only, keyed by ROM name and size, and are never sent to guests.
- Neo Geo sets need a `neogeo.zip` matching the core; drop it once and it is stored in IndexedDB.
- Only STUN is configured. Symmetric NAT pairs need a TURN server to connect.
- Bring your own legally owned ROMs. Nothing is bundled except the option to drop `neogeo.zip`.

See [agents.md](agents.md) for engineering rules and the non-obvious API constraints,
[history.md](history.md) for the decision log, and [todo.md](todo.md) for what is next.
