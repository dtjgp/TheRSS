import { error as logError, log } from 'node:console'
import { Buffer } from 'node:buffer'
import { app, safeStorage } from 'electron'

app
  .whenReady()
  .then(() => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS-backed Electron safeStorage is unavailable')
    }

    const sample = ['TheRSS', 'credential', 'smoke'].join('-')
    const ciphertext = safeStorage.encryptString(sample)
    if (ciphertext.includes(Buffer.from(sample, 'utf8'))) {
      throw new Error('safeStorage returned plaintext-equivalent bytes')
    }
    if (safeStorage.decryptString(ciphertext) !== sample) {
      throw new Error('safeStorage round trip failed')
    }

    log('safeStorage encryption round trip passed')
    app.quit()
  })
  .catch((error) => {
    logError(error)
    app.exit(1)
  })
