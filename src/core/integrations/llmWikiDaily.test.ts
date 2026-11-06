import { mkdir, mkdtemp, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LlmWikiDaily } from './llmWikiDaily'

const roots: string[] = []
const date = '2026-11-06'
const id = '2611.08290'
const note = 'Literature/Paper_Notes/L2_Structured/Model_Compression/Liang_2026_部署 #1 & more.md'
const digestPath = (day: string) => `Inbox/Research_Feeds/ArXiv_Daily/ArXiv_Daily_${day}.md`
const frontmatter = (day: string, status = 'completed', selected = 1) =>
  `---\ntype: feed\nsource: arxiv\ndate: '${day}'\nrun_status: ${status}\nscanned: 566\nselected: ${selected}\n---\n`
const paper = (target = note, url = `https://arxiv.org/abs/${id}v2`) =>
  `### 1. Hardware-Guided Model Compression — 10/10 direct\n\n` +
  `| arXiv / categories | [${id}](${url}) / cs.LG, cs.AI |\n` +
  `- ModelCompress angle: Match deployment constraints.\n` +
  `- L2: [[${target}]]\n`
const digest = (day = date, section = paper()) =>
  `${frontmatter(day)}\n# ArXiv Daily\n\n## Selected papers\n\n${section}\n## Ledger\n\nIgnored prose.`

