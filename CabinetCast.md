# CabinetCast (Arcade-Splitscreen)
**Unified Product Requirements Document, Implementation Guide, Task List, and Agent Directives**

---

## 1. Product Requirements Document (PRD)

### 1.1 Executive Summary
CabinetCast is a web- and Tauri-based arcade emulator designed for drop-in multiplayer. Unlike its sister projects (`mgba-splitscreen` and `melonDS-splitscreen`), which execute multiple isolated emulation instances for handheld consoles, CabinetCast leverages the shared-screen nature of traditional arcade hardware. 

The Host runs a single WebAssembly-based arcade core (FBNeo), captures video and audio at source resolution, and broadcasts the feed to up to 7 remote guests via WebRTC (PeerJS) using magic invite links. Remote and local inputs are multiplexed into an 8-player virtual slot matrix with ultra-low latency.

### 1.2 Target Audience & Core Value Proposition
- **Target Audience:** Retro gaming communities, remote friend groups, streamers, and enthusiasts of classic 4-player and 6-player arcade titles (*X-Men 6-Player*, *The Simpsons*, *TMNT: Turtles in Time*, *Dungeons & Dragons: Shadow over Mystara*, *Sunset Riders*, *NBA Jam*).
- **Core Value Proposition:** Zero installation for guests. One click on a magic link connects a friend directly to the cabinet with zero-configuration controller support.

### 1.3 Key Features & Requirements

#### F-1: Single-Instance Shared-Screen Emulation
- Execute arcade ROMs in-browser or inside a Tauri desktop wrapper using the FinalBurn Neo (FBNeo) libretro core compiled to WebAssembly via Nostalgist.js.
- Emulate up to 8 input ports simultaneously without split-screen rendering overhead.

#### F-2: Zero-Config ROM & BIOS Ingestion
- Drag-and-drop loading for standard arcade `.zip` ROM archives (CPS-1, CPS-2, CPS-3, Konami, Midway, Cave, Sega).
- No JS zip extraction library required; files are loaded directly into the virtual filesystem.
- Automatic detection of Neo Geo ROMs: prompt once for `neogeo.zip`, persist it directly in browser `IndexedDB`, and attach it transparently on subsequent boots.

#### F-3: Flexible 8-Player Slot Assignment (Mix & Match)
- Support arbitrary combinations of local and remote players across Ports 1 through 8:
  - Local Keyboard (configurable keymaps).
  - Local Physical Gamepads (via HTML5 Gamepad API).
  - Remote WebRTC Peers (via PeerJS DataChannels).
- Host GUI allows hot-swapping any player slot during active gameplay.

#### F-4: Host-as-SFU WebRTC Broadcasting
- Host captures `<canvas>` at 60 FPS and audio via Web Audio API (`createMediaStreamDestination()`).
- Host streams outbound AV to up to 7 peers concurrently.
- Native arcade resolution streaming (e.g., 320x224 to 384x224) upscaled client-side using `image-rendering: pixelated` to maintain sub-4 Mbps total outbound bandwidth across all peers.
- Magic link generation containing the Host Peer ID for 1-click guest access.

#### F-5: Low-Latency Binary Input Pipeline
- Input state transmitted over unordered, unreliable WebRTC DataChannels (`ordered: false, maxRetransmits: 0`).
- Compact 2-byte (`Uint16`) bitmask encoding per frame to eliminate serialization overhead and garbage collection pauses.

#### F-6: Cross-Platform Desktop Client (Tauri)
- Host can be packaged as a lightweight desktop application via Tauri v2 for improved CPU efficiency, raw frame timing, and lower system latency.
- Guests connect through any modern mobile or desktop browser (Chromium, Firefox, Safari).

### 1.4 Non-Functional Requirements
- **Input-to-Display Latency:** Guest round-trip input processing under 30–50ms on standard broadband networks.
- **Upstream Bandwidth:** Host total outbound bandwidth under 500 Kbps per connected peer at native resolution.
- **Compatibility:** Full support for Standard Gamepad API mappings (XInput, DualShock/DualSense, DirectInput via browser abstraction).
- **Security:** Pure peer-to-peer WebRTC connections. No game ROMs or AV data pass through centralized servers; STUN/TURN is used only for signaling and NAT traversal.

---

## 2. Technical Architecture & Implementation Guide

### 2.1 System Architecture

