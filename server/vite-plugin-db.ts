import type { Plugin } from 'vite'
import { mkdirSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'

export function dbPlugin(): Plugin {
  let db: Database.Database

  return {
    name: 'poe-tree-db',
    configureServer(server) {
      const dbDir = join(server.config.root, '.db')
      mkdirSync(dbDir, { recursive: true })

      db = new Database(join(dbDir, 'poe-tree.db'))
      db.pragma('journal_mode = WAL')
      db.exec(`
        CREATE TABLE IF NOT EXISTS builds (key TEXT PRIMARY KEY, data TEXT);
        CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT);
      `)

      const getBuilds = db.prepare('SELECT data FROM builds WHERE key = ?')
      const upsertBuilds = db.prepare(
        'INSERT INTO builds (key, data) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data',
      )
      const getAllPrefs = db.prepare('SELECT key, value FROM preferences')
      const upsertPref = db.prepare(
        'INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )

      server.middlewares.use('/.db/builds', (req, res) => {
        if (req.method === 'GET') {
          const row = getBuilds.get('all') as { data: string } | undefined
          res.setHeader('Content-Type', 'application/json')
          res.end(row?.data ?? '[]')
          return
        }
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => {
            body += chunk.toString()
          })
          req.on('end', () => {
            upsertBuilds.run('all', body)
            res.statusCode = 204
            res.end()
          })
          return
        }
        res.statusCode = 405
        res.end()
      })

      server.middlewares.use('/.db/preferences', (req, res) => {
        if (req.method === 'GET') {
          const rows = getAllPrefs.all() as { key: string; value: string }[]
          const obj: Record<string, string> = {}
          for (const row of rows) obj[row.key] = row.value
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(obj))
          return
        }
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => {
            body += chunk.toString()
          })
          req.on('end', () => {
            const obj = JSON.parse(body) as Record<string, string>
            const tx = db.transaction(() => {
              for (const [k, v] of Object.entries(obj)) {
                upsertPref.run(k, v)
              }
            })
            tx()
            res.statusCode = 204
            res.end()
          })
          return
        }
        res.statusCode = 405
        res.end()
      })
    },
  }
}
