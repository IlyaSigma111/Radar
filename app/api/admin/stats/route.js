import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { MongoClient } = require('mongodb')

  const user = encodeURIComponent(process.env.MONGO_USER || '')
  const pass = encodeURIComponent(process.env.MONGO_PASS || '')
  const host = process.env.MONGO_HOST || '188.225.83.49'
  const port = process.env.MONGO_PORT || '27017'
  const db = process.env.MONGO_DB || 'default_db'
  const uri = `mongodb://${user}:${pass}@${host}:${port}/${db}?authSource=admin&directConnection=true`

  const client = new MongoClient(uri)

  try {
    await client.connect()
    const database = client.db()

    const [statsDoc, groupsDocs, scanStateDocs, recentPosts] = await Promise.all([
      database.collection('scannerStats').findOne({ _id: 'current' }),
      database.collection('groups').find({}).toArray(),
      database.collection('scanState').find({}).toArray(),
      database.collection('posts').find({}).sort({ createdAt: -1 }).limit(20).toArray()
    ])

    const scanStateMap = {}
    for (const doc of scanStateDocs) {
      scanStateMap[doc._id] = { maxId: doc.maxId, updatedAt: doc.updatedAt }
    }

    const groups = groupsDocs.map(g => {
      const url = g.url
      let domain = ''
      try {
        domain = new URL(url.startsWith('http') ? url : 'https://' + url).pathname.split('/').filter(Boolean)[0]
      } catch {}

      const sg = statsDoc?.groups?.[domain]
      return {
        url,
        domain,
        name: domain,
        maxId: scanStateMap[domain]?.maxId || 0,
        updatedAt: scanStateMap[domain]?.updatedAt || 0,
        vkTime: sg?.vkTime,
        batches: sg?.batches,
        postsFound: sg?.postsFound,
        newPosts: sg?.newPosts,
        errors: sg?.errors
      }
    })

    return NextResponse.json({
      stats: statsDoc || {},
      postCount: recentPosts.length,
      groups,
      recentPosts
    })
  } catch (e) {
    console.error('Admin stats error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  } finally {
    await client.close()
  }
}