```
                  ┌────────────────────────────────────────────────────────┐
                  │                      HOST CLIENT                       │
                  │                                                        │
                  │  ┌──────────────┐     AV Stream    ┌────────────────┐  │
                  │  │ FBNeo (WASM) │ ───────────────► │ Canvas & Audio │  │
                  │  │ (RetroArch)  │                  │  Destination   │  │
                  │  └──────▲───────┘                  └───────┬────────┘  │
                  │         │                                  │           │
                  │  ┌──────┴──────────────┐                   │           │
                  │  │    SlotManager      │                   │           │
                  │  │ (Ports 1 - 8)       │                   │           │
                  │  └▲──────▲───────────▲─┘                   │           │
                  │   │      │           │                     │           │
                  └───┼──────┼───────────┼─────────────────────┼───────────┘
                      │      │           │                     │
          ┌───────────┘      │           └──────────┐          │ MediaStream
     Keyboard          Gamepad API             WebRTC Data     │ (Tracks: Video/Audio)
     (Local P1)         (Local P2)             (PeerJS)        │
                                                    │          ▼
                                        ┌───────────┴─────────────┐
                                        │      GUEST CLIENTS      │
                                        │    (Peers 1 through 7)  │
                                        │                         │
                                        │  - Render <video> tag   │
                                        │  - Capture Local Inputs │
                                        │  - Send Uint16 Bitmask  │
                                        └─────────────────────────┘
```

### 2.2 Input Protocol Specification
Every input frame is represented as a single unsigned 16-bit integer (`Uint16`, 2 bytes).

| Bit Position | Value | Action | Default RetroArch Mapping |
| :--- | :--- | :--- | :--- |
| **0** | `0x0001` | D-Pad Up | `RETRO_DEVICE_ID_JOYPAD_UP` |
| **1** | `0x0002` | D-Pad Down | `RETRO_DEVICE_ID_JOYPAD_DOWN` |
| **2** | `0x0004` | D-Pad Left | `RETRO_DEVICE_ID_JOYPAD_LEFT` |
| **3** | `0x0008` | D-Pad Right | `RETRO_DEVICE_ID_JOYPAD_RIGHT` |
| **4** | `0x0010` | Button 1 (A) | `RETRO_DEVICE_ID_JOYPAD_Y` |
| **5** | `0x0020` | Button 2 (B) | `RETRO_DEVICE_ID_JOYPAD_B` |
| **6** | `0x0040` | Button 3 (C) | `RETRO_DEVICE_ID_JOYPAD_A` |
| **7** | `0x0080` | Button 4 (D) | `RETRO_DEVICE_ID_JOYPAD_X` |
| **8** | `0x0100` | Button 5 (E) | `RETRO_DEVICE_ID_JOYPAD_L` |
| **9** | `0x0200` | Button 6 (F) | `RETRO_DEVICE_ID_JOYPAD_R` |
| **10** | `0x0400` | Coin / Select | `RETRO_DEVICE_ID_JOYPAD_SELECT` |
| **11** | `0x0800` | Start | `RETRO_DEVICE_ID_JOYPAD_START` |
| **12–15** | Reserved | Unassigned | Reserved for system hotkeys / menu |

### 2.3 Slot Manager Design
The Slot Manager tracks 8 logical player slots (Indices 0 through 7, representing Player 1 through Player 8).

```typescript
export type InputSource =
  | { type: 'local-keyboard' }
  | { type: 'local-gamepad'; gamepadIndex: number }
  | { type: 'remote-peer'; peerId: string }
  | { type: 'none' };

export interface PlayerSlot {
  port: number; // 0 to 7
  source: InputSource;
  state: number; // Current Uint16 input bitmask
}
```

#### Assignment Rules:
1. Slot 0 (P1) defaults to `local-keyboard` or `local-gamepad: 0`.
2. When a remote peer connects, they are assigned to the lowest available `none` slot.
3. If all 8 slots are occupied, additional peers connect in "Spectator Mode" (receiving the media stream with no slot assignment).
4. Host GUI provides dropdowns on each slot to remap, swap, or kick inputs.

### 2.4 Engine & Virtual File System (Nostalgist.js)
Nostalgist.js handles downloading and executing RetroArch core WASM modules.

- **Core Used:** `fbneo`
- **ROM Delivery:** Direct `File` or `Blob` instance passed to `Nostalgist.launch()`.
- **Virtual Path:** RetroArch places the file in `/retroarch/userdata/content/`. FBNeo identifies the game based on the original `.zip` filename.
- **Audio Capture Hook:** RetroArch writes to an internal Web Audio `AudioContext`. We extract its stream using `audioContext.createMediaStreamDestination()` or pipe the emulator's `<canvas>.captureStream(60)` along with the audio destination track.

### 2.5 Neo Geo BIOS Management (IndexedDB)
To satisfy zero-friction play while adhering to strict legal and technical constraints:
1. Native non-merged arcade sets for Capcom, Konami, and Midway work out-of-the-box with no BIOS.
2. For Neo Geo ROMs, the app looks up a key `neogeo_bios` in an IndexedDB object store (`cabinet_store`).
3. If absent and the user launches a known Neo Geo game, an unobtrusive banner prompts: *"Neo Geo titles require neogeo.zip once. Drag and drop it here."*
4. Once provided, it is stored in IndexedDB. Subsequent boots automatically mount `neogeo.zip` into Nostalgist's virtual `/bios/` folder using Nostalgist's `bios` option.

