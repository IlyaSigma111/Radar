import { NextResponse } from 'next/server'
import * as db from '@/app/lib/db-test'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [meta, totalPosts, stats] = await Promise.all([
      db.getScanMeta(),
      db.getPostsCount(),
      db.getStats(),
    ])

    return NextResponse.json({
      ok: true,
      total: totalPosts,
      lastScan: meta?.lastScan || 0,
      cached: true,
      stats: stats || null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Ошибка сервера' }, { status: 500 })
  }
}
