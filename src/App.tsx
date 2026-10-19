import { GuestView } from './components/GuestView'
import { HostView } from './components/HostView'

const params = new URLSearchParams(location.search)
const room = params.get('room')
/** `mode=pad` is the in-person guest: controls only, no picture, nothing to watch. */
const pad = params.get('mode') === 'pad'

export default function App() {
  return room ? <GuestView code={room} pad={pad} /> : <HostView />
}
