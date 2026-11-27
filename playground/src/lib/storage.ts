const DATABASE = 'gondola-player-media-v1'
const STORE = 'media'

export interface StoredAudio {
  file: Blob
  /**
   * Original filename kept separately for display after a reload.
   */
  name: string
}

/**
 * Reads a JSON preference, returning null for missing, inaccessible, or malformed data.
 */
export const readStorage = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

/**
 * Saves a JSON preference and returns false if serialization or storage throws.
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
 * Supplies an empty record for non-object values and arrays before restoring fields.
 */
export const readRecord = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
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
 * Restores the saved media record, returning null for missing or invalid data.
 */
export const loadAudio = async (): Promise<StoredAudio | null> => {
  const value: unknown = await transact('readonly', (store) => {
    return store.get('audio')
  })
  const saved = readRecord(value)

  return saved.file instanceof Blob && typeof saved.name === 'string' ? { file: saved.file, name: saved.name } : null
}

/**
 * Waits for the saved audio change to commit. Pass null to remove the record.
 */
export const saveAudio = async (audio: StoredAudio | null) => {
  if (audio) {
    await transact('readwrite', (store) => {
      return store.put(audio, 'audio')
    })
  } else {
    await transact('readwrite', (store) => {
      return store.delete('audio')
    })
  }
}
