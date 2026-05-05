import { NextResponse } from 'next/server'
import * as db from '@/app/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const meta = await db.getScanMeta()
    const totalPosts = await db.getPostsCount()

    return NextResponse.json({
      ok: true,
      total: totalPosts,
      lastScan: meta?.lastScan || 0,
      cached: true,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Ошибка сервера' }, { status: 500 })
  }
}
