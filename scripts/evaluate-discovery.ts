import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { log } from 'node:console'
import { ResearchRepository } from '../src/core/storage/researchRepository'
import { LocalAgentService } from '../src/core/agents/localAgentService'
import { DiscoverPlannerService } from '../src/core/discover/discoverPlanner'
import { DiscoverService } from '../src/core/discover/discoverService'
import { AnalysisService } from '../src/core/analysis/analysisService'
import { ProviderService } from '../src/core/models/providerService'
import { fetchGitHubRadarItems } from '../src/core/sources/github/githubClient'
import { hashAnalysisSource } from '../src/core/analysis/sourceSnapshot'
import { buildAnalysisPrompt } from '../src/core/models/modelGateway'
import { DISCOVERY_QUALITY_CASES } from '../src/core/evaluation/qualityCases'
import {
  evaluateDiscoveryQuality,
  qualityJudgmentSchema
} from '../src/core/evaluation/discoveryQuality'
import type { DiscoverSnapshot } from '../src/shared/discover'
import type { LocalAgentRunner } from '../src/shared/models'

interface RunEntry {
  caseId: string
  runner: LocalAgentRunner
  status: string
  file?: string
  sha256?: string
  error?: string
  elapsedMs?: number
}
interface Manifest {
  version: 1
  startedAt: string
  publicCasesSha256: string
  runs: RunEntry[]
  analyses: Array<Record<string, unknown>>
}
const { values } = parseArgs({
  options: {
    phase: { type: 'string', default: 'plan' },
    live: { type: 'boolean', default: false },
    out: { type: 'string' },
    labels: { type: 'string' }
  }
})
const phase = values.phase!
if (!['plan', 'search', 'analyze', 'report'].includes(phase))
  throw new Error('Expected phase plan, search, analyze or report')
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
const caseHash = digest(JSON.stringify(DISCOVERY_QUALITY_CASES))
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runners: readonly LocalAgentRunner[] = ['codex', 'claude']
const output = resolve(
  values.out ??
    join('test-results', 'source-quality', new Date().toISOString().replaceAll(/[:.]/gu, '-'))
)
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
if (phase === 'plan') {
  log(
    json({
      cases: DISCOVERY_QUALITY_CASES,
      runners,
      selectedSources: ['arxiv', 'github'],
      maximumPlanningCalls: 6,
      maximumAnalysisCalls: 4,
      note: 'Use --phase search --live --out NEW_DIRECTORY, then --phase analyze --live --out SAME_DIRECTORY. Report is offline. No paid API provider or private Personal Prompt is used.'
    })
  )
  process.exit(0)
}
if ((phase === 'search' || phase === 'analyze') && !values.live)
  throw new Error('Live source and existing-account calls require --live')
const manifestPath = join(output, 'manifest.json')
const ledger = (event: unknown) =>
  appendFile(
    join(output, 'attempts.jsonl'),
    JSON.stringify({ at: new Date().toISOString(), ...(event as object) }) + '\n'
  )
const saveManifest = (value: Manifest) => writeFile(manifestPath, json(value))
async function recordSourceInputs() {
  const files: Array<{ path: string; sha256: string }> = []
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        files.push({ path: relative(project, path), sha256: digest(await readFile(path)) })
      }
    }
  }
  await visit(join(project, 'src/core'))
  await visit(join(project, 'src/shared'))
  for (const path of ['scripts/evaluate-discovery.ts', 'package-lock.json'])
    files.push({ path, sha256: digest(await readFile(join(project, path))) })
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'))
  await writeFile(
    join(output, `source-inputs-${phase}.json`),
    json({
      capturedAt: new Date().toISOString(),
      node: process.version,
      sha256: digest(files.map((file) => `${file.path}\0${file.sha256}\n`).join('')),
      files
    }),
    { flag: 'wx' }
  )
}
let manifest: Manifest
if (phase === 'search') {
  await mkdir(output, { recursive: true })
  manifest = {
    version: 1,
    startedAt: new Date().toISOString(),
    publicCasesSha256: caseHash,
    runs: [],
    analyses: []
  }
  await writeFile(manifestPath, json(manifest), { flag: 'wx' })
} else {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
  if (manifest.version !== 1 || manifest.publicCasesSha256 !== caseHash || manifest.runs.length > 6)
    throw new Error('This is not the matching bounded public-case manifest')
}
async function readRun(entry: RunEntry): Promise<DiscoverSnapshot> {
  if (!entry.file || basename(entry.file) !== entry.file || !entry.sha256)
    throw new Error('Invalid local run reference')
  const content = await readFile(join(output, entry.file), 'utf8')
  if (digest(content) !== entry.sha256) throw new Error('The captured run changed after retrieval')
  const snapshot = JSON.parse(content) as DiscoverSnapshot
  const query = DISCOVERY_QUALITY_CASES.find((query) => query.id === entry.caseId)
  if (!query || snapshot.intent !== query.intent || snapshot.runner !== entry.runner)
    throw new Error('Unexpected query or runner in captured public run')
  return snapshot
}

