# CabinetCast

**[Play the web player →](https://spuds0588.github.io/CabinetCast/)**

One arcade cabinet, many couches. The host runs an arcade core in the browser and streams the cabinet screen
to friends who join with a link. No install, no accounts, no ROM uploads: guests only send controller input.

Built for shared-screen arcade games, the ones where everybody plays on the same monitor.

## Play

- **Host:** https://spuds0588.github.io/CabinetCast/ — drop an arcade `.zip`, share the invite link or QR code.
  The Saves panel keeps a host-only auto save plus three manual slots; drop the same ROM again to resume
  where you left off.
- **Guest:** open the invite link. `WASD` to move, `J K L U I O` for buttons A–F, `Space` coin, `Enter` start,
  any gamepad, or the on-screen touch controls on a phone. Portrait keeps the picture at the top and the pad
  below it; turn the phone sideways for a full-screen cabinet with translucent controls over the side bars.
- **Couch player:** in the Invite panel pick **Controller only**, then open the link or QR on a phone. That
  page is the pad and nothing else: no picture, no sound, and the host does not encode frames for it. Use it
  when everyone is in the same room watching the cabinet.
- **TV:** press **Cast** on the host bar. It opens the picture on a receiver or in a window that can be
  dragged to a TV or mirrored with the browser's Cast menu. The receiver takes no player slot, and its sync is
  best effort, so it trails the cabinet by the encode and network hop.

Player 1 is the host keyboard; each guest or gamepad takes the next free port. The Players panel lists every
detected input and lets you move a gamepad or guest to another port. The keyboard stays on player 1, because
it is the only port with keys of its own.

Press `?` (or the Keys button) for player 1's keys: WASD + `J K L U I O`, `Space` coin, `Enter` start. The
host keyboard is player 1 only: players 2–4 need their own device, a gamepad or a phone joining the room.

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

- 4 player ports. The host keyboard is player 1; players 2–4 use a gamepad, an arcade stick, or a phone.
  Extra guests spectate. Each row is tagged with the keyboard, gamepad, arcade stick or phone the player is
  actually using.
- Save states live in the host's IndexedDB only, keyed by ROM name and size, and are never sent to guests.
- Neo Geo sets need a `neogeo.zip` matching the core; drop it once and it is stored in IndexedDB.
- Video codecs adapt to the guest: H.264 first for Safari, VP8 first for Chrome and Android. If a guest has
  sound but no picture it asks the host to re-offer with the other codec, and the host's Players panel shows
  `↑n ↓n` (encoded and decoded frames per second) to tell a sender problem from a guest decoder problem.
- Only STUN is configured. Symmetric NAT pairs need a TURN server to connect.
- Bring your own legally owned ROMs. Nothing is bundled except the option to drop `neogeo.zip`.

See [agents.md](agents.md) for engineering rules and the non-obvious API constraints,
[history.md](history.md) for the decision log, and [todo.md](todo.md) for what is next.