### 2.6 WebRTC Networking Specs
- **Signaling Server:** PeerJS default cloud broker (or a custom self-hosted PeerJS-server via one environment variable).
- **Peer Connection Config:**
  ```typescript
  const peer = new Peer({
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  });
  ```
- **DataChannel Config:**
  ```typescript
  const conn = peer.connect(hostPeerId, {
    reliable: false,
    ordered: false
  });
  ```
- **Stream Broadcast:**
  ```typescript
  // Combine canvas 60fps video with Web Audio destination track
  const videoTrack = canvas.captureStream(60).getVideoTracks()[0];
  const audioTrack = audioDest.stream.getAudioTracks()[0];
  const combinedStream = new MediaStream([videoTrack, audioTrack]);

  // Host calls each guest as they connect
  const call = peer.call(guestPeerId, combinedStream);
  ```

---

## 3. Developer Task List

### Phase 1: Core Setup & Emulation Engine
- [ ] **Task 1.1: Project Scaffolding**
  - Initialize Vite + React + TypeScript application.
  - Setup Tailwind CSS for UI controls.
  - Setup basic project directory structure: `/src/core`, `/src/net`, `/src/hooks`, `/src/components`.
- [ ] **Task 1.2: IndexedDB BIOS Storage**
  - Implement a 10-line native IndexedDB wrapper (`src/core/biosStorage.ts`) to store and retrieve `neogeo.zip`.
  - Add drag-and-drop zone with quick validation for `neogeo.zip`.
- [ ] **Task 1.3: Nostalgist.js Integration**
  - Integrate `nostalgist` package.
  - Build `ArcadeCabinet.tsx` component that loads FBNeo wasm core with an uploaded ROM zip.
  - Test boot for a standard Konami/Capcom ROM (e.g., `tmnt.zip` or `sf2.zip`).
- [ ] **Task 1.4: Direct Input Injection Layer**
  - Wire Nostalgist's input injection API to accept bitmask updates for ports 0 through 7.
  - Ensure zero frame lag between bitmask reception and engine state poll.

### Phase 2: Slot Manager & Local Input Handling
- [ ] **Task 2.1: SlotManager Implementation**
  - Build `SlotManager.ts` managing 8 slots (`ports: PlayerSlot[8]`).
  - Implement helper methods: `assignSlot()`, `releaseSlot()`, `setSlotState()`, `getSlotForPeer()`.
- [ ] **Task 2.2: Local Keyboard Controller**
  - Map keyboard events (Arrows/WASD + standard keys) into a `Uint16` bitmask.
  - Pipe bitmask to Slot 0.
- [ ] **Task 2.3: Local Gamepad API Controller**
  - Implement polling loop (`requestAnimationFrame`) for standard HTML5 Gamepads.
  - Map connected physical gamepads to assigned local slots.
- [ ] **Task 2.4: Host Slot Management UI**
  - Build an on-screen HUD overlay showing all 8 slots, current input sources, and signal indicators.
  - Enable dropdown reassignment of any slot (e.g., moving Peer A from P2 to P3).

### Phase 3: WebRTC Networking (PeerJS)
- [ ] **Task 3.1: Host Network Engine (`NetworkHost.ts`)**
  - Initialize PeerJS Host session and generate unique Room IDs / Magic Links (`?room=ROOM_ID`).
  - Listen for incoming guest data connections (`connection` event).
  - Listen for guest disconnections and automatically free up their corresponding player slots.
- [ ] **Task 3.2: Media Stream Broadcaster**
  - Capture Nostalgist `<canvas>` video track at 60 FPS.
  - Intercept Nostalgist audio output using a `MediaStreamAudioDestinationNode`.
  - Automatically call newly joined peers with the combined `MediaStream`.
- [ ] **Task 3.3: Guest Client Engine (`NetworkGuest.ts` & `GuestView.tsx`)**
  - Detect `?room=ROOM_ID` URL parameter on load to enter Guest Mode.
  - Connect to Host via PeerJS with unreliable DataChannel.
  - Mount incoming `MediaStream` into an auto-playing, low-latency `<video>` element (`playsinline`, `muted=false`).
  - Read local gamepad/keyboard inputs on the guest machine, encode into 2-byte `Uint16`, and send over DataChannel every tick/change.
- [ ] **Task 3.4: Reconnection & Error Recovery**
  - Implement heartbeat monitoring and automated cleanup for dropouts.
  - Display latency metrics (ping) on Host and Guest HUDs.

### Phase 4: Tauri Desktop Packaging
- [ ] **Task 4.1: Tauri v2 Initialization**
  - Run `npm run tauri init` to scaffold the desktop wrapper.
  - Configure native window properties (custom titlebar, min dimensions 960x720, hardware acceleration enabled).
