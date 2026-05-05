import { NextRequest, NextResponse } from 'next/server'
import { getGroups, getPostsCount, getAnnouncements, saveAnnouncement, deleteAnnouncement, getTechStatus, setTechStatus } from '@/app/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

const VK_SERVICE_TOKEN = process.env.VK_BOT_TOKEN || ''
const VK_CONFIRMATION_STRING = process.env.VK_CONFIRMATION_STRING || '51f3cfed'

function keyboard(buttons: { label: string; payload: string }[][], oneTime = false) {
  return JSON.stringify({
    one_time: oneTime,
    inline: false,
    buttons: buttons.map(row =>
      row.map(btn => ({
        action: { type: 'text', payload: btn.payload, label: btn.label },
        color: 'primary',
      }))
    ),
  })
}

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

async function sendMsg(peerId: number, text: string, kb?: string) {
  const params: Record<string, string | number> = {
    peer_id: peerId,
    random_id: String(Date.now()),
    message: text,
  }
  if (kb) params.keyboard = kb
  return vkApi('messages.send', params)
}

const MAIN_MENU = keyboard([
  [{ label: 'Объявления', payload: '{"cmd":"announces"}' }],
  [{ label: 'Тех. перерыв', payload: '{"cmd":"tech"}' }],
  [{ label: 'Статистика', payload: '{"cmd":"stats"}' }],
])

const ANNOUNCE_MENU = keyboard([
  [{ label: 'Создать', payload: '{"cmd":"ann_create"}' }, { label: 'Список', payload: '{"cmd":"ann_list"}' }],
  [{ label: 'Удалить', payload: '{"cmd":"ann_delete"}' }],
  [{ label: 'Назад', payload: '{"cmd":"back"}' }],
])

const TECH_MENU = keyboard([
  [{ label: 'Запустить', payload: '{"cmd":"tech_on"}' }, { label: 'Остановить', payload: '{"cmd":"tech_off"}' }],
  [{ label: 'Сообщение', payload: '{"cmd":"tech_msg"}' }],
  [{ label: 'Назад', payload: '{"cmd":"back"}' }],
])

export async function POST(req: NextRequest) {
  try {
    const rawText = await req.text()
    const contentType = req.headers.get('content-type') || ''
    let body: any

    if (contentType.includes('application/json')) {
      try { body = JSON.parse(rawText) } catch { body = {} }
    } else {
      const params = new URLSearchParams(rawText)
      body = {}
      for (const [key, value] of params) {
        body[key] = value
      }
      if (body.object && typeof body.object === 'string') {
        try { body.object = JSON.parse(body.object) } catch {}
      }
      if (body.group_id) body.group_id = parseInt(body.group_id)
    }

    if (body.type === 'confirmation') {
      return new NextResponse(VK_CONFIRMATION_STRING, {
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // Only process message_new, ignore everything else immediately
    if (body.type !== 'message_new') {
      return NextResponse.json({ ok: true })
    }

    const msgObj = body.object.message || body.object
    const peerId = msgObj.peer_id || msgObj.from_id || body.object.from_id
    const text = (msgObj.text || '').toLowerCase().trim()

    if (text === 'начать' || text === 'start' || text === 'меню' || text === '/start') {
      await sendMsg(peerId, 'Добро пожаловать в панель управления РАДАРОМ!\n\nВыберите действие:', MAIN_MENU)
      return NextResponse.json({ ok: true })
    }

    switch (true) {
      case text.includes('объявления') || text.includes('announce'):
        await sendMsg(peerId, 'Управление объявлениями:', ANNOUNCE_MENU)
        break

      case text.includes('тех') || text.includes('tech') || text.includes('перерыв'): {
        const ts = await getTechStatus()
        const tsStatus = ts.active ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'
        const tsMsg = ts.message ? `\nСообщение: ${ts.message}` : ''
        await sendMsg(peerId, `Тех. перерыв: ${tsStatus}${tsMsg}\n\nВыберите действие:`, TECH_MENU)
        break
      }

      case text.includes('статистика') || text.includes('stats'): {
        const [postCount, groupCount, tech, announces] = await Promise.all([
          getPostsCount(),
          getGroups().then(g => g.length),
          getTechStatus(),
          getAnnouncements(),
        ])
        await sendMsg(peerId,
          `Статистика РАДАРА:\n\n` +
          `Постов в базе: ${postCount}\n` +
          `Групп отслеживается: ${groupCount}\n` +
          `Тех. перерыв: ${tech.active ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}\n` +
          `Объявлений: ${announces.length}`,
          MAIN_MENU
        )
        break
      }

      case text.includes('создать') || text.includes('ann_create'):
        await sendMsg(peerId, 'Напишите текст объявления:', keyboard([[{ label: 'Назад', payload: '{"cmd":"back"}' }]], true))
        break

      case text.includes('список') || text.includes('ann_list'): {
        const announces = await getAnnouncements()
        if (announces.length === 0) {
          await sendMsg(peerId, 'Объявлений пока нет.', ANNOUNCE_MENU)
        } else {
          let text2 = 'Активные объявления:\n\n'
          announces.forEach((a, i) => {
            text2 += `${i + 1}. ${a.text.substring(0, 100)}${a.text.length > 100 ? '...' : ''} (ID: ${a.id})\n\n`
          })
          await sendMsg(peerId, text2, ANNOUNCE_MENU)
        }
        break
      }

      case text.includes('удалить') || text.includes('ann_delete'):
        await sendMsg(peerId, 'Введите ID объявления для удаления:', keyboard([[{ label: 'Назад', payload: '{"cmd":"back"}' }]], true))
        break

      case text.includes('вкл') || text.includes('on') || text.includes('запуск'): {
        const ts = await getTechStatus()
        const tsMsg = ts.message || 'Работаем в режиме технического обслуживания.'
        await setTechStatus({ active: true, message: tsMsg })
        await sendMsg(peerId, `Тех. перерыв включен!\n\nСообщение: ${tsMsg}`, TECH_MENU)
        break
      }

      case text.includes('выкл') || text.includes('off') || text.includes('остановить'):
        await setTechStatus({ active: false, message: '' })
        await sendMsg(peerId, 'Тех. перерыв выключен!', TECH_MENU)
        break

      case text.includes('сообщение') || text.includes('msg'):
        await sendMsg(peerId, 'Напишите сообщение для тех. перерыва:', keyboard([[{ label: 'Назад', payload: '{"cmd":"back"}' }]], true))
        break

      case text.includes('назад') || text.includes('back'):
        await sendMsg(peerId, 'Главное меню:', MAIN_MENU)
        break

      default:
        if (peerId > 2000000000) {
          await sendMsg(peerId, 'Неизвестная команда. Напишите /start')
        } else {
          const result = await saveAnnouncement({ text: msgObj.text || '', createdAt: Date.now(), active: true })
          await sendMsg(peerId, `Объявление создано! ID: ${result.name}`, ANNOUNCE_MENU)
        }
        break
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('VK Bot error:', e)
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'VK Bot API running' })
}
