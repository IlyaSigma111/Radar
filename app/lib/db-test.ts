import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'test-db.json')

interface TestData {
  groups: string[]
  posts: Record<string, any>
  scanState: Record<string, { maxId: number; updatedAt: number }>
  scanMeta: { lastScan: number }
  stats: any
}

function ensureDir() {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readDb(): TestData {
  ensureDir()
  if (!fs.existsSync(DB_PATH)) {
    const empty: TestData = { groups: [], posts: {}, scanState: {}, scanMeta: { lastScan: 0 }, stats: {} }
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2), 'utf8')
    return empty
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
}

function writeDb(data: TestData) {
  ensureDir()
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8')
}

export async function getGroups(): Promise<string[]> {
  try {
    const db = readDb()
    return db.groups || []
  } catch {
    return []
  }
}

export async function insertGroup(url: string) {
  const db = readDb()
  if (!db.groups.includes(url)) {
    db.groups.push(url)
    writeDb(db)
  }
}

export async function deleteGroup(url: string) {
  const db = readDb()
  db.groups = db.groups.filter(g => g !== url)
  writeDb(db)
}

export async function getExistingPosts(): Promise<Map<string, any>> {
  const db = readDb()
  return new Map(Object.entries(db.posts || {}))
}

export async function getPostsCount(): Promise<number> {
  const db = readDb()
  return Object.keys(db.posts || {}).length
}

export async function getScanMeta(): Promise<{ lastScan?: number }> {
  const db = readDb()
  return db.scanMeta || { lastScan: 0 }
}

export async function getStats(): Promise<any> {
  const db = readDb()
  return db.stats || null
}

export async function insertPosts(posts: any[]) {
  if (posts.length === 0) return
  const db = readDb()
  for (const p of posts) {
    db.posts[p.id] = { ...p, createdAt: p.createdAt || Date.now() }
  }
  writeDb(db)
}

export async function deleteOldPosts(threshold: number) {
  const db = readDb()
  let count = 0
  for (const [id, post] of Object.entries(db.posts)) {
    if ((post.publishedAt || 0) < threshold) {
      delete db.posts[id]
      count++
    }
  }
  if (count > 0) writeDb(db)
}