async function put(root: string, path: string, content: string) {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), content)
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'therss-daily-'))
  roots.push(root)
  await put(root, 'AGENTS.md', '# Rules')
  await put(root, '_schema.md', '# Schema')
  await mkdir(join(root, dirname(digestPath(date))), { recursive: true })
  const openExternal = vi.fn(async (_url: string) => undefined)
  const service = new LlmWikiDaily({
    vaultRoot: root,
    openExternal,
    now: () => new Date(2026, 10, 6, 12)
  })
  return { root, openExternal, service }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('llm-wiki Daily Papers', () => {
  it('projects the dated selection and opens the exact validated Obsidian targets', async () => {
    const { root, service, openExternal } = await fixture()
    await put(root, digestPath(date), digest())
    await put(root, note, `---\ntype: paper-note\narxiv_id: '${id}'\n---\nprivate body`)
    const snapshot = await service.snapshot()
    expect(snapshot).toMatchObject({
      requestedDate: date,
      status: 'completed',
      edition: {
        date,
        selected: 1,
        scanned: 566,
        papers: [
          {
            arxivId: id,
            title: 'Hardware-Guided Model Compression',
            priority: 'direct',
            score: 10,
            reason: 'Match deployment constraints.',
            canOpenNote: true
          }
        ]
      }
    })
    expect(JSON.stringify(snapshot)).not.toMatch(/private body|Literature\/|Ignored prose/u)
    expect(await service.open({ date, arxivId: id })).toEqual({ opened: true })
    expect(await service.open({ date })).toEqual({ opened: true })
    const paths = await Promise.all(
      [note, digestPath(date)].map(async (path) => join(await realpath(root), path))
    )
    expect(
      openExternal.mock.calls.map(([raw]) => {
        const url = new URL(raw)
        expect(url.protocol).toBe('obsidian:')
        expect(url.hostname).toBe('open')
        expect(url.searchParams.size).toBe(1)
        return url.searchParams.get('path')
      })
    ).toEqual(paths)
  })

  it('uses only the nearest earlier edition within fourteen days when today is absent', async () => {
    const { root, service, openExternal } = await fixture()
    await put(root, digestPath('2026-10-22'), digest('2026-10-22'))
    expect(await service.snapshot()).toMatchObject({
      requestedDate: date,
      status: 'missing',
      edition: null
    })
    await put(root, digestPath('2026-10-23'), digest('2026-10-23'))
    expect(await service.snapshot()).toMatchObject({
      status: 'completed',
      edition: { date: '2026-10-23' }
    })
    await put(root, digestPath('2026-11-04'), digest('2026-11-04'))
    expect(await service.snapshot()).toMatchObject({
      requestedDate: date,
      status: 'completed',
      edition: { date: '2026-11-04' }
    })
    await expect(service.open({ date: '2026-10-23' })).rejects.toThrow()
    expect(openExternal).not.toHaveBeenCalled()
    await put(root, digestPath(date), 'not a supported edition')
    expect(await service.snapshot()).toMatchObject({ status: 'unavailable', edition: null })
    await expect(service.open({ date: '2026-11-04' })).rejects.toThrow()
  })

  it.each([
    ['partial', 'partial'],
    ['no-source', 'no-source'],
    ['completed', 'no-results']
  ])('distinguishes %s with zero selected from missing', async (runStatus, status) => {
    const { root, service } = await fixture()
    await put(root, digestPath(date), frontmatter(date, runStatus, 0))
    expect(await service.snapshot()).toMatchObject({
      status,
      edition: { date, selected: 0, papers: [] }
    })
  })

  it('does not present a prior-day source snapshot as coverage of the partial edition', async () => {
    const { root, service } = await fixture()
    await put(
      root,
      digestPath(date),
      frontmatter(date, 'partial', 0).replace(
        'scanned: 566',
        'scanned: 609\nscanned_scope: latest-visible-prior-day-ID-title-snapshot'
      )
    )
    expect(await service.snapshot()).toMatchObject({
      status: 'partial',
      edition: { date, selected: 0, scanned: null }
    })
  })

  it.each([
    ['duplicate IDs', digest(date, `${paper()}${paper()}`).replace('selected: 1', 'selected: 2')],
    ['miscounted shortlist', digest(date, `${paper()}${paper()}`)],
    ['spoofed URL', digest(date, paper(note, `https://arxiv.org.evil.example/abs/${id}`))],
    ['arXiv URL with query', digest(date, paper(note, `https://arxiv.org/abs/${id}?injected=yes`))],
    ['invalid score', digest().replace('10/10 direct', '11/10 direct')],
    ['misdated edition', digest('2026-11-07')],
    ['unknown run status', digest().replace('run_status: completed', 'run_status: running')],
    ['invalid coverage count', digest().replace('scanned: 566', 'scanned: -1')],
    ['duplicate scalar', digest().replace('selected: 1', 'selected: 1\nselected: 1')]
  ])('rejects an edition with %s', async (_issue, content) => {
    const { root, service } = await fixture()
    await put(root, digestPath(date), content)
    expect(await service.snapshot()).toMatchObject({ status: 'unavailable', edition: null })
    await expect(service.open({ date })).rejects.toThrow('unavailable')
  })

  it('projects a paper with no reported score or relevance explanation', async () => {
    const { root, service } = await fixture()
    const section = paper()
      .replace(' — 10/10 direct', '')
      .replace('- ModelCompress angle: Match deployment constraints.\n', '')
      .replace('Hardware-Guided Model Compression', `[[${note}|Paper title]]`)
    await put(root, digestPath(date), digest(date, section).replace('scanned: 566\n', ''))
    expect(await service.snapshot()).toMatchObject({
      status: 'completed',
      edition: {
        scanned: null,
        papers: [
          { arxivId: id, title: 'Paper title', priority: 'unclassified', score: null, reason: null }
        ]
      }
    })
  })

  it('groups by declared priority and keeps the original order within each group', async () => {
    const { root, service } = await fixture()
    const section = [
      ['2611.10001', '5/10 adjacent'],
      ['2611.10002', '8/10 direct'],
      ['2611.10003', '2/10 weak'],
      ['2611.10004', '10/10 direct']
    ]
      .map(([arxivId, priority], index) =>
        paper()
          .replace('### 1.', `### ${index + 1}.`)
          .replaceAll(id, arxivId!)
          .replace('10/10 direct', priority!)
      )
      .join('\n')
    await put(root, digestPath(date), digest(date, section).replace('selected: 1', 'selected: 4'))
    expect((await service.snapshot()).edition?.papers.map(({ arxivId }) => arxivId)).toEqual([
      '2611.10002',
      '2611.10004',
      '2611.10001',
      '2611.10003'
    ])
  })

  it('retains the paper if its note is unsafe, missing or no longer matches', async () => {
    const { root, service, openExternal } = await fixture()
    await put(
      root,
      digestPath(date),
      digest(date, paper('Literature/Paper_Notes/L2_Structured/../private.md'))
    )
    expect((await service.snapshot()).edition?.papers[0]?.canOpenNote).toBe(false)
    await put(root, digestPath(date), digest())
    expect((await service.snapshot()).edition?.papers[0]?.canOpenNote).toBe(false)
    await put(root, note, `---\narxiv_id: ${id}\n---\n`)
    expect((await service.snapshot()).edition?.papers[0]?.canOpenNote).toBe(true)
    await put(root, note, '---\narxiv_id: 2611.99999\n---\n')
    await expect(service.open({ date, arxivId: id })).rejects.toThrow()
    await put(root, note, `---\narxiv_id: ${id}\n${'x'.repeat(16_384)}\n---\n`)
    expect((await service.snapshot()).edition?.papers[0]?.canOpenNote).toBe(false)
    await unlink(join(root, note))
    await symlink(join(root, '_schema.md'), join(root, note))
    await expect(service.open({ date, arxivId: id })).rejects.toThrow()
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('rejects symlinks and bounded data violations without falling back', async () => {
    const { root, service } = await fixture()
    await put(root, digestPath('2026-11-05'), digest('2026-11-05'))
    await symlink(join(root, digestPath('2026-11-05')), join(root, digestPath(date)))
    expect(await service.snapshot()).toMatchObject({ status: 'unavailable', edition: null })
    await unlink(join(root, digestPath(date)))
    await put(root, digestPath(date), digest() + 'x'.repeat(2_000_000))
    expect(await service.snapshot()).toMatchObject({ status: 'unavailable', edition: null })
  })

  it('validates open requests and reports Obsidian launch failures without exposing paths', async () => {
    const { root, service, openExternal } = await fixture()
    await put(root, digestPath(date), digest())
    await expect(service.open({ date: '../secret' })).rejects.toThrow()
    await expect(service.open({ date, path: note } as never)).rejects.toThrow()
    expect(openExternal).not.toHaveBeenCalled()
    openExternal.mockRejectedValueOnce(new Error(root))
    await expect(service.open({ date })).rejects.toThrow('Obsidian could not be opened')
  })
})
