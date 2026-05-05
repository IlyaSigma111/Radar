const m = require('./mongo.js')
;(async () => {
  try {
    await m.getDb()
    const db = await m.getDb()
    const result = await db.collection('posts').deleteMany({ publishedAt: { $exists: false } })
    console.log('Deleted old posts:', result.deletedCount)
    process.exit(0)
  } catch(e) { console.error(e); process.exit(1) }
})()
