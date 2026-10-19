/**
 * Host-only save states. States live in this browser's IndexedDB and are never sent to guests.
 * One auto slot per ROM plus three manual slots, keyed by ROM name + size.
 */
export type SaveSlot = 'auto' | '1' | '2' | '3'

const SLOTS: SaveSlot[] = ['auto', '1', '2', '3']
const DB_NAME = 'cabinet_saves'
const STORE = 'states'

export interface SaveRecord {
  state: Blob
  savedAt: number
}

let opening: Promise<IDBDatabase> | null = null

const openDb = () =>
  (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      opening = null
      reject(request.error)
    }
  }))

const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => {
  const database = await openDb()
  return new Promise<T>((resolve, reject) => {
    const request = action(database.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Identity of a ROM for save lookup. Same name and size is treated as the same game. */
export const romKey = (file: File) => `${file.name.toLowerCase()}#${file.size}`

const key = (rom: string, slot: SaveSlot) => `${rom}|${slot}`

export const getSave = (rom: string, slot: SaveSlot) => run<SaveRecord | undefined>('readonly', (store) => store.get(key(rom, slot)))

export const putSave = async (rom: string, slot: SaveSlot, state: Blob) => {
  const savedAt = Date.now()
  await run('readwrite', (store) => store.put({ state, savedAt } satisfies SaveRecord, key(rom, slot)))
  console.log(`[Cabinet:Saves] Saved ${slot === 'auto' ? 'auto-save' : `slot ${slot}`} for ${rom} (${state.size} bytes)`)
  return savedAt
}

export const deleteSave = (rom: string, slot: SaveSlot) => run('readwrite', (store) => store.delete(key(rom, slot)))

/** Timestamp per slot that has a state, for the Saves panel. */
export const saveTimes = async (rom: string) => {
  const entries = await Promise.all(
    SLOTS.map(async (slot) => [slot, (await getSave(rom, slot).catch(() => undefined))?.savedAt] as const),
  )
  return Object.fromEntries(entries.filter(([, savedAt]) => typeof savedAt === 'number')) as Partial<Record<SaveSlot, number>>
}

/** "just now", "4m ago", "2h ago" for save timestamps. */
export const ago = (savedAt: number) => {
  const minutes = Math.round((Date.now() - savedAt) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.round(minutes / 60)}h ago`
}
