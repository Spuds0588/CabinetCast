const UNSAFE = new Set(['VP9', 'AV1', 'AV1X', 'H265', 'HEVC'])

/**
 * iOS Safari has shipped WebRTC builds that advertise VP9/AV1 but paint a blank video frame while audio
 * keeps playing. Drop those payloads from the host's offer so Safari negotiates VP8 or H.264 instead.
 * Only the video m-section is touched; the transform is a no-op when nothing needs removing.
 */
export const dropUnsafeVideoCodecs = (sdp: string) => {
  const lines = sdp.split('\r\n')
  const dropped = new Set<string>()

  for (const line of lines) {
    const match = /^a=rtpmap:(\d+) ([^/]+)\//i.exec(line)
    if (match && UNSAFE.has(match[2].toUpperCase())) dropped.add(match[1])
  }
  if (!dropped.size) return sdp

  // RTX payloads are useless without the codec they retransmit.
  for (const line of lines) {
    const match = /^a=fmtp:(\d+) apt=(\d+)/i.exec(line)
    if (match && dropped.has(match[2])) dropped.add(match[1])
  }

  const payloadsOf = (line: string) => /^m=video \S+ \S+ \S+ (.*)$/i.exec(line)?.[1].split(' ') ?? []
  const videoLine = lines.find((line) => line.startsWith('m=video '))
  if (!videoLine || !payloadsOf(videoLine).some((payload) => !dropped.has(payload))) return sdp

  return lines
    .map((line) => {
      if (line.startsWith('m=video ')) {
        const head = /^m=video (\S+ \S+ \S+) /i.exec(line)?.[1]
        return head ? `m=video ${head} ${payloadsOf(line).filter((payload) => !dropped.has(payload)).join(' ')}` : line
      }
      const attribute = /^a=(rtpmap|fmtp|rtcp-fb):(\d+)\b/i.exec(line)
      return attribute && dropped.has(attribute[2]) ? null : line
    })
    .filter((line): line is string => line !== null)
    .join('\r\n')
}