if (phase === 'report') {
  const labels = values.labels
    ? (JSON.parse(await readFile(resolve(values.labels), 'utf8')) as Record<string, unknown>)
    : {}
  const results = []
  for (const entry of manifest.runs) {
    if (!entry.file) {
      results.push(entry)
      continue
    }
    const snapshot = await readRun(entry)
    const judgments = qualityJudgmentSchema
      .array()
      .parse(labels[`${entry.caseId}:${entry.runner}`] ?? [])
    results.push({
      caseId: entry.caseId,
      runner: entry.runner,
      elapsedMs: entry.elapsedMs,
      metrics: evaluateDiscoveryQuality(snapshot, judgments),
      sourceOutcomes: snapshot.sourceOutcomes,
      top10: snapshot.items.slice(0, 10).map((item, index) => ({
        rank: index + 1,
        id: item.id,
        title: item.title,
        url: item.url,
        sourceHash: hashAnalysisSource({ ...item, triageState: 'new' })
      }))
    })
  }
  await writeFile(
    join(output, 'quality-report.json'),
    json({
      createdAt: new Date().toISOString(),
      results,
      analyses: manifest.analyses,
      boundary:
        'Wall time includes anonymous GitHub pacing. Human precision requires complete human labels; recall is not measured.'
    })
  )
  log(json({ report: join(output, 'quality-report.json'), runs: results.length }))
  process.exit(0)
}

const workDirectory = join(output, 'cli-work')
if (phase === 'analyze' && manifest.analyses.length)
  throw new Error(
    'Analysis phase already attempted; inspect its ledger before authorizing any retry'
  )
