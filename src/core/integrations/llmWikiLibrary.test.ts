import { mkdir, mkdtemp, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LlmWikiLibrary } from './llmWikiLibrary'

const roots: string[] = []
const id = '2610.11302'
const note = 'Literature/Paper_Notes/L2_Structured/通信/Han_2026_编码 #1 & more.md'
const record = 'raw/paper_records/Han 2026.md'
async function put(root: string, path: string, content: string) {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), content)
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'therss-library-'))
  roots.push(root)
  for (const path of ['raw/paper_records', 'Literature/Paper_Notes'])
    await mkdir(join(root, path), { recursive: true })
  await put(root, 'AGENTS.md', '# Rules')
  await put(root, '_schema.md', '# Schema')
  const open = vi.fn(async (_url: string) => undefined)
  return {
    root,
    open,
    service: new LlmWikiLibrary({
      vaultRoot: root,
      openExternal: open,
      now: () => new Date('2026-10-28T12:00:00Z')
    })
  }
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
describe('read-only llm-wiki library', () => {
  it('finds a version-normalized record and opens the exact encoded existing paper note', async () => {
    const { root, open, service } = await fixture()
    await put(root, record, `---\narxiv_id: '${id}'\npaper_note: '${note}'\n---\nignored body`)
    await put(
      root,
      note,
      `---\ntype: paper-note\nstatus: reading\nlevel: L2\n---\nbody is not returned`
    )
    expect(await service.status({ arxivId: `${id}v2` })).toMatchObject({
      status: 'recorded',
      arxivId: id,
      recordPath: record,
      notePath: note,
      level: 'L2',
      readStatus: 'reading'
    })
    expect(await service.open(id)).toEqual({ opened: true })
    const url = new URL(open.mock.calls[0]![0] as unknown as string)
    expect(url.protocol).toBe('obsidian:')
    expect(url.searchParams.get('path')).toBe(join(await realpath(root), note))
    expect(url.searchParams.size).toBe(1)
  })
  it('distinguishes absent, record-only and a note without a sidecar', async () => {
    const { root, service } = await fixture()
    expect(await service.status({ arxivId: id })).toMatchObject({
      status: 'not-found',
      notePath: null,
      recordPath: null
    })
    await put(root, record, `---\narxiv_id: ${id}\n---\n`)
    expect(await service.status({ arxivId: id, refresh: true })).toMatchObject({
      status: 'recorded',
      recordPath: record,
      notePath: null
    })
    await service.open(id)
    await unlink(join(root, record))
    await put(root, note, `---\narxiv_id: "${id}v1"\nstatus: read\n---\n`)
    expect(await service.status({ arxivId: id, refresh: true })).toMatchObject({
      status: 'recorded',
      recordPath: null,
      notePath: note,
      level: 'L2'
    })
  })
  it('reports a missing linked note and rechecks targets before opening', async () => {
    const { root, service, open } = await fixture()
    await put(root, record, `---\narxiv_id: ${id}\npaper_note: '[[${note}]]'\n---\n`)
    expect(await service.status({ arxivId: id })).toMatchObject({ status: 'note-missing' })
    await expect(service.open(id)).rejects.toThrow('note')
    expect(open).not.toHaveBeenCalled()
    await put(root, note, `---\narxiv_id: ${id}\n---\n`)
    expect(await service.status({ arxivId: id, refresh: true })).toMatchObject({
      status: 'recorded'
    })
    await unlink(join(root, note))
    await expect(service.open(id)).rejects.toThrow('note')
    expect(open).not.toHaveBeenCalled()
  })
  it('does not choose between duplicate record identities', async () => {
    const { root, service } = await fixture()
    for (const path of [record, 'raw/paper_records/duplicate.md'])
      await put(root, path, `---\narxiv_id: ${id}\n---\n`)
    expect(await service.status({ arxivId: id })).toMatchObject({ status: 'ambiguous' })
    await expect(service.open(id)).rejects.toThrow('Multiple llm-wiki records')
  })
  it.each(['../../Life/private.md', 'Life/private.md', 'Literature/Paper_Notes/../secret.md'])(
    'rejects unsafe metadata target %s',
    async (path) => {
      const { root, service, open } = await fixture()
      await put(root, record, `---\narxiv_id: ${id}\npaper_note: '${path}'\n---\n`)
      expect(await service.status({ arxivId: id })).toMatchObject({ status: 'unavailable' })
      await expect(service.open(id)).rejects.toThrow()
      expect(open).not.toHaveBeenCalled()
    }
  )
  it('rejects symlinked targets and roots without following them', async () => {
    const { root, service } = await fixture()
    await put(root, record, `---\narxiv_id: ${id}\npaper_note: '${note}'\n---\n`)
    await mkdir(dirname(join(root, note)), { recursive: true })
    await symlink(join(root, 'AGENTS.md'), join(root, note))
    expect(await service.status({ arxivId: id })).toMatchObject({ status: 'unavailable' })
    const linked = `${root}-link`
    roots.push(linked)
    await symlink(root, linked)
    expect(
      await new LlmWikiLibrary({ vaultRoot: linked, openExternal: vi.fn() }).status({ arxivId: id })
    ).toMatchObject({ status: 'unavailable' })
  })
  it('does not report absence after malformed or oversized frontmatter', async () => {
    const { root, service } = await fixture()
    await put(root, record, `---\narxiv_id: ${id}\n${'x'.repeat(20_000)}`)
    expect(await service.status({ arxivId: id })).toMatchObject({ status: 'unavailable' })
    await put(root, record, 'not frontmatter')
    expect(await service.status({ arxivId: id, refresh: true })).toMatchObject({
      status: 'unavailable'
    })
  })
  it('rejects invalid request fields and reports a missing vault without leaking its root', async () => {
    const { root, service } = await fixture()
    await expect(service.status({ arxivId: '../secret' })).rejects.toThrow()
    await expect(service.status({ arxivId: id, path: 'Life' } as never)).rejects.toThrow()
    const result = await new LlmWikiLibrary({
      vaultRoot: join(root, 'missing'),
      openExternal: vi.fn()
    }).status({ arxivId: id })
    expect(result.status).toBe('unavailable')
    expect(JSON.stringify(result)).not.toContain(root)
    await expect(service.open('bad')).rejects.toThrow()
  })
  it('surfaces a launch error without returning an optimistic success', async () => {
    const { root } = await fixture()
    await put(root, record, `---\narxiv_id: ${id}\n---\n`)
    const service = new LlmWikiLibrary({
      vaultRoot: root,
      openExternal: vi.fn(async () => {
        throw new Error('private path')
      })
    })
    await expect(service.open(id)).rejects.toThrow('Obsidian could not be opened')
  })
  it('expires its observed state and lets explicit recheck bypass the cache', async () => {
    const { root, open } = await fixture()
    let time = Date.parse('2026-10-28T12:00:00Z')
    const service = new LlmWikiLibrary({
      vaultRoot: root,
      openExternal: open,
      now: () => new Date(time)
    })
    expect(await service.status({ arxivId: id })).toMatchObject({ status: 'not-found' })
    await put(root, record, `---\narxiv_id: ${id}\n---\n`)
    expect(await service.status({ arxivId: id })).toMatchObject({ status: 'not-found' })
    time += 30_000
    expect(await service.status({ arxivId: id })).toMatchObject({
      status: 'recorded',
      checkedAt: '2026-10-28T12:00:30.000Z'
    })
    await unlink(join(root, record))
    expect(await service.status({ arxivId: id, refresh: true })).toMatchObject({
      status: 'not-found'
    })
  })
  it('does not claim absence or open a target when the scan exceeds its entry budget', async () => {
    const { root, service, open } = await fixture()
    for (let offset = 0; offset < 5_001; offset += 100) {
      await Promise.all(
        Array.from({ length: Math.min(100, 5_001 - offset) }, (_, index) =>
          writeFile(join(root, 'raw/paper_records', `${offset + index}.md`), '')
        )
      )
    }
    expect(await service.status({ arxivId: id })).toMatchObject({ status: 'unavailable' })
    await expect(service.open(id)).rejects.toThrow()
    expect(open).not.toHaveBeenCalled()
  }, 15_000)
})
