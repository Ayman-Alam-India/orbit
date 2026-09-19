// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type Task = {
  id: string
  owner: string
  status: string
  priority: string
  dependsOn: string[]
  paths: string[]
  acceptance: string[]
  tests: string[]
  handoff: string
  branch: string
}

const manifest = JSON.parse(readFileSync('tasks.json', 'utf8')) as {
  team: Record<string, unknown>
  tasks: Task[]
}
const ids = manifest.tasks.map((t) => t.id)

/** Keeps tasks.json trustworthy: the personal allocator (docs/ALLOCATOR.md) reads it verbatim. */
describe('tasks.json', () => {
  it('has unique IDs and valid owners, statuses and priorities', () => {
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of manifest.tasks) {
      expect(Object.keys(manifest.team)).toContain(t.owner)
      expect(['todo', 'in_progress', 'done']).toContain(t.status)
      expect(['P0', 'P1', 'P2']).toContain(t.priority)
      expect(t.acceptance.length, `${t.id} needs acceptance criteria`).toBeGreaterThan(0)
      expect(t.handoff, `${t.id} needs a handoff note`).not.toBe('')
    }
  })

  it('only depends on tasks that exist, with no cycles', () => {
    const byId = new Map(manifest.tasks.map((t) => [t.id, t]))
    for (const t of manifest.tasks) for (const dep of t.dependsOn) expect(ids).toContain(dep)
    const visit = (id: string, path: string[]): void => {
      expect(path, `dependency cycle: ${[...path, id].join(' -> ')}`).not.toContain(id)
      byId.get(id)!.dependsOn.forEach((dep) => visit(dep, [...path, id]))
    }
    ids.forEach((id) => visit(id, []))
  })

  it('gives every person at least one task', () => {
    for (const person of Object.keys(manifest.team)) {
      expect(
        manifest.tasks.some((t) => t.owner === person),
        `${person} has no task`,
      ).toBe(true)
    }
  })
})