await recordSourceInputs()
await mkdir(workDirectory, { recursive: true })
const agents = new LocalAgentService({ workingDirectory: workDirectory })
const repository = new ResearchRepository(new Database(join(output, 'evaluation.sqlite')))
const unavailable = () => {
  throw new Error('This benchmark has no model API provider or credential storage')
}
const providers = new ProviderService(repository, {
  isAvailable: () => false,
  encrypt: unavailable,
  decrypt: unavailable
})
const analyzer = new AnalysisService(
  repository,
  providers,
  unavailable,
  agents.analyze.bind(agents)
)
try {
  if (phase === 'search') {
    const blockedRunners = new Set<LocalAgentRunner>()
    let planningCalls = 0
    let nextGithubRequest = 0
    const pacedFetch: typeof fetch = async (input, init) => {
      const wait = Math.max(0, nextGithubRequest - Date.now())
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
      init?.signal?.throwIfAborted()
      nextGithubRequest = Date.now() + 7000
      return fetch(input, init)
    }
    const planner = new DiscoverPlannerService({
      getModelProfile: unavailable,
      planWithModel: unavailable,
      planWithLocalAgent: async (prompt, runner, signal) => {
        if (++planningCalls > 6) throw new Error('Planning call budget exceeded')
        await ledger({
          stage: 'planning',
          runner,
          attempt: planningCalls,
          promptSha256: digest(prompt),
          started: true
        })
        return agents.planDiscovery(prompt, runner, signal)
      }
    })
    const discover = new DiscoverService({
      planner,
      repository,
      fetchGitHub: (interest, options) =>
        fetchGitHubRadarItems(interest, { ...options, fetcher: pacedFetch })
    })
    const statuses = await agents.getStatuses()
    for (const query of DISCOVERY_QUALITY_CASES)
      for (const runner of runners) {
        const entry: RunEntry = { caseId: query.id, runner, status: 'started' }
        manifest.runs.push(entry)
        if (
          blockedRunners.has(runner) ||
          !statuses.find((status) => status.runner === runner)?.available
        ) {
          entry.status = 'not_run'
          entry.error = 'Runner unavailable or earlier planner failure requires diagnosis'
          await saveManifest(manifest)
          continue
        }
        const started = Date.now()
        await ledger({ stage: 'search', caseId: query.id, runner, started: true })
        try {
          const snapshot = await discover.search(
            { intent: query.intent, sources: ['arxiv', 'github'], runner },
            { signal: AbortSignal.timeout(180_000) }
          )
          const file = `${query.id}-${runner}.json`,
            body = json(snapshot)
          await writeFile(join(output, file), body, { flag: 'wx' })
          Object.assign(entry, {
            status: snapshot.status,
            file,
            sha256: digest(body),
            elapsedMs: Date.now() - started
          })
          log(
            json({
              caseId: query.id,
              runner,
              status: snapshot.status,
              count: snapshot.items.length,
              elapsedMs: entry.elapsedMs
            })
          )
        } catch (error) {
          entry.status = 'failed'
          entry.error = error instanceof Error ? error.message : 'Unknown failure'
          blockedRunners.add(runner)
          log(json({ caseId: query.id, runner, status: entry.status, error: entry.error }))
        }
        await ledger({ stage: 'search', ...entry, completed: true })
        await saveManifest(manifest)
      }
  } else {
    const selections = [
      ['structured-pruning', 'codex', 'paper'],
      ['structured-pruning', 'claude', 'repository'],
      ['energy-aware-training', 'codex', 'paper'],
      ['residential-demand-response', 'claude', 'paper']
    ] as const
    for (const [caseId, runner, kind] of selections) {
      const entry = manifest.runs.find(
        (entry) => entry.caseId === caseId && entry.runner === runner && entry.file
      )
      const attempt: Record<string, unknown> = { caseId, runner, kind, status: 'started' }
      manifest.analyses.push(attempt)
      await saveManifest(manifest)
      if (!entry) {
        attempt.status = 'not_run'
        continue
      }
      const snapshot = await readRun(entry),
        item = snapshot.items.find((item) => item.kind === kind)
      if (!item) {
        attempt.status = 'not_run'
        continue
      }
      repository.saveDiscoverResult(snapshot.id, item.id)
      const source = repository.getDiscoveryItem(item.id)!
      const prompt = buildAnalysisPrompt(source)
      await ledger({
        stage: 'analysis',
        caseId,
        runner,
        itemId: item.id,
        promptSha256: digest(prompt),
        started: true
      })
      try {
        const artifact = await analyzer.analyzeItem(item.id, { runner })
        const file = `${caseId}-${runner}-analysis.json`,
          body = json({ source, artifact, promptSha256: digest(prompt) })
        await writeFile(join(output, file), body, { flag: 'wx' })
        Object.assign(attempt, {
          status: 'completed',
          itemId: item.id,
          file,
          sha256: digest(body),
          sourceHash: artifact.sourceHash,
          promptVersion: artifact.promptVersion
        })
      } catch (error) {
        attempt.status = 'failed'
        attempt.error = error instanceof Error ? error.message : 'Unknown failure'
      }
      await ledger({ stage: 'analysis', ...attempt, completed: true })
      await saveManifest(manifest)
      log(json(attempt))
    }
  }
} finally {
  await saveManifest(manifest)
  repository.close()
}
log(json({ output, runs: manifest.runs.length, analysisAttempts: manifest.analyses.length }))
