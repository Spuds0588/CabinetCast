# history.md — decision log

Newest first. Read this before re-deciding something; it records what was tried and rejected.

## 2026-10-19 — The roster's button becomes a phone controller

**`+ Player` was a chooser for paths that happen by themselves.** Gamepads take a port on connect, guests take
one on join, and the keyboard is there from boot, so the only input left to add by hand was a phone. The pill
now reads `+ Phone controller` and opens the controller-only QR (`?room=…&mode=pad`) on the screen, so someone
next to the cabinet can scan it without opening the menu. Its dialog is `Scan to play` with a line saying
what the phone becomes; the Invite menu's QR keeps `Scan to join` and follows the watch/controller toggle.

**The chooser's keyboard path is replaced by a first-keypress claim.** Without a menu, clearing the P1 tag
was a dead end. The host's next player-1 key press now puts the keyboard back on P1 when that port is free.
The × on the keyboard tag stays, so P1 can still be handed to a pad or a phone.

**A long invite URL widened the modal past a 390px screen.** The modal's `auto` grid track grew to the URL's
min-content width, so the card ran off the right edge. `minmax(0, 1fr)` on the track plus a full-width card
capped at 390px keeps it inside the viewport and lets the URL ellipsize.

**Verified:** `npm run build` passes with `pipefail`. The button opens `Scan to play` encoding
`?room=…&mode=pad`; that URL on a 390px viewport joined as P2, and the host showed a touch-icon
`P2 Guest …` tag. With keyboard, phone and two stubbed pads the button disables with "All four ports are
playing"; clearing P1 and pressing W put the keyboard back. The menu QR still uses watch mode and
`Scan to join`, and the Invite toggle still switches the link. The card measures 20px margins at 390px.

## 2026-10-19 — Everything but the players moves into the menu

**The aside was the last big block of chrome.** The host is now the cabinet, a centered row of player tags
under it, and a menu button. Invite (watch mode and link), Stream quality, Face buttons and Saves are menu
rows that expand in place, so nothing is more than two clicks away and the screen stays clear. Session state
moved to a line at the top of the menu: status, fps, ROM name, and the low-fps warning. The room code still
appears only in the invite link and QR code.

**The cabinet now sizes from the viewport height**, not from the width left over by a 330px sidebar, so it
grows into the space the panels used to take. The 4:3 and 16:9 widths are `calc((100dvh - 168px) * ratio)`
capped at 100%, which keeps the tags visible without a scroll on a laptop.

**The roster is centered under the picture and `+ Player` rides at the end of it.** The tags stay one
wrapped row; `+ Player` is now a dashed pill shaped like them instead of a heading button. Its chooser opens
upward, because the roster is the last element on the page and a downward menu fell off the viewport.

**Verified:** `npm run build` passes with `pipefail`. At 1280 and 390px the tags center under the cabinet;
three stubbed pads auto-assigned to P2–P4 and wrapped to three centered lines with the right port colours and
icons; disconnecting one freed its port and re-enabled `+ Player`. Every menu section expands in place and
its controls still work; widescreen resizes the cabinet to 16:9 and stays centered. Menu and chooser both fit
inside a 390px viewport.

## 2026-10-19 — The room code leaves the header

**The code only matters when inviting.** The pill in the host and guest headers is gone, and the pad status
line no longer prints it either. The Invite panel's link and the Copy link / QR actions still carry it, which
is the one place it needs to live. With the wordmark already gone, the host header is now just the menu
button on the right; the guest header is just its connection state. `.room` and `.label` are removed from
the stylesheet.

**Verified:** `npm run build` passes with `pipefail`. The host header renders only the menu button, the guest
header only `Connected`, and the pad tag `P3 · CONNECTED`. The invite link still resolves to `?room=...`, and
the QR dialog is unchanged. Checked at desktop and 390px.

## 2026-10-19 — Players are tags, and adding one is the fallback

**The roster was the tallest panel for the least information.** Four full-width port rows plus a separate
detected-inputs list took about 300px to say "keyboard and three controllers". It is now one wrapped row of
pills: port label in its arcade colour, device icon, name, a dot that lights while the player presses, and
for guests the `↓n` delivery rate. Guests beyond the fourth port get a dashed "watching" pill instead of
being invisible. The × on a keyboard or pad pill removes it; guests cannot be removed.

**Adding a player is now a fallback.** `+ Player` sits in the panel heading and opens a chooser listing the
keyboard (while P1 is free) and any detected pad with no port. Picking one assigns the lowest free port and
closes the menu. Auto-assignment on gamepad connect and guest join is unchanged, so the common path never
touches this. When all four ports are playing the button is disabled and its tooltip says how many
controllers are waiting.

