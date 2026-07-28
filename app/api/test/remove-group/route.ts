import { NextRequest, NextResponse } from 'next/server'
import * as db from '@/app/lib/db-test'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const url = body.url || body.group

  if (!url) {
    return NextResponse.json({ error: 'Укажите группу' }, { status: 400 })
  }

  try {
    await db.deleteGroup(url)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Ошибка сервера' }, { status: 500 })
  }
}
