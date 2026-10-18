/**
 * RetroArch's WASM audio runs through its own AudioContext, which it never exposes.
 * We patch AudioNode.connect so any node wired to an AudioContext.destination is also wired to a
 * MediaStreamAudioDestinationNode, giving us an audio track for the broadcast stream.
 */

const taps = new Map<AudioContext, MediaStreamAudioDestinationNode>()
let patched = false

export function installAudioTap(): void {
  if (patched) return
  patched = true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proto = AudioNode.prototype as any
  const connect = proto.connect
  proto.connect = function (destination: AudioNode, ...rest: unknown[]) {
    const result = connect.call(this, destination, ...rest)
    try {
      const ctx = this.context as AudioContext
      if (destination === ctx.destination) {
        let tap = taps.get(ctx)
        if (!tap) taps.set(ctx, (tap = ctx.createMediaStreamDestination()))
        connect.call(this, tap)
      }
    } catch {
      /* tapping is best effort; a failure must never break emulator audio */
    }
    return result
  }
}

export const audioTracks = (): MediaStreamTrack[] =>
  [...taps.values()].flatMap((tap) => tap.stream.getAudioTracks())
