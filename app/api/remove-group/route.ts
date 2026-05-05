import { NextRequest, NextResponse } from 'next/server'
import * as db from '../../lib/db'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { group } = body

  if (!group) {
    return NextResponse.json({ error: 'Укажите группу' }, { status: 400 })
  }

  try {
    await db.deleteGroup(group)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Ошибка сервера' }, { status: 500 })
  }
}
