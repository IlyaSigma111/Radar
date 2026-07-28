// JSON-хранилище на диске для test-scanner.js (CommonJS)
const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, 'data', 'test-db.json')

function ensureDir() {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readDb() {
  ensureDir()
  if (!fs.existsSync(DB_PATH)) {
    const empty = { groups: [], posts: {}, scanState: {}, scanMeta: { lastScan: 0 }, stats: {} }
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2), 'utf8')
    return empty
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
}

function writeDb(data) {
  ensureDir()
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8')
}

function loadGroups() {
  const db = readDb()
  return db.groups || []
}

function insertGroup(url) {
  const db = readDb()
  if (!db.groups.includes(url)) {
    db.groups.push(url)
    writeDb(db)
  }
}

function deleteGroup(url) {
  const db = readDb()
  db.groups = db.groups.filter(g => g !== url)
  // Also remove posts and scanState for this domain
  const domain = url.split('/').pop()
  if (domain) {
    for (const key of Object.keys(db.posts)) {
      if (key.includes(domain)) delete db.posts[key]
    }
    delete db.scanState[domain]
  }
  writeDb(db)
}

function loadAllPosts() {
  const db = readDb()
  return new Map(Object.entries(db.posts || {}))
}

function loadScanState() {
  const db = readDb()
  return db.scanState || {}
}

function savePosts(postsArray) {
  if (postsArray.length === 0) return
  const db = readDb()
  for (const p of postsArray) {
    db.posts[p.id] = { ...p, createdAt: p.createdAt || Date.now() }
  }
  writeDb(db)
}

function saveScanState(updates) {
  const db = readDb()
  for (const [domain, data] of Object.entries(updates)) {
    db.scanState[domain] = { maxId: data.maxId, updatedAt: data.updatedAt }
  }
  writeDb(db)
}

function saveStats(stats) {
  const db = readDb()
  db.stats = { ...stats, updatedAt: Date.now() }
  writeDb(db)
}

function getStats() {
  const db = readDb()
  return db.stats || null
}

function getScanMeta() {
  const db = readDb()
  return db.scanMeta || { lastScan: 0 }
}

function setScanMeta(meta) {
  const db = readDb()
  db.scanMeta = { ...db.scanMeta, ...meta }
  writeDb(db)
}

function getPostsCount() {
  const db = readDb()
  return Object.keys(db.posts || {}).length
}

module.exports = {
  loadGroups, insertGroup, deleteGroup,
  loadAllPosts, loadScanState, savePosts, saveScanState,
  saveStats, getStats, getScanMeta, setScanMeta, getPostsCount
}
