const DATABASE = 'gondola-player-media-v1'
const STORE = 'media'

export interface StoredAudio {
  file: Blob
  name: string
}

/**
 * Treats unavailable or malformed browser storage as an absent preference.
 */
export const readStorage = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

/**
 * Keeps storage failures separate from playback and returns whether persistence succeeded.
 */
export const writeStorage = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * Rejects array and primitive storage payloads before individual fields are restored.
 */
export const readRecord = (value: unknown): Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error)
    }
  })
}

const transact = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction
    let request: IDBRequest<T>
    try {
      transaction = database.transaction(STORE, mode)
      request = action(transaction.objectStore(STORE))
    } catch (error) {
      database.close()
      reject(error)
      return
    }
    transaction.oncomplete = () => {
      database.close()
      resolve(request.result)
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error ?? new Error('Media storage transaction aborted'))
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error)
    }
  })
}

/**
 * Restores only local media blobs recorded by this playground.
 */
export const loadAudio = async (): Promise<StoredAudio | null> => {
  const value: unknown = await transact('readonly', (store) => store.get('audio'))
  const saved = readRecord(value)
  return saved.file instanceof Blob && typeof saved.name === 'string' ? { file: saved.file, name: saved.name } : null
}

/**
 * Commits local audio replacement or removal before releasing the database connection.
 */
export const saveAudio = async (audio: StoredAudio | null) => {
  if (audio) {
    await transact('readwrite', (store) => store.put(audio, 'audio'))
  } else {
    await transact('readwrite', (store) => store.delete('audio'))
  }
}
