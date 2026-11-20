#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

const REPO_ROOT = process.cwd()
const ROSTER_PATH = resolve(REPO_ROOT, '.agents/team/roster.json')

function loadRoster() {
  return JSON.parse(readFileSync(ROSTER_PATH, 'utf8'))
}

function parseArgs(argv) {
  const args = {
    list: false,
    dryRun: false,
    keepOpen: null,
    role: null,
    taskFile: null,
    spec: null,
    name: null,
    worktree: null,
    runId: null,
    crossFamilyFor: null,
    show: null
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    switch (token) {
      case '--list':
        args.list = true
        break
      case '--dry-run':
        args.dryRun = true
        break
      case '--keep-open':
        args.keepOpen = true
        break
      case '--no-keep-open':
        args.keepOpen = false
        break
      case '--role':
        args.role = argv[++i] ?? null
        break
      case '--show':
        args.show = argv[++i] ?? null
        break
      case '--task-file':
        args.taskFile = argv[++i] ?? null
        break
      case '--spec':
        args.spec = argv[++i] ?? null
        break
      case '--name':
        args.name = argv[++i] ?? null
        break
      case '--worktree':
        args.worktree = argv[++i] ?? null
        break
      case '--run':
        args.runId = argv[++i] ?? null
        break
      case '--cross-family-for':
        args.crossFamilyFor = argv[++i] ?? null
        break
      case '--help':
      case '-h':
        printUsage()
        process.exit(0)
        break
      default:
        throw new Error(`Unknown argument: ${token}`)
    }
  }
  return args
}

function printUsage() {
  const lines = [
    'Usage:',
    '  node .agents/team/dispatch.mjs --list',
    '  node .agents/team/dispatch.mjs --show <role-id>',
    '  node .agents/team/dispatch.mjs --role <role-id> (--task-file <path> | --spec "<text>")',
    '      [--worktree name:<role>|current|new-child] [--name <short-name>]',
    '      [--run <run-id>] [--cross-family-for <author-role-id>]',
    '      [--keep-open|--no-keep-open] [--dry-run]'
  ]
  process.stdout.write(`${lines.join('\n')}\n`)
}

function resolveOrcaExecutable() {
  if (process.env.ORCA_CLI_COMMAND) {
    return process.env.ORCA_CLI_COMMAND
  }
  if (process.env.ORCA_DEV_REPO_ROOT) {
    return 'orca-dev'
  }
  return 'orca'
}

function resolveLaunchConfig(roster, role, crossFamilyFor) {
  let agent = role.agent
  let model = role.model
  let effort = role.effort
  let displayModel = role.displayModel
  let fallbackApplied = false

  if (crossFamilyFor && role.crossFamilyFallback) {
    const authorRole = roster.roles.find((entry) => entry.id === crossFamilyFor)
    if (!authorRole) {
      throw new Error(`Unknown --cross-family-for role: ${crossFamilyFor}`)
    }
    if (authorRole.agent === role.crossFamilyFallback.whenAuthorAgent) {
      agent = role.crossFamilyFallback.agent
      model = role.crossFamilyFallback.model
      effort = role.crossFamilyFallback.effort
      displayModel = role.crossFamilyFallback.displayModel
      fallbackApplied = true
    }
  }

  return { agent, model, effort, displayModel, fallbackApplied }
}

function formatRoleTable(roster) {
  const header =
    'ROLE ID                  | AGENT       | MODEL (EFFORT)                  | WORKTREE'
  const divider = '-'.repeat(header.length)
  const rows = roster.roles.map((role) => {
    const modelLabel = role.effort ? `${role.model} (${role.effort})` : role.model
    return [
      role.id.padEnd(24),
      role.agent.padEnd(11),
      modelLabel.padEnd(31),
      role.worktreePolicy
    ].join(' | ')
  })
  return [header, divider, ...rows].join('\n')
}

