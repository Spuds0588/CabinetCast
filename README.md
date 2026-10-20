# CabinetCast

**[Play the web player →](https://spuds0588.github.io/CabinetCast/)**

One arcade cabinet, many couches. The host runs an arcade core in the browser and streams the cabinet screen
to friends who join with a link. No install, no accounts, no ROM uploads: guests only send controller input.

Built for shared-screen arcade games, the ones where everybody plays on the same monitor.

## Play

- **Host:** https://spuds0588.github.io/CabinetCast/ — drop an arcade `.zip`, share the invite link or QR code.
  Saves keep a host-only auto save plus three manual slots; drop the same ROM again to resume where you
  left off.
- **Guest:** open the invite link. `WASD` to move, `J K L U I O` for buttons A–F, `Space` coin, `Enter` start,
  any gamepad, or the on-screen touch controls on a phone. Portrait keeps the picture at the top and the pad
  below it; turn the phone sideways for a full-screen cabinet with translucent controls over the side bars.
- **Couch player:** in the menu's Invite section pick **Controller only**, then open the link or QR on a phone. That
  page is the pad and nothing else: no picture, no sound, and the host does not encode frames for it. Use it
  when everyone is in the same room watching the cabinet. `+ Phone controller` under the cabinet shows the same
  code as a QR, which is quicker than opening the menu mid-game.
- **TV:** put the tab on the TV with Chrome's Cast menu (**Cast tab**), then press `Shift+F` here. The TV
  follows the tab into fullscreen and carries its sound; Chrome mirrors a tab at up to 720p. The **Cast**
  entry in the host menu shows those two steps, since only the browser can start a tab cast.

Player 1 is the host keyboard; each guest or gamepad takes the next free port. The players are one centered
row of tags under the cabinet: one small tag per player, with the port colour, the device icon and a dot that
lights while they press. `+ Phone controller` sits at the end of that row and shows a QR code that opens the
controller-only page on a phone, so someone in the room can join as a pad without typing a link. Gamepads and
joining guests are assigned automatically, so this is the only manual add. The keyboard stays on player 1,
because it is the only port with keys of its own; if its tag is cleared, the next key press puts it back.

Press `?` (or the Keys button) for player 1's keys: WASD + `J K L U I O`, `Space` coin, `Enter` start. The
host keyboard is player 1 only: players 2–4 need their own device, a gamepad or a phone joining the room.

Everything except the players is a menu option. The host bar is just a menu button, and the menu holds Copy
link, QR code, Keys, the widescreen and fullscreen toggles, Cast, Stop game, and the settings that used to be
panels: Invite (watch mode and link), Stream quality, Face buttons and Saves, each expanding in place. The
room code lives only in the invite link and QR code. Fullscreen is `Shift+F`, widescreen is `Shift+W`.
Widescreen stretches the core's 4:3 picture to 16:9 for viewers who prefer a filled screen; FBNeo has no true
widescreen render mode, and the stream itself stays 4:3.

## What it is built on

- `nostalgist` runs the FinalBurn Neo libretro core as WebAssembly, entirely in the host's browser.
- The emulator canvas is captured as JPEG frames and pushed per guest over a PeerJS data channel; tapped
audio is the only WebRTC media track.
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
  Extra guests spectate. Each tag is labelled with the keyboard, gamepad, arcade stick or phone the player is
  actually using.
- Save states live in the host's IndexedDB only, keyed by ROM name and size, and are never sent to guests.
- Neo Geo sets need a `neogeo.zip` matching the core; drop it once and it is stored in IndexedDB.
- The host relays JPEG frames over each guest's data channel and sends audio as the only WebRTC media track.
  Guest tags show `↓n`, the frames per second that guest is receiving, so a stalled feed is visible at a glance.
- Only STUN is configured. Symmetric NAT pairs need a TURN server to connect.
- Bring your own legally owned ROMs. Nothing is bundled except the option to drop `neogeo.zip`.

See [agents.md](agents.md) for engineering rules and the non-obvious API constraints,
[history.md](history.md) for the decision log, and [todo.md](todo.md) for what is next.
