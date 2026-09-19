import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * A tiny disk cache (server/.cache/<key>.json, gitignored). Live sources save every good
 * response here, so the demo still works if the wifi dies.
 */
const CACHE_DIR = resolve(process.cwd(), 'server/.cache')

export async function readCache<T>(key: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(resolve(CACHE_DIR, `${key}.json`), 'utf8')) as T
  } catch {
    return undefined
  }
}

export async function writeCache(key: string, value: unknown): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(resolve(CACHE_DIR, `${key}.json`), JSON.stringify(value, null, 2))
}
