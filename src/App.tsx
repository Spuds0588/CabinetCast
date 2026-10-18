import { GuestView } from './components/GuestView'
import { HostView } from './components/HostView'

const room = new URLSearchParams(location.search).get('room')

export default function App() {
  return room ? <GuestView code={room} /> : <HostView />
}
