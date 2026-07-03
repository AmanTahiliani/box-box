import '@testing-library/jest-dom'

Object.defineProperty(window, 'scrollTo', {
  value: () => {},
  writable: true,
})

// Node 22+ ships an experimental `localStorage` global that shadows jsdom's
// implementation; without `--localstorage-file` it resolves to undefined in
// the test environment. Back-fill a minimal in-memory Storage so components
// that persist state (e.g. the championship simulator) are testable.
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = new Map<string, string>()
  const localStorageMock: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(key)
    },
    setItem: (key, value) => {
      store.set(String(key), String(value))
    },
  }
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })
}
