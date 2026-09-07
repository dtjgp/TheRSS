/** Verify safeStorage in the real application identity with disposable app data. */
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { _electron as electron } from '@playwright/test'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const profile = await mkdtemp(join(tmpdir(), 'therss-credential-smoke-'))
const application = await electron.launch({
  args: [`--user-data-dir=${profile}`, project],
  env: { ...process.env, THERSS_E2E_FIXTURES: '1' },
  timeout: 30000
})
try {
  await application.firstWindow()
  const result = await application.evaluate(({ app, safeStorage }, expectedProfile) => {
    const { realpathSync } = process.getBuiltinModule('node:fs')
    const { Buffer } = process.getBuiltinModule('node:buffer')
    if (realpathSync(app.getPath('userData')) !== realpathSync(expectedProfile))
      throw new Error('Credential smoke requires disposable app data')
    if (!safeStorage.isEncryptionAvailable())
      throw new Error('OS-backed safeStorage is unavailable')
    const sample = ['TheRSS', 'credential', 'smoke'].join('-')
    const ciphertext = safeStorage.encryptString(sample)
    return {
      plaintextAbsent: !ciphertext.includes(Buffer.from(sample, 'utf8')),
      roundTrip: safeStorage.decryptString(ciphertext) === sample
    }
  }, profile)
  assert.deepEqual(result, { plaintextAbsent: true, roundTrip: true })
  process.stdout.write('TheRSS application safeStorage encryption round trip passed\n')
} finally {
  await application.close()
}
