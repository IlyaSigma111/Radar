import { NextResponse } from 'next/server'
import * as db from '@/app/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const groups = await db.getGroups()
    return NextResponse.json(groups)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Ошибка сервера' }, { status: 500 })
  }
}