**Verified:** `npm run build` passes with `pipefail`. A fake `navigator.getGamepads` entry auto-assigned to
P2 and appeared as a yellow tag; removing it made it available in `+ Player` and re-adding put it back on
P2. Removing the keyboard left the empty-state line, and `+ Player` re-added it on P1. Four guests plus a
watcher rendered as four port-coloured tags and one dashed watcher tag with rates, at 780px and 390px (three
lines, 89px tall, no horizontal overflow).

**Testing note:** stubbing `navigator.getGamepads` before Nostalgist boots breaks the launch, because
Nostalgist builds a `GamepadEvent` from the entry and a plain object fails the `Gamepad` conversion. Stub
after the game is running.

## 2026-10-19 — Arcade primaries replace the orange

**Black stays; the amber goes.** The palette is now a black cabinet with arcade button colours:
`--yellow #ffd23f`, `--red #ff4757`, `--blue #4c8dff`, `--green #35d07f`, plus `--pink` and `--cyan` for
the two extra face buttons. `--amber` and `--teal` no longer exist. The body keeps black and gains three
low-alpha glows (blue top, red bottom-right, green bottom-left) so the page is not flat grey.

**Colour has a job, not just a mood.** Yellow is the primary action, room code, toggle check and warning.
Red is Stop, errors, bad tags and the LIVE dot. Green is the power lamp, Start, and the arcade-stick icon.
Blue is focus, the keyboard icon and P3. Ports are colour coded in the roster (P1 red, P2 yellow, P3 blue,
P4 green) and a live port's border and LED take its colour. Panel headings carry a small colour dot, and
device icons are colour coded. Face buttons follow the arcade panel: A red, B yellow, C green, D blue, E
pink, F cyan; Coin is yellow and Start green. A pressed button fills with its own colour, and the touch
buttons keep that colour on hover instead of inheriting the grey button hover.

**Verified:** `npm run build` passes with `pipefail`; computed styles show P2's live border/LED as yellow,
the A button filling red with dark text, and all six face buttons resolving their own border colours. The
hover rule was fixed after the first check showed Start's border turning grey under the pointer. Desktop,
390px host, guest overlay, and the four- and six-button pads were checked visually.

## 2026-10-19 — No wordmark, no menu bar: the room code and a hamburger

**The name is out of the UI.** The host and guest headers no longer print CABINET CAST, the tab title is
"Arcade", and the `.brand` styles are gone. The name stays in the repo and docs. The guest pad's small lamp
is still there, since it is a status dot rather than branding.

**Host options moved behind one button.** The top bar is the room chip on the left and a hamburger on the
right. The dropdown holds Copy link, QR code, Keys, Widescreen, Fullscreen, Cast to a TV, and Stop game (only
while a game is running). Toggle rows use `aria-checked` and the amber tick; every choice closes the menu, as
do a click outside and Escape. The old wrapping menu bar and its 900px rule are removed, so the header stays
one row at phone widths.

**Verified:** `npm run build` passes with `pipefail`. The host header contains only ROOM and the code plus the
menu button; the six idle items render, and Stop game appears in red while a ROM is running. Widescreen
flips the cabinet to `.wide` and persists, QR opens from the menu, outside click and Escape both close it,
and Stop game returns to the insert-cartridge gate. Checked at 779px and 390px wide; the guest header shows
the room and connection state without the wordmark.

## 2026-10-19 — Casting is Chrome's tab mirror, not a receiver page

**The receiver page could not reach a Chromecast.** `?mode=cast` was an ordinary guest page: it needed a
browser to open it. A Cast device runs a registered receiver app, not an arbitrary page, and the Web Sender
SDK can launch a receiver app but cannot put Chrome into its "Cast tab" mirroring mode. The only device that
could ever open that URL was a computer, which already has the browser's own Cast menu. The picture-only
receiver was also the one guest that could not contribute input, so it needed a `cast` flag just to hand
back the player port it was assigned on connect.

**What the button does now.** Cast opens a two-step guide: Chrome's Cast menu, **Cast tab**, pick the TV;
then go fullscreen in this tab. Mirroring captures what the tab paints, so the TV follows the Fullscreen API
call, and tab audio goes with it. Chrome caps tab projection at 720p and the TV scales it. The order is in
the dialog because fullscreen hides the toolbar the cast starts from.

**Removed:** `CastView`, `startCast`/`canCast`, the `cast` field on the mode message, `HostEvents.onSpectate`
and `HostNet.spectators`. They existed only to keep the receiver from holding a port. The controller-only pad
is untouched.

