const { MongoClient } = require('mongodb')

function buildMongoUri() {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI
  }
  if (process.env.MONGO_USER && process.env.MONGO_PASS) {
    const user = encodeURIComponent(process.env.MONGO_USER)
    const pass = encodeURIComponent(process.env.MONGO_PASS)
    const host = process.env.MONGO_HOST || '188.225.83.49'
    const port = process.env.MONGO_PORT || '27017'
    const db = process.env.MONGO_DB || 'default_db'
    return `mongodb://${user}:${pass}@${host}:${port}/${db}?authSource=admin&directConnection=true`
  }
  return null
}

const MONGODB_URI = buildMongoUri()
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI or MONGO_USER+MONGO_PASS not set')
  process.exit(1)
}

console.log('[mongo] Using URI:', MONGODB_URI.substring(0, 40) + '...')

let client = null
let db = null

async function getDb() {
  if (!client) {
    client = new MongoClient(MONGODB_URI, { directConnection: true })
    await client.connect()
    db = client.db()
    console.log('[mongo] Connected')
  }
  return db
}

// Collections
function groups() { return db.collection('groups') }
function posts() { return db.collection('posts') }
function scanState() { return db.collection('scanState') }
function scannerStats() { return db.collection('scannerStats') }

// === REPLACES firebaseGet('groups') ===
async function loadGroups() {
  const docs = await groups().find({}).toArray()
  return docs.map(d => d.url)
}

// === REPLACES firebaseGet('posts') ===
async function loadAllPosts() {
  const docs = await posts().find({}).toArray()
  const map = new Map()
  for (const doc of docs) {
    map.set(doc._id, doc)
  }
  return map
}

// === REPLACES firebaseGet('scanState') ===
async function loadScanState() {
  const docs = await scanState().find({}).toArray()
  const map = {}
  for (const doc of docs) {
    map[doc._id] = { maxId: doc.maxId, updatedAt: doc.updatedAt }
  }
  return map
}

// === REPLACES firebasePatch('posts', updates) ===
async function savePosts(postsArray) {
  if (postsArray.length === 0) return
  const ops = postsArray.map(p => ({
    replaceOne: {
      filter: { _id: p.id },
      replacement: { ...p, _id: p.id, createdAt: p.createdAt || Date.now() },
      upsert: true
    }
  }))
  await posts().bulkWrite(ops)
}

// === REPLACES firebasePatch('scanState', updates) ===
async function saveScanState(updates) {
  const ops = Object.entries(updates).map(([domain, data]) => ({
    updateOne: {
      filter: { _id: domain },
      update: { $set: { maxId: data.maxId, updatedAt: data.updatedAt } },
      upsert: true
    }
  }))
  if (ops.length > 0) {
    await scanState().bulkWrite(ops)
  }
}

// === REPLACES firebasePatch('scannerStats', stats) ===
async function saveStats(stats) {
  await scannerStats().updateOne(
    { _id: 'current' },
    { $set: { ...stats, updatedAt: Date.now() } },
    { upsert: true }
  )
}

async function getStats() {
  return scannerStats().findOne({ _id: 'current' })
}

async function getPostCount() {
  return posts().countDocuments()
}

async function getRecentPosts(limit = 20) {
  return posts().find({}).sort({ createdAt: -1 }).limit(limit).toArray()
}

module.exports = {
  getDb,
  loadGroups,
  loadAllPosts,
  loadScanState,
  savePosts,
  saveScanState,
  saveStats,
  getStats,
  getPostCount,
  getRecentPosts,
}
