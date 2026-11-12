import Reporter from '~/orca/workspaces/TheRSS/Engineer/e2e/support/sidebarTraceArchiveReporter.ts'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
process.chdir('$SCRATCH/reporter-check')
const r = new Reporter()
const body = (id: string, dir: string) =>
  Buffer.from(JSON.stringify({ correlationId: id, trace: { archiveDirectory: dir } }))
const test = { title: 'fake' } as never
const run = (label: string, result: object) => {
  try {
    r.onTestEnd(test, result as never)
    console.log(label, 'no-throw')
  } catch (e) {
    console.log(label, 'THREW', e)
  }
}
writeFileSync(
  'test-results/sidebar-diagnostics/d1/diagnostics.json',
  JSON.stringify({ correlationId: 'id-1' })
)
run('invalid-json', {
  status: 'failed',
  attachments: [{ name: 'sidebar-diagnostics', body: Buffer.from('{') }]
})
run('outside-root', {
  status: 'failed',
  attachments: [{ name: 'sidebar-diagnostics', body: body('x', '../../etc') }]
})
run('record-missing', {
  status: 'failed',
  attachments: [
    { name: 'sidebar-diagnostics', body: body('id-2', 'test-results/sidebar-diagnostics/d2') },
    { name: 'trace', path: '/nonexistent/trace.zip' }
  ]
})
run('source-missing', {
  status: 'failed',
  attachments: [
    { name: 'sidebar-diagnostics', body: body('id-1', 'test-results/sidebar-diagnostics/d1') },
    { name: 'trace', path: '/nonexistent/trace.zip' }
  ]
})
run('status-exists', {
  status: 'failed',
  attachments: [
    { name: 'sidebar-diagnostics', body: body('id-1', 'test-results/sidebar-diagnostics/d1') }
  ]
})
console.log('d1', readFileSync('test-results/sidebar-diagnostics/d1/trace-archive.json', 'utf8'))
console.log(
  'd2 status',
  existsSync('test-results/sidebar-diagnostics/d2/trace-archive.json')
    ? readFileSync('test-results/sidebar-diagnostics/d2/trace-archive.json', 'utf8')
    : 'none'
)