**Verified:** `npm run build` passes; the Cast button opens the guide, and Escape, the backdrop and Close all
dismiss it; the guide's Fullscreen button closes it and calls the same toggle as `Shift+F`. This preview
browser refuses the actual fullscreen request, so entry into fullscreen and the cast itself stay unverified.

## 2026-10-19 — Phones as controllers, and a TV receiver for the cabinet

**Superseded the same day:** the receiver page is gone, see the entry above. The pad notes still apply.

**Two new guest roles reuse the input channel and the frame relay.** A couch player opens
`?room=CODE&mode=pad` and gets only the touch pad. The pad guest sends `{t:'mode', video:false}` like any
phone guest without a picture, so `HostNet` keeps no frame pump for it: one data channel, no encode. A TV
opens `?room=CODE&mode=cast` and gets only the picture, joining as a regular guest for frames and the audio
call. It sends `cast:true` in its mode message, and `HostEvents.onSpectate` exists for one reason: the host
assigns a port on connect, before any message arrives, so the receiver has to hand that port back. Without
it a TV silently took P2.

**The pad is always horizontal.** Portrait rotates `.pad-stage` by 90 degrees instead of laying out a
vertical version, so turning the phone sideways changes nothing. Button size follows the count (104 / 92 /
82 / 72 px for 2 / 3 / 4 / 5–6), 2 and 3 sit in one row, 4–6 in two rows with the lower row offset half a
button, and coin and start sit bottom centre like select and start on a console controller.

**Casting is best effort, as agreed.** `startCast()` tries `PresentationRequest` and falls back to a popup
window. Chrome desktop exposes the constructor but this setup has no receiver picker behind it, so the
popup is the real path: it is the cast page in a 960x720 window, ready to be dragged to a TV or mirrored
with the browser's own Cast menu. The page attempts fullscreen on load and exposes a Fullscreen button when
the browser refuses it without a gesture. Sound is the WebRTC call track; autoplay often works because the
window was opened by a click, and a "Tap for sound" button covers the case where it does not. Frames are
asked for at 30 fps and the receiver drops stale ones, so the picture trails the cabinet by whatever the
encode and network cost, with no clock tying the two together.

**Verified:** measured pad sizes 104/92/82/72 px against button counts 2/3/4/6, portrait rotated with no
horizontal overflow, pad tap delivered mask `1024` to the host. Cast page painted live frames (starfield,
then the attract screen), audio element held one live track, and two simultaneous receivers both showed
`SPECTATOR` with ports `-1` while a pad guest joined on P2 and got no frame rate entry. `npm run build`
passed with `pipefail`.

**Open:** a physical phone and a real Chromecast are untested. A cast receiver is an ordinary guest, so on
Chrome desktop the Cast button cannot place the page on a Chromecast by itself; the browser's Cast/mirror
menu is still the step that moves the window to the TV.

## 2026-10-19 — One keyboard, one port: players 2–4 bring their own device

**Four keyboard rows were pretending to be four players.** Every port had a full key map (P2 arrows +
Z/X/C/V, P3 T F G H + R Y, P4 the numpad) and the help dialog listed all of them, but on the host they
all read the same physical keyboard, which is not how anyone plays a four-player cabinet. P1 keeps WASD +
J K L U I O + Space/Enter; P2–P4 need a gamepad, an arcade stick or a phone.

**The rows 2–4 could not simply be deleted.** Nostalgist's `pressDown` works by firing a synthetic key
event for `input_playerN_<button>`, so the core still needs a unique key per port or injected guest and
gamepad input stops reaching P2–P4. `PORT_KEYS` keeps all four rows for `PORT_KEY_CONFIG`; `KEY_BITS` is
now derived from P1 only, and `createKeyboard()` takes no port at all. `Slots.setSource` clamps a keyboard
to port 0, `Slots.assign` refuses it while P1 is taken, `SlotPanel` disables Assign for the same reason and
no longer lists a keyboard in `+ Add player input`, and the `?` dialog shows the single P1 card plus a line
about players 2–4. The canvas is now blurred on every focus event, so clicking the cabinet cannot hand
native keys to the core and quietly re-enable the P2–P4 bindings.

**Verified:** a physical `KeyW`/`KeyJ`/`Space` is accepted by the reader (`defaultPrevented`), while
`KeyZ`, `KeyX`, `ArrowUp` and `KeyT` are ignored. The `?` dialog renders one P1 card. The add-input menu has
no keyboard entry. Guest input on P2 still reaches the core after the reader change: space+enter from a
phone guest started `xmen6pu` (attract loop → character select), which is what the retained P2 binds are
for. `npm run build` passes.

