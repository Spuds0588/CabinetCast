/** Persistent neogeo.zip storage. Native IndexedDB, no dependencies. */
const STORE = 'bios'
const KEY = 'neogeo_bios'

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('cabinet_store', 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const getBios = () =>
  run<Blob | undefined>('readonly', (store) => store.get(KEY)).then((bios) => {
    if (bios) console.log(`[Cabinet:Storage] neogeo.zip retrieved from IndexedDB (size: ${bios.size} bytes)`)
    return bios
  })

export const saveBios = (blob: Blob) =>
  run('readwrite', (store) => store.put(blob, KEY)).then(() =>
    console.log(`[Cabinet:Storage] neogeo.zip stored (size: ${blob.size} bytes)`),
  )
