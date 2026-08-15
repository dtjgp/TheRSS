import { log } from 'node:console'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { execPath } from 'node:process'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function run(command, args) {
  execFileSync(command, args, { cwd: projectRoot, stdio: 'inherit' })
}

const worktreeStatus = execFileSync('git', ['status', '--porcelain'], {
  cwd: projectRoot,
  encoding: 'utf8'
})
if (worktreeStatus.trim()) {
  throw new Error('Refusing to update a dirty worktree. Commit or stash your changes first.')
}

log('Fast-forwarding the verified main branch…')
run('git', ['pull', '--ff-only'])
log('Restoring the locked dependency graph…')
run('npm', ['ci'])
log('Running release gates before replacement…')
run('npm', ['run', 'check'])
log('Building and installing the recoverable local beta…')
run('npm', ['run', 'install:local'])

log(`Update complete. Runtime used: ${execPath}`)
