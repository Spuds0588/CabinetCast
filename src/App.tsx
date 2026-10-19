import { CastView } from './components/CastView'
import { GuestView } from './components/GuestView'
import { HostView } from './components/HostView'

const params = new URLSearchParams(location.search)
const room = params.get('room')
/** `mode=pad` is the in-person guest: controls only. `mode=cast` is a TV receiver: picture only. */
const pad = params.get('mode') === 'pad'
const cast = params.get('mode') === 'cast'

export default function App() {
  if (!room) return <HostView />
  if (cast) return <CastView code={room} />
  return <GuestView code={room} pad={pad} />
}
