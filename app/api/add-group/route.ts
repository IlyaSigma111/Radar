import { NextRequest, NextResponse } from 'next/server'
import * as db from '../../lib/db'

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let withProtocol = trimmed
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    withProtocol = 'https://' + trimmed
  }

  try {
    const u = new URL(withProtocol)
    const host = u.hostname.toLowerCase()
    if (!host.endsWith('vk.com') && !host.endsWith('vk.ru')) return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length === 0) return null

    return `https://vk.com/${parts[0]}`
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { url } = body

  const normalized = normalizeUrl(url)
  if (!normalized) {
    return NextResponse.json(
      { error: 'Введите ссылку на группу ВК. Пример: https://vk.com/club12345' },
      { status: 400 }
    )
  }

  const existingGroups = await db.getGroups()
  const groupSet = new Set<string>()
  for (const link of existingGroups) {
    const g = normalizeUrl(link)
    if (g) groupSet.add(g)
  }

  if (groupSet.has(normalized)) {
    return NextResponse.json({ error: 'Эта группа уже добавлена' }, { status: 409 })
  }

  try {
    await db.insertGroup(normalized)
    return NextResponse.json({ ok: true, url: normalized })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Ошибка сервера' }, { status: 500 })
  }
}