function buildComposedSpec(role, taskContent) {
  const charterPath = resolve(REPO_ROOT, role.charter)
  const charterContent = readFileSync(charterPath, 'utf8').trim()
  return [charterContent, '', '---', '', '# Assigned Task', '', taskContent.trim(), ''].join('\n')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const roster = loadRoster()

  if (args.list) {
    process.stdout.write(`${formatRoleTable(roster)}\n`)
    return
  }

  if (args.show) {
    const role = roster.roles.find((entry) => entry.id === args.show)
    if (!role) {
      throw new Error(`Unknown role: ${args.show}`)
    }
    process.stdout.write(`${JSON.stringify(role, null, 2)}\n`)
    return
  }

  if (!args.role) {
    printUsage()
    process.exitCode = 1
    return
  }

  const role = roster.roles.find((entry) => entry.id === args.role)
  if (!role) {
    throw new Error(`Unknown role: ${args.role}`)
  }

  const taskContent = args.taskFile
    ? readFileSync(resolve(REPO_ROOT, args.taskFile), 'utf8')
    : args.spec

  if (!taskContent || !taskContent.trim()) {
    throw new Error('Provide either --task-file <path> or --spec "<text>".')
  }

  const launch = resolveLaunchConfig(roster, role, args.crossFamilyFor)
  const worktree = args.worktree ?? role.worktreePolicy
  const runId = args.runId ?? roster.orchestrationRunId ?? null
  const keepOpen = args.keepOpen ?? Boolean(role.keepOpen)
  const orcaExe = resolveOrcaExecutable()
  const reuseDispatchId = !launch.fallbackApplied && !args.worktree ? role.activeDispatchId : null

  if (reuseDispatchId) {
    const subject = `Task for ${role.id}`
    const sendArgs = [
      'orchestration',
      'send',
      '--to',
      `dispatch:${reuseDispatchId}`,
      '--subject',
      subject,
      '--body',
      taskContent.trim(),
      '--json'
    ]
    if (args.dryRun) {
      const summary = {
        mode: 'reuse-dispatch',
        role: role.id,
        dispatchId: reuseDispatchId,
        displayModel: launch.displayModel,
        command: [orcaExe, ...sendArgs]
      }
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
      return
    }
    const result = spawnSync(orcaExe, sendArgs, { stdio: 'inherit' })
    if (result.error) {
      throw result.error
    }
    process.exitCode = result.status ?? 1
    return
  }

  const specDir = mkdtempSync(join(tmpdir(), 'therss-dispatch-'))
  const composedSpecPath = join(specDir, `${role.id}.md`)
  writeFileSync(composedSpecPath, buildComposedSpec(role, taskContent), 'utf8')

  const orcaArgs = [
    'orchestration',
    'worker-start',
    '--spec-file',
    composedSpecPath,
    '--worktree',
    worktree,
    '--agent',
    launch.agent,
    '--model',
    launch.model
  ]

  if (runId) {
    orcaArgs.push('--run', runId)
  }
  if (launch.effort) {
    orcaArgs.push('--effort', launch.effort)
  }
  if (worktree === 'new-child' || worktree === 'new-top-level') {
    orcaArgs.push('--name', args.name ?? role.id)
  }
  if (keepOpen) {
    orcaArgs.push('--keep-open')
  }

  if (args.dryRun) {
    const summary = {
      role: role.id,
      runId,
      worktree,
      displayModel: launch.displayModel,
      crossFamilyFallbackApplied: launch.fallbackApplied,
      composedSpecPath,
      command: [orcaExe, ...orcaArgs]
    }
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
    return
  }

  const result = spawnSync(orcaExe, orcaArgs, { stdio: 'inherit' })
  if (result.error) {
    throw result.error
  }
  process.exitCode = result.status ?? 1
}

try {
  main()
} catch (error) {
  process.stderr.write(
    `dispatch error: ${error instanceof Error ? error.message : String(error)}\n`
  )
  process.exitCode = 1
}
