const m = require('./mongo.js')
;(async () => {
  try {
    await m.getDb()
    const db = await m.getDb()
    const count = await db.collection('posts').countDocuments({ publishedAt: { $exists: true } })
    console.log('Posts with publishedAt:', count)
    const groups = await db.collection('posts').distinct('name')
    console.log('Unique groups:', groups.length)
    groups.slice(0, 25).forEach(g => console.log('-', g))
    process.exit(0)
  } catch(e) { console.error(e); process.exit(1) }
})()
