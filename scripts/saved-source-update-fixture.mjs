/** Seed and inspect only the smoke test's isolated SQLite profile. No external calls. */
import process from 'node:process'

export async function savedSourceUpdateFixture(application, profile, seed = false) {
  return application.evaluate(
    async ({ app }, options) => {
      const { realpathSync } = process.getBuiltinModule('node:fs')
      const { join } = process.getBuiltinModule('node:path')
      const { createRequire } = process.getBuiltinModule('node:module')
      if (
        realpathSync(app.getPath('userData')) !== realpathSync(options.profile) ||
        !/therss-(?:appkit-acceptance|e2e)-/u.test(options.profile)
      )
        throw new Error('Snapshot fixture requires the owned isolated test profile')
      const Database = createRequire(join(app.getAppPath(), 'package.json'))('better-sqlite3')
      const db = new Database(join(options.profile, 'therss.sqlite'))
      try {
        const item = db
          .prepare(
            "SELECT * FROM discovery_item WHERE source='github' AND triage_state='saved' ORDER BY id LIMIT 1"
          )
          .get()
        if (!item) throw new Error('Save a fixture repository before preparing an update')
        const artifacts = db
          .prepare('SELECT * FROM analysis_artifact WHERE item_id=? ORDER BY id')
          .all(item.id)
        if (!artifacts.length) throw new Error('Analyze the fixture repository before updating')
        if (options.seed) {
          const source = db
            .prepare('SELECT * FROM discover_result WHERE item_id=? ORDER BY session_id LIMIT 1')
            .get(item.id)
          const session = db
            .prepare('SELECT * FROM discover_session WHERE id=?')
            .get(source.session_id)
          const insert = (table, row) => {
            const keys = Object.keys(row)
            db.prepare(
              `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`
            ).run(...Object.values(row))
          }
          db.transaction(() => {
            insert('discover_session', {
              ...session,
              id: 'saved-update-fixture',
              created_at: new Date(Date.now() + 1000).toISOString()
            })
            insert('discover_result', {
              ...source,
              session_id: 'saved-update-fixture',
              summary: 'Newer locally retrieved pruning metadata. Analysis history remains intact.',
              updated_at: new Date().toISOString()
            })
            const now = new Date()
            const month = new Date(
              Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
            ).toISOString()
            insert('discovery_item', {
              ...item,
              id: 'folo:611:paper:fixture-month',
              source: 'folo:611',
              item_kind: 'paper',
              external_id: 'fixture-month',
              title: 'Month-only publication fixture',
              summary: `《测试期刊》${now.getUTCFullYear()}年${now.getUTCMonth() + 1}月`,
              url: 'https://www.ncpssd.cn/',
              published_at: month,
              updated_at: month,
              triage_state: 'new'
            })
          })()
        }
        return { item, artifacts }
      } finally {
        db.close()
      }
    },
    { profile, seed }
  )
}
