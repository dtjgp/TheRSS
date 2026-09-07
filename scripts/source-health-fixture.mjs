/** Seed only the native smoke test's owned profile; no real sources or user data. */
import process from 'node:process'

export async function sourceHealthFixture(application, profile) {
  return application.evaluate(({ app }, expectedProfile) => {
    const { realpathSync } = process.getBuiltinModule('node:fs')
    const { join } = process.getBuiltinModule('node:path')
    const { createRequire } = process.getBuiltinModule('node:module')
    if (
      realpathSync(app.getPath('userData')) !== realpathSync(expectedProfile) ||
      !/therss-appkit-acceptance-/u.test(expectedProfile)
    )
      throw new Error('Source health fixture requires the owned isolated profile')
    const Database = createRequire(join(app.getAppPath(), 'package.json'))('better-sqlite3')
    const db = new Database(join(expectedProfile, 'therss.sqlite'))
    try {
      const observedAt = new Date(Date.now() + 5000).toISOString()
      const previous = db
        .prepare(
          'SELECT plan_json, provenance_json FROM discover_session ORDER BY created_at DESC LIMIT 1'
        )
        .get()
      if (!previous) throw new Error('Run a fixture search before recording source observations')
      db.transaction(() => {
        db.prepare('INSERT INTO discover_session VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          'source-health-fixture',
          'Synthetic status rendering fixture',
          'codex',
          'partial',
          previous.plan_json,
          previous.provenance_json,
          observedAt
        )
        for (const [source, status, error] of [
          [
            'folo:444',
            'failed',
            'Fixture: all twenty entries lacked a usable publication date. Existing cached items are retained.'
          ],
          ['folo:523', 'no_results', null],
          [
            'folo:611',
            'partial',
            'Fixture: seven entries lacked a publication month; the incomplete response does not establish an empty source.'
          ]
        ]) {
          db.prepare(
            "INSERT OR REPLACE INTO source_run VALUES (?, 'partial', '2026-08-19T16:25:12.190Z', 'Old fixture observation', 1)"
          ).run(source)
          db.prepare('INSERT INTO discover_source_run VALUES (?, ?, ?, 0, ?)').run(
            'source-health-fixture',
            source,
            status,
            error
          )
        }
      })()
      return observedAt
    } finally {
      db.close()
    }
  }, profile)
}