- [ ] **Task 4.2: Tauri Host Optimizations**
  - Ensure WebRTC and media capture permissions are granted automatically inside the Webview.
  - Expose native desktop clipboard access to easily copy magic links.

### Phase 5: Verification & Polish
- [ ] **Task 5.1: 4-to-8 Player Stress Test**
  - Run test sessions with 4-player (*TMNT*, *Simpsons*) and 6-player (*X-Men*) ROMs.
  - Verify stable 60 FPS video delivery and upstream bandwidth under 4 Mbps with 4+ peers.
- [ ] **Task 5.2: Diagnostic Logging Audit**
  - Ensure all modules emit clear, structured console messages for testing and issue reporting.

---

## 4. agents.md (Developer & AI Agent Guidelines)

### 4.1 Engineering Principles

1. **Strict YAGNI (You Aren't Gonna Need It):**
   - Do not add features that have not been explicitly requested.
   - No unnecessary state stores (prefer single-file React state or simple classes over Redux/Zustand unless complexity explodes).
   - Do not install libraries for tasks solved by native browser APIs (e.g., no `lodash`, no `jszip`, no `axios`).

2. **One-Line Solutions Over Verbosity:**
   - Prefer concise standard JavaScript/TypeScript patterns (ternaries, array methods, bitwise ops).
   - If a utility takes more than 15 lines, review whether native APIs already provide it.

3. **No Pushover Mentality (Equal Exchange):**
   - As an expert developer, provide immediate, constructive pushback if a requested feature degrades latency, violates WebRTC constraints, breaks 60 FPS frame budgets, or introduces bloat.
   - Ground pushback in concrete networking or emulation constraints.

4. **Complete File Outputs:**
   - Always output full, unabridged source files. Never use placeholder comments like `/* rest of code remains the same */` or `// ... existing code`. The user must be able to copy, replace, and run immediately.

### 4.2 Logging Standards
Every module must use structured, prefixed console logging so that when the Product Manager pastes console logs, bugs can be isolated in seconds.

| Module | Log Prefix | Example Message |
| :--- | :--- | :--- |
| **Emulator** | `[Cabinet:Core]` | `[Cabinet:Core] Launching FBNeo with ROM: tmnt.zip` |
| **BIOS Store** | `[Cabinet:Storage]` | `[Cabinet:Storage] neogeo.zip retrieved from IndexedDB (size: 1542891 bytes)` |
| **Slot Manager** | `[Cabinet:SlotMgr]` | `[Cabinet:SlotMgr] Peer "peer_guest_01" assigned to Port 2 (Player 3)` |
| **Network Host** | `[Cabinet:NetHost]` | `[Cabinet:NetHost] Broadcasting AV stream to 4 active peers` |
| **Network Guest** | `[Cabinet:NetGuest]` | `[Cabinet:NetGuest] Connected to room "cab-9123". Local latency: 28ms` |
| **Input Engine** | `[Cabinet:Input]` | `[Cabinet:Input] Port 0 bitmask changed: 0x0810 (START + B1)` |

### 4.3 Input Bitmask Reference Constants
Copy this exact definition block into input handling code to maintain consistency across the codebase:

```typescript
export const INPUT_BITS = {
  UP:       1 << 0,  // 0x0001
  DOWN:     1 << 1,  // 0x0002
  LEFT:     1 << 2,  // 0x0004
  RIGHT:    1 << 3,  // 0x0008
  BUTTON_1: 1 << 4,  // 0x0010 (A / Attack)
  BUTTON_2: 1 << 5,  // 0x0020 (B / Jump)
  BUTTON_3: 1 << 6,  // 0x0040 (C)
  BUTTON_4: 1 << 7,  // 0x0080 (D)
  BUTTON_5: 1 << 8,  // 0x0100 (E)
  BUTTON_6: 1 << 9,  // 0x0200 (F)
  COIN:     1 << 10, // 0x0400 (Select / Insert Coin)
  START:    1 << 11, // 0x0800 (Start)
} as const;
```

### 4.4 Diagnostic Runbook for Testing
When analyzing logs provided by the tester:
1. **Black screen on guest:** Verify `[Cabinet:NetHost]` logged `addTrack` or successful media stream broadcast, and that the guest received an active `MediaStream` with both video and audio tracks.
2. **Inputs not registering:** Inspect `[Cabinet:Input]` and `[Cabinet:SlotMgr]` logs to check whether the incoming peer ID matches the port mapped in the virtual input table.
3. **Neo Geo boot failure:** Check `[Cabinet:Storage]`. If `neogeo.zip` is missing from IndexedDB, FBNeo will silently abort or loop back to RetroArch menu. Ensure BIOS injection occurred prior to core initialization.