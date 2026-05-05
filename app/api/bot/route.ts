import { NextRequest, NextResponse } from 'next/server'
import { getAnnouncements, saveAnnouncement, deleteAnnouncement, getTechStatus, setTechStatus, getPostsCount, getGroups } from '@/app/lib/db'

export const dynamic = 'force-dynamic'

const VK_SERVICE_TOKEN = process.env.VK_SERVICE_TOKEN || ''

async function vkApi(method: string, params: Record<string, string | number>) {
  const query = Object.entries({
    access_token: VK_SERVICE_TOKEN,
    v: '5.199',
    ...params,
  })
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')

  const res = await fetch(`https://api.vk.com/method/${method}?${query}`)
  return res.json() as Promise<any>
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { command, chatId, ...params } = body

    if (!chatId) {
      return NextResponse.json({ error: 'chatId required' }, { status: 400 })
    }

    switch (command) {
      case 'announce': {
        const result = await saveAnnouncement({
          text: params.text || '',
          createdAt: Date.now(),
          active: true,
        })
        return NextResponse.json({ ok: true, id: result.name })
      }

      case 'list_announces': {
        const announcements = await getAnnouncements()
        const active = announcements.filter(a => a.active)
        return NextResponse.json({ ok: true, announcements: active })
      }

      case 'delete_announce': {
        await deleteAnnouncement(params.id as string)
        return NextResponse.json({ ok: true })
      }

      case 'toggle_tech': {
        const status = await getTechStatus()
        const isActive = !status.active
        await setTechStatus({
          active: isActive,
          message: params.message || '',
          updatedAt: Date.now(),
        })
        return NextResponse.json({ ok: true, active: isActive })
      }

      case 'tech_status': {
        const status = await getTechStatus()
        return NextResponse.json({ ok: true, status })
      }

      case 'scan': {
        // Trigger a manual scan
        await fetch('https://radar-main.vercel.app/api/scan')
        return NextResponse.json({ ok: true, message: 'Scan triggered' })
      }

      case 'post_count': {
        const count = await getPostsCount()
        return NextResponse.json({ ok: true, count })
      }

      case 'groups_count': {
        const groups = await getGroups()
        return NextResponse.json({ ok: true, count: groups.length })
      }

      default:
        return NextResponse.json({ error: 'Unknown command' }, { status: 400 })
    }
  } catch (e) {
    console.error('API error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  switch (action) {
    case 'announcements': {
      const announcements = await getAnnouncements()
      return NextResponse.json({ ok: true, announcements: announcements.filter(a => a.active) })
    }
    case 'tech_status': {
      const status = await getTechStatus()
      return NextResponse.json({ ok: true, status })
    }
    default:
      return NextResponse.json({ ok: true, message: 'VK Bot API is running' })
  }
}