## 2026-10-19 — Phone had sound and controls but no picture: a codec ladder and a visible readout

**Report.** Both `xmen6pu` and `tmnt2` on the phone: audio in sync, touch controls working, screen a plain
white rectangle where the 4:3 stage is. Same build that decodes fine in a desktop guest tab, so the call and
the sender are healthy; the split is between "the phone gets no frames" and "the phone gets frames it cannot
paint", and there was no way to see which from the host.

**Three candidates, all defensible:** the H.264 payload the offer led with (Android Chrome decodes H.264
through MediaCodec and it is the fussy path; VP8 is Chromium's own default), an unaligned stream (the
captured track was 402x302, because RetroArch sizes its buffer from the transformed canvas rect), and
compositing (`image-rendering: pixelated` on the video plus `backdrop-filter` on the touch controls are both
known to blank hardware video on some Androids). All three were addressed rather than betting on one.

**What changed.** `videoSdp(sdp, pin)` now takes `auto | vp8 | h264`; the pinned modes strip the offer to a
single codec, which is the only way to force a switch — with VP8 still in the list Chrome answers VP8
whatever order the H.264 payloads are in. Guests send `{t:'hello', platform}` on connect, so a Chromium
guest's *first* offer is already VP8 and Apple still gets H.264 first. `captureStream` now reads a fixed
384x288 relay canvas drawn from the core canvas each rAF, so the stream is aligned and identical on every
host. The pixelated video rule and both backdrop filters are gone.

**Diagnosis instead of guesswork.** `GuestNet` samples `getStats()` every second and sends codec,
resolution, fps, `framesDecoded`, audio bytes and the video element's state to the host. The Players panel
shows `↑n ↓n` per guest with those details in the tooltip: `↑0` sender, `↑n ↓0` decoder, `↑n ↓n` with a
blank screen compositing. If frames stay at zero for two samples the guest shows `No picture · Try VP8`,
and after 5 s with audio but no frames it asks the host for the next codec on its own (`vp8` → `h264` →
`auto`). Every `{t:'retry'}` makes the host close and re-offer the call pinned to that codec.

**Verified on the dev build, then on the built LAN bundle:** `videoSdp` pinned offers for `auto`, `vp8` and
`h264` are all accepted by Chromium, negotiate the expected codec and decode frames live; the hello path
produced `video/VP8 · 384×288` on a desktop guest; a switch to H.264 and back re-offered and kept decoding
with the playhead advancing; the host panel read `↑20 ↓19` with `Host encoding video/H264 · none` and
`Guest decoding video/H264 · 384×288 · playing`. **Not verified:** the phone itself. The next report of
`↑n ↓n` from its row decides the next move.

## 2026-10-19 — WASD/JKL for P1, and a keyboard map you can open

