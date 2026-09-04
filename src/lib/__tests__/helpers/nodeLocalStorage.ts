// Installs a minimal in-memory localStorage before any store or ops module is
// imported. Real zustand stores load fine under Vitest's Node environment
// with no localStorage at all — getStorageAdapter()'s `void localStorage`
// (src/lib/storageAdapter.ts) throws inside createJSONStorage's own
// try/catch, so persist just falls back to a no-op storage and every store
// still works, unpersisted (see docs/ARCHITECTURE.md's storage-seam section,
// and src/store/__tests__/workOrderStore.test.ts, which already relies on
// this). But two call sites read localStorage directly with no try/catch of
// their own: src/lib/deviceId.ts's getDeviceId() and
// src/store/activityLogStore.ts's record(). shopFlow.test.ts drives the real
// ops layer end to end, which calls both (every stock movement and every
// activity-log entry), so without a real localStorage they throw the first
// time either is reached. Importing this module first — before any
// store/ops/deps import — is what makes that safe.
class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
  clear(): void {
    this.data.clear()
  }
  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null
  }
  get length(): number {
    return this.data.size
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true })
}
