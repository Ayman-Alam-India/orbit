import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * A tiny disk cache (server/.cache/<key>.json, gitignored). Live sources save every good
 * response here, so the demo still works if the wifi dies.
 *
 * Reads are kept in memory and only re-parsed when the file changes on disk, so routes that read
 * the same large file on every request (live-world.json) don't pay for it each time.
 * Callers must not mutate what they read unless they write it back.
 */
const CACHE_DIR = resolve(process.cwd(), process.env.ORBIT_CACHE_DIR ?? 'server/.cache')

const memory = new Map<string, { mtimeMs: number; value: unknown }>()
const fileOf = (key: string) => resolve(CACHE_DIR, `${key}.json`)

export async function readCache<T>(key: string): Promise<T | undefined> {
  try {
    const file = fileOf(key)
    const { mtimeMs } = await stat(file)
    const hit = memory.get(key)
    if (hit && hit.mtimeMs === mtimeMs) return hit.value as T
    const value = JSON.parse(await readFile(file, 'utf8')) as T
    memory.set(key, { mtimeMs, value })
    return value
  } catch {
    return undefined
  }
}

export async function writeCache(key: string, value: unknown): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true })
  const file = fileOf(key)
  await writeFile(file, JSON.stringify(value, null, 2))
  memory.set(key, { mtimeMs: (await stat(file)).mtimeMs, value })
}
