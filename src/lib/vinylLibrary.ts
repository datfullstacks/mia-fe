const VINYL_LIBRARY_DB = 'mia-vinyl-library'
const VINYL_LIBRARY_STORE = 'tracks'
const VINYL_LIBRARY_VERSION = 1

export interface StoredVinylTrackRecord {
  id: string
  title: string
  fileName: string
  mimeType: string
  file: Blob
  addedAt: string
  size: number
}

function buildTrackId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `vinyl-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeTrackTitle(fileName: string) {
  const nextTitle = fileName.replace(/\.mp3$/i, '').replace(/[_-]+/g, ' ').trim()
  return nextTitle || fileName
}

function sortTracks(records: StoredVinylTrackRecord[]) {
  return [...records].sort((left, right) => right.addedAt.localeCompare(left.addedAt))
}

function openVinylDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!supportsVinylLibrary()) {
      reject(new Error('IndexedDB is not available'))
      return
    }

    const request = window.indexedDB.open(VINYL_LIBRARY_DB, VINYL_LIBRARY_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(VINYL_LIBRARY_STORE)) {
        database.createObjectStore(VINYL_LIBRARY_STORE, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open vinyl library'))
  })
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Vinyl library transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Vinyl library transaction aborted'))
  })
}

function isMp3File(file: File) {
  return file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3')
}

export function supportsVinylLibrary() {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

export async function listStoredVinylTracks() {
  if (!supportsVinylLibrary()) return []

  const database = await openVinylDatabase()

  try {
    const records = await new Promise<StoredVinylTrackRecord[]>((resolve, reject) => {
      const transaction = database.transaction(VINYL_LIBRARY_STORE, 'readonly')
      const request = transaction.objectStore(VINYL_LIBRARY_STORE).getAll()

      request.onsuccess = () => resolve(request.result as StoredVinylTrackRecord[])
      request.onerror = () => reject(request.error ?? new Error('Could not read vinyl tracks'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Could not read vinyl tracks'))
    })

    return sortTracks(records)
  } finally {
    database.close()
  }
}

export async function saveStoredVinylFiles(files: File[]) {
  if (!supportsVinylLibrary()) return []

  const mp3Files = files.filter(isMp3File)
  if (mp3Files.length === 0) {
    return listStoredVinylTracks()
  }

  const database = await openVinylDatabase()

  try {
    const transaction = database.transaction(VINYL_LIBRARY_STORE, 'readwrite')
    const store = transaction.objectStore(VINYL_LIBRARY_STORE)

    for (const file of mp3Files) {
      store.put({
        id: buildTrackId(),
        title: normalizeTrackTitle(file.name),
        fileName: file.name,
        mimeType: file.type || 'audio/mpeg',
        file,
        addedAt: new Date().toISOString(),
        size: file.size,
      } satisfies StoredVinylTrackRecord)
    }

    await waitForTransaction(transaction)
  } finally {
    database.close()
  }

  return listStoredVinylTracks()
}

export async function deleteStoredVinylTrack(trackId: string) {
  if (!supportsVinylLibrary()) return []

  const database = await openVinylDatabase()

  try {
    const transaction = database.transaction(VINYL_LIBRARY_STORE, 'readwrite')
    transaction.objectStore(VINYL_LIBRARY_STORE).delete(trackId)
    await waitForTransaction(transaction)
  } finally {
    database.close()
  }

  return listStoredVinylTracks()
}
