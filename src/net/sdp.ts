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
 * iOS Safari has shipped WebRTC builds that advertise VP9/AV1 and then show a blank white video while audio
 * and input keep working, so those payloads are removed. H.264 is also moved to the front of the video
 * m-line: the payload order is what the encoder follows when the answer accepts several codecs, and Safari's
 * H.264 decoder is its most reliable one. VP8 stays as the fallback. Audio is never touched, and an offer
 * that already passed through here comes back unchanged.
 */
export const safariSafeSdp = (sdp: string) => {
  const lines = sdp.split('\r\n')
  const videoLine = lines.find((line) => line.startsWith('m=video '))
  if (!videoLine) return sdp

  const codecs = codecsOf(lines)
  const dropped = new Set([...codecs].filter(([, codec]) => UNSAFE.has(codec)).map(([payload]) => payload))

  // RTX payloads are useless without the codec they retransmit.
  for (const line of lines) {
    const match = /^a=fmtp:(\d+) apt=(\d+)/i.exec(line)
    if (match && dropped.has(match[2])) dropped.add(match[1])
  }

  // `m=video <port> <proto> <payloads…>` — only the port and proto are fixed, everything after is a payload.
  const payloadsOf = (line: string) => /^m=video \S+ \S+ (.*)$/i.exec(line)?.[1].split(' ') ?? []
  const kept = payloadsOf(videoLine).filter((payload) => !dropped.has(payload))
  if (!kept.length) return sdp

  const ordered = [...kept.filter((payload) => codecs.get(payload) === 'H264'), ...kept.filter((payload) => codecs.get(payload) !== 'H264')]
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
