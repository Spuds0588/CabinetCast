import type { CodecPin } from '../core/protocol'

const UNSAFE = new Set(['VP9', 'AV1', 'AV1X', 'H265', 'HEVC'])

/** Codec name per video payload type, e.g. `96` → `VP8`. */
const codecsOf = (lines: string[]) => {
  const codecs = new Map<string, string>()
  for (const line of lines) {
    const match = /^a=rtpmap:(\d+) ([^/]+)\//i.exec(line)
    if (match) codecs.set(match[1], match[2].toUpperCase())
  }
  return codecs
}

/**
 * Make the host's offer something every guest can actually paint.
 *
 * `auto` drops the codecs iOS Safari advertises but fails to paint (VP9/AV1 show a blank white video
 * while audio and input keep working) and moves H.264 to the front of the m-line, because payload order
 * is the preference the encoder follows. The pinned modes keep a single codec: leaving VP8 in the list
 * lets Chrome choose it no matter how the H.264 payloads are ordered, so the only way to make a device
 * try its other decoder is to offer nothing else.
 *
 * Audio is never touched, and an offer that needs no change comes back byte for byte.
 */
export const videoSdp = (sdp: string, pin: CodecPin = 'auto') => {
  const lines = sdp.split('\r\n')
  const videoLine = lines.find((line) => line.startsWith('m=video '))
  if (!videoLine) return sdp

  const codecs = codecsOf(lines)
  const dropped = new Set<string>()

  for (const [payload, codec] of codecs) {
    // RTX is resolved against the codec it retransmits, below.
    if (codec === 'RTX') continue
    if (UNSAFE.has(codec)) dropped.add(payload)
    else if (pin === 'vp8' && codec !== 'VP8') dropped.add(payload)
    else if (pin === 'h264' && codec !== 'H264') dropped.add(payload)
  }

  // `a=fmtp:<rtx payload> apt=<payload>` — retransmission is useless without the codec it protects.
  for (const line of lines) {
    const match = /^a=fmtp:(\d+) apt=(\d+)/i.exec(line)
    if (!match) continue
    if (dropped.has(match[2]) || !codecs.has(match[2])) dropped.add(match[1])
  }

  // `m=video <port> <proto> <payloads…>` — only the port and proto are fixed, everything after is a payload.
  const payloadsOf = (line: string) => /^m=video \S+ \S+ (.*)$/i.exec(line)?.[1].split(' ') ?? []
  const kept = payloadsOf(videoLine).filter((payload) => !dropped.has(payload))
  if (!kept.length) return sdp

  const ordered = [
    ...kept.filter((payload) => codecs.get(payload) === 'H264'),
    ...kept.filter((payload) => codecs.get(payload) !== 'H264'),
  ]
  if (!dropped.size && ordered.join() === payloadsOf(videoLine).join()) return sdp

  return lines
    .map((line) => {
      if (line.startsWith('m=video ')) {
        const head = /^m=video (\S+ \S+)/i.exec(line)?.[1]
        return head ? `m=video ${head} ${ordered.join(' ')}` : line
      }
      const attribute = /^a=(rtpmap|fmtp|rtcp-fb):(\d+)\b/i.exec(line)
      return attribute && dropped.has(attribute[2]) ? null : line
    })
    .filter((line): line is string => line !== null)
    .join('\r\n')
}