**The rows were hostile to muscle memory.** P1 was arrows + Z/X/C/V + A/S, which is the RetroArch default but
not the layout people reach for; WASD + J/K/L is. A key can only belong to one port, so moving P1 meant
re-casting the rest: P1 = W A S D, J K L U I O (A–F), Space/Enter; P2 = arrows, Z X C V, B N, Tab/Backspace;
P3 = T F G H, R Y, 1–4, comma/period; P4 keeps the numpad. `PORT_KEYS` changed only in its rows; the retroarch
config, the readers and the new help dialog are all derived from it. All 48 DOM codes were checked for
duplicates. End to end on the dev build: `Space` inserted a coin (attract loop advanced to "PRESS 1 PLAYER
BUTTON") and `Enter` started the game ("GET READY").

**The help dialog can't drift.** `src/components/KeyHelp.tsx` inverts `KEY_BITS` back to key labels, so a row
change shows up in the dialog with no second table. It opens from the `Keys` button in the host menu bar, the
`Keys` button in the guest footer, or `?` (Shift+Slash, which no port binds). Escape and a backdrop click
close it, and it locks page scroll like the QR dialog. Both hardcoded hint lines (host drop screen, guest
footer) were rewritten to match.

**Modifier guard.** `createKeyboard` now ignores Ctrl/Cmd/Alt + key before mapping, so WASD/JKL columns do
not swallow Ctrl+W, Cmd+R or Alt+Tab, while plain keys are still `preventDefault`ed so nothing scrolls or
tabs the page.


## 2026-10-19 — Still a white square: H.264 first, and an m-line parsing bug

**The previous fix was not in the bundle.** After the codec filter landed, the phone still showed a white
rectangle with working audio and controls. GitHub Pages was still serving `index-DMlUdt-.js`, the build from
before the filter, so that test never exercised it. That is a deploy problem, not a codec one, but the
report also justified making the offer stricter.

**H.264 now leads the video m-line.** Safari's H.264 decoder is the most reliable one it ships, and the
payload order of the offer is what the encoder follows when the answer accepts several codecs. `safariSafeSdp`
(renamed from `dropUnsafeVideoCodecs`) drops VP9/AV1/HEVC and their rtx payloads, then reorders the rest so
every H.264 payload comes before VP8. Proved against a real `createOffer()` from `canvas.captureStream()`:
original `m=video … 96 97 102 103 104 … 114`, transformed `m=video … 102 104 106 108 127 39 96 97 103 …`,
negotiated `video/H264`, and the answering peer decoded frames (2 frames, 1 keyframe) over a live connection.

**The bug that hid it.** `m=video <port> <proto> <payloads…>` has two fixed tokens, not three —
`UDP/TLS/RTP/SAVPF` is a single token. The old regex consumed a third `\S+`, which ate the first payload (96)
and put it into the rebuilt header. The output happened to stay valid, which is why the first filter still
worked, but any attempt to reorder payloads was reading a list that started at the second codec. Fixed to
`^m=video (\S+ \S+)` and verified the transformed offer is accepted by a second Chrome peer as both a local
description and a remote offer timeout-free.

**Portrait layout.** The feed now sits at the top of the screen (`aspect-ratio: 4/3`, full width, capped at
58dvh) instead of being centred in a full-height black box, so the picture starts where the eye looks first
and the thumbs get the lower half. The face buttons moved from a 2x2 grid into an arcade diamond: the grid is
rotated 45° (C top, B right, D left, A bottom) and every label is rotated back upright. Sizes drop to
56px/146px in portrait and 60px/158px in landscape so the diamond's diagonal still fits a 360px-wide phone.
The host also logs the negotiated codec per guest (`[Cabinet:NetHost] Guest af02 video codec: video/H264`) so
the next report of a blank picture arrives with the codec already known.

## 2026-10-19 — Why the phone showed a white square, and an immersive guest

**The white square.** An iPhone guest had audio but a white video rectangle. The offer PeerJS built from
`canvas.captureStream()` listed VP8, VP9, AV1 and H.264 (with rtx twins), and the answerer's order decides
which codec Chromium actually encodes; iOS Safari's WebRTC decoder is the weakest link for VP9/AV1. A 4:3
30 fps arcade feed needs neither. `src/net/sdp.ts` (`dropUnsafeVideoCodecs`) rewrites the video m-line to
VP8 + H.264 plus the matching rtx payloads, drops the `a=rtpmap`/`a=rtcp-fb`/`a=fmtp` lines of everything
it removed, and is passed as PeerJS's `sdpTransform`. Audio is never touched, and an SDP that is already
VP8-only comes back byte-identical. Side effect worth keeping: guests now get one offer with both tracks,
because a video-only call followed by a video+audio call renegotiates the same m-line and some Safari
versions stop rendering the video after that. Verified cross-tab: the guest `<video>` reports 402x302 with
`currentTime` advancing and the sender negotiating on the filtered offer. Not verified on Safari hardware.

**Handheld is decided by screen size, not by the touch flag.** The old gate was `live && touch && compact`,
so any phone that reported a fine pointer (iOS "Request Desktop Website", a small desktop window, or a
tablet with a trackpad) kept the full chrome. Now `compact` is true for a coarse pointer OR width < 640 OR
height < 500, `handheld` is `live && compact`, and the controls render when `live && (touch || compact)`.
The toggle in the footer still works on a desktop window, where compact is false. At 390x844: header and
footer `display:none`, stage 391x844 at 0,0, no page scroll, fixed pointer-transparent touch layer, 4:3 feed
letterboxed with `object-fit: contain`. At 844x390 the same layout puts the d-pad and the A/B/C/D cluster
over the side bars. Synthetic `pointerdown`/`pointerup` on the d-pad and A lit `.dpad-arrow.on` and
`.touch-btn.on`, so the overlay emits the same mask path as before.

## 2026-10-19 — Input icons, thumb-sized touch controls, host save states, 30 fps stream

**Input icons.** `InputKind` (`keyboard | gamepad | arcade | touch`) is now shared protocol. A guest sends
`{ t: 'source', kind }` as JSON on the existing data channel (deduped, resent when the connection opens);
`HostNet` keeps it per peer and includes it in the roster, so the host can draw the right icon without any
new connection. Sticks are recognised by id (`padKind`: arcade / fightstick / HORI / Qanba / Mayflash),
which is the only signal a browser gives. New `InputIcon` SVG set (keyboard, gamepad, arcade stick, phone,
guest, empty) appears in the slot rows, the detected-input list and the guest's Player tag.

**Touch controls, resized and relocated.** The old pad was a 132px circle with 54px buttons and an 8px gap;
reviews of emulator and cloud-gaming layouts (Microsoft's touch-control design guide: left wheel for
movement — a D-pad for 2D games — right wheel for primary actions, only two thumbs, controls at the screen
edges, less-used actions above or below the primary ring) plus the usual 44pt/48dp minimums pushed the
numbers to 168px/70px with 12–14px gaps in portrait, 158px/68px in landscape, and Coin/Start as 44px pills
above the face cluster. Buttons are translucent with a blur and 1–2px light borders so the cabinet art
stays visible under them. `env(safe-area-inset-*)` keeps them clear of notches and home bars.

**Sideways play.** `(orientation: landscape) and (max-height: 600px)` turns the page into a full-bleed
cabinet: header and footer hide (only while touch controls are on, via `:has(.touch)`), the stage fills the
viewport, the 4:3 feed is letterboxed with `object-fit: contain`, and the controls become a fixed,
pointer-transparent layer over the side bars. The sound prompt moves to the top-right corner so it stops
covering the middle of the playfield. Verified at 844x390: stage 844x391, dpad 158px 24px from the left,
face cluster 68px buttons 24px from the right, no horizontal overflow, header/footer `display:none`, and a
held d-pad press lit the guest's host slot.

**Save states, host only.** `nostalgist.saveState()` / `loadState()` were already in the installed core
API. New `src/core/saves.ts` stores `{ state, savedAt }` blobs in IndexedDB (`cabinet_saves`), keyed by
`name#size`, in an auto slot plus slots 1–3. The host auto-saves every 45 s while running, when the tab is
hidden, and before Stop; re-dropping the same ROM loads the auto state after boot.The new Saves panel shows
timestamps with Load per slot, Save for 1–3, and a `×` that forgets the auto-save and pauses auto-saving
for the rest of that session, so the next launch starts fresh. Nothing is sent to guests.
 Verified: saving on the attract screen, starting a game, then loading that
slot returned to the attract screen; after a reload and re-drop the panel said `Resumed auto-save from 1m
ago`. Deleting via `×` held through a full 45s interval, Stop did not recreate it, and the next launch
showed no resume status. State blobs were 1.2–2.7 KB for this set and grew as the game ran, so they carry
real state.

**30 fps stream.** The capture track is now `captureStream(30)` (constant `STREAM_FPS` in protocol) and the
sender encodings get `maxFramerate: 30`. Input is still sampled and sent every host frame, so this trades
video smoothness for encode/decode headroom and a lower bitrate; it does not add input delay. Verified the
track reports `capture 30 fps` and the sender accepted the encoding parameters (no `Encoder tuning skipped`
log). Guest-side decoded fps could not be measured honestly here: the preview browser throttles the
background host tab to ~8 fps, so the guest was source-limited (~15.8 fps measured). The cap needs a
foreground host and a second machine to observe at 30.

## 2026-10-19 — Menu bar, fullscreen shortcut, widescreen stretch

**Menu bar.** The host header's loose buttons and the right rail's view/stop controls moved into one
`nav.menubar` under the room code: `Copy link`, `QR code`, `Widescreen`, `Fullscreen`, and `Stop` (only
while running). The Invite panel keeps the link text and the Session panel keeps status/fps/warning plus a
shortcut hint; both no longer duplicate buttons.

**Fullscreen.** A shared `useFullscreen(getTarget)` hook (`src/core/view.ts`) fullscreens the cabinet on
the host and the stage on the guest, syncs from `fullscreenchange`, and falls back to the video element on
iPhone Safari, which has no element fullscreen. The cabinet canvas is now fitted with `--cabinet-sx`,
`--cabinet-sy`, `--cabinet-x`, `--cabinet-y`: uniform 4:3 scaling normally, a 16:9 box when widescreen is
on, and contain-with-bars in fullscreen so nothing is cropped.

**Widescreen.** Checked before building it: RetroArch's aspect ratio settings are frontend scaling, and the
libretro FBNeo docs list no widescreen feature, so the core cannot render extra pixels. The toggle is
honest about that: it stretches the 4:3 frame into a 16:9 box on the viewer's screen. The stream stays
384x288, so bandwidth is unchanged, and the preference persists in `localStorage` and syncs across tabs.

**Shortcuts:** `Shift+F` fullscreen, `Shift+W` widescreen, on host and guest. They are handled in the
capture phase with `stopImmediatePropagation`, because plain `F` is Port 2's right arrow and must keep
reaching the per-port readers; `Shift+F` is swallowed before it can also register as input. Plain `F` was
checked and still does nothing on its own.

**Verified:** menubar renders with the right buttons (Stop appears only when running); widescreen switches
the cabinet to 16:9 and the canvas matrix to non-uniform scale (x 1.819, y 1.365) that exactly fills the
box, with the preference stored; `Shift+W` toggles it back; toggling from the guest tab updates the host
through the storage event; the guest's stage becomes 361x202 with `object-fit: fill`; the guest fullscreen
call targets `.stage`; `Stop` still reloads into a fresh room. Fullscreen itself could not be entered in
the preview browser (the request hangs there), so the request/exit/state path was verified with a stubbed
Fullscreen API: entry requests `.cabinet`, exit calls `document.exitFullscreen`, `aria-pressed` follows
`fullscreenchange`, and `Shift+F` repeats it. Native fullscreen in a real Chrome window is still unproven.

## 2026-10-19 — Join QR, touch controls, gamepad auto-assign, detected-input panel

**Invite QR.** The header's `QR code` button opens a modal with a 640px PNG of the invite link, plus
`Copy image` and `Download PNG`. `qrcode` (^1.5.4, with `@types/qrcode`) is the one new runtime dep: a
hand-rolled QR encoder is ~300 lines of Reed–Solomon for a feature every phone already understands, so
YAGNI cuts the other way here. Copy tries the image clipboard and falls back to copying the link; if both
are blocked the dialog says so. The dialog stops background scroll and closes on Escape or a backdrop
click.

**Touch controls.** `TouchControls` is an overlay under the 4:3 stage for coarse-pointer devices, on by
default there and toggled by a footer button everywhere else. A draggable d-pad (pointer capture, 0.15
dead zone) and A/B/C/D + Coin/Start emit the same 12-bit mask as the keyboard and gamepad; `GuestView`
ORs it into its per-frame mask and clears it when the overlay hides or the feed stops, so no direction
stays latched.

**Gamepad.** `HostView` already polled `navigator.getGamepads()` every second; that poll now also frees a
pad's port when it disappears and auto-assigns each newly seen pad to the lowest free port. Labels are
trimmed to the device name (`Xbox Wireless Controller`, not the vendor/product blob).

**Detected inputs.** The four per-slot `<select>` dropdowns are gone. Above the `+ Add player input`
button is a live list in port order: keyboard, every connected gamepad (with `Assign` when unassigned),
and every guest (`spectator` until it gets a port). Each assigned row has `Remove`; the button opens a
menu of keyboard + unassigned pads. A keyboard row is always present so it can be added back after being
removed from every port. `Slots.assign()` still owns lowest-free-port placement, so auto and manual
assignment cannot drift.

**Verified in the preview browser** against a live stream (`teetert.zip`, which shows FBNeo's "Romset is
unknown" screen but still broadcasts at 402x302):
- QR modal renders a 640x640 PNG whose URL matches the invite; downloaded bytes hash to the same SHA-256
  as the on-screen image (`184dee93…`); Escape closes it.
- Guest at 390x844 with the touch toggle: overlay is 363px wide with no horizontal overflow; a held
d-pad `pointerdown` on the right arrow lit the guest's host slot (P3) and released correctly; the A
button lit its `on` state.
- Mocked `navigator.getGamepads()` with a standard-mapping pad: assigned to P4 within one poll, shown as
  `Xbox Wireless Controller` in both the slot row and detected list; held button 9 + axis X lit P4;
  returning `null` freed P4 and dropped the row.
- Slot panel: remove keyboard → row shows `Assign` → assign returns it to P1; `+ Add player input` →
  `Keyboard` put it on P2 and closed the menu; rows stayed in port order.
- Console clean apart from the core's benign `Wake Lock permission request denied`.

**Still open:** real gamepad hardware, iOS Safari (pointer capture + audio unlock), and the existing
cross-device/TURN/audio gaps below.

## 2026-10-19 — Three more romsets; the "slow guest" was tab throttling

**Romsets:** `tmnt2.zip` boots to its title and accepts input (a P1 coin registered; host held 60 fps).
`xmen6pu.zip` boots to its intro at 60 fps. `mslug6.zip` is an Atomiswave set and FBNeo has no driver for
it, so it paints the same white "Romset is unknown" screen as `teetert` (and the 131 MB file pushes the
host heap to 437 MB).

**Frame-rate investigation.** A guest measured 11–15 fps on tmnt2, but that was the host tab being
backgrounded by the preview panel: host `requestAnimationFrame` ran at 59.4 fps when its tab was active
and 3–25 fps when another preview tab was active, even though `document.visibilityState` stayed
`visible`. With the host tab active and the guest in a separate headless Chrome, WebRTC
`outbound-rtp` reported 57–60 fps with `qualityLimitationReason=none`, and the guest decoded 599 frames
in 10 s (59.9 fps, 9 dropped) at 402x302. The capture/PeerJS path is not the bottleneck; Chromium throttle
for non-visible tabs is. On separate devices the host stays foreground.

**Change:** the host now samples its own rAF rate, shows an `N fps` tag while running, and warns below
30 fps to keep the tab in front. The captured track is marked `contentHint = 'motion'` and the sender
requests `degradationPreference = 'maintain-framerate'`, so the encoder gives up sharpness before motion
under load. Verified: active host 60 fps with a guest attached and no warning; opening another preview
tab dropped it to 3 fps and showed the warning; closing that tab returned it to 60 and hid the warning.
`tsc --noEmit` and `vite build` pass.

**Still open:** guest audio (no user gesture to start the core's AudioContext), the deployed page with a
ROM, and real-device/cross-network play.

## 2026-10-19 — Test romsets exercised on the dev build

**`gridlee.zip` boots and plays.** The earlier note that it reports "Romset is unknown" was wrong: FBNeo
has `d_gridlee.cpp`, and this build renders the "GRIDLEE HALL OF FAME" attract screen. P1 coin (Space) +
start (Enter) entered "PLAYER 1" gameplay; the guest saw the same at 402x302. A 5-minute soak in gameplay
kept the guest feed alive: 2,822 → 19,623 decoded frames (~56 fps), 814 dropped (4.1%), 19 of 20 samples
visually distinct, no video element events, host JS heap 189 → 191 MB. The only console rejection was the
benign `Wake Lock permission request denied` from the core (automation denies the lock).

**`robby.zip` still works.** Coin registered ("CREDITS 1"), start entered the maze. A 2-minute soak ran
1,451 → 7,982 decoded frames, 215 dropped (2.7%), 12 of 12 samples distinct, no events, heap 186 → 191 MB.

**`teetert.zip` does not boot.** FBNeo has no teetert driver (its source tree has `d_gridlee.cpp` and no
`teeter*` driver; the zip itself looks like a complete MAME set with its PROMs), so the core paints its
white "Romset is unknown" screen. The app still reports `running` because `launchArcade` only waits for the
core to boot, not for a driver match; guests just see the error screen. Not fixed in this pass.

**Slots with more than one guest.** Three guest tabs took P2, P3 and P4 — the first time ports 3–4 had a
real peer — and all three received live 402x302 video. Holding `ArrowLeft` in each guest lit only that
guest's port on the host (P2/P3/P4 live, P1 untouched). A fourth guest joined as **spectator** and still
received video. This validates the slot map in one browser; real devices and networks are still untested.

**Still open:** guest audio has never been measured (a scripted drop is not a user gesture, so the core's
`AudioContext` never starts); the deployed page has never been given a ROM; cross-network play is STUN-only.

## 2026-10-18 — Pruned the dead weight (−71 lines, no behavior change)

**Deleted:** `bitNames` (never read), the `PeerSlot` type with the `Slots.peers` field it existed for,
`Slots.label()` (no caller), and the whole RTT feature: the `ping` / `pong` / `stat` messages, the host's
`rtts` map and JSON branch in `receive()`, the guest's ping timer and `send()`, `onLatency`, and both
latency readouts. **The RTT badge is gone from the guest header and the roster** — no machinery is left
behind for it, and `ROOM_CODE_ALPHABET` is no longer exported.

**Also simplified:** `Slots.assignPeer()` used to keep a second copy of the peer→port map just to spot a
re-join; it now asks `portOf()` directly, which was already the single source of truth.

**Verified after pruning:** the room still opens, a guest still connects, receives `audio+video` (300x225
frames), is assigned P2, and its held `ArrowLeft` lights only the P2 slot on the host. Roster reads
`Guest 4dcc P2` with no latency tag and no `ms` text anywhere in the UI. `tsc --noEmit` and `vite build`
clean; no unused exports and no dead CSS classes remain in `src/`.

**Delivered:** commit `7594054a6b0ce8a9f7cd440442c9b919146f9d8f` on `main`, deployed by workflow run
`39183112725` (“Deploy to GitHub Pages”, success). Production serves that build as
`assets/index-_piwFEK8.js`; the live host UI opens a PeerJS room and a dead invite link still lands on
“Room not found”.

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
