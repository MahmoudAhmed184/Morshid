function createStorage(): Storage {
  const entries = new Map<string, string>()

  return {
    get length() {
      return entries.size
    },
    clear: () => {
      entries.clear()
    },
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => {
      entries.delete(key)
    },
    setItem: (key, value) => {
      entries.set(key, value)
    },
  }
}

if (typeof window !== 'undefined' && window.localStorage === undefined) {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: createStorage(),
  })
}
