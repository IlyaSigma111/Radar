import { NextResponse } from 'next/server'
import * as db from '@/app/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const postsMap = await db.getExistingPosts()
    const posts: any[] = []

    for (const [id, post] of postsMap) {
      posts.push({
        id,
        name: post.name || 'VK сообщество',
        text: post.text || '',
        time: post.time || 'только что',
        likes: post.likes || 0,
        image: post.image || null,
        images: post.images || [],
        avatar: post.avatar || null,
        createdAt: post.createdAt || Date.now(),
        publishedAt: post.publishedAt || post.createdAt || 0,
        x: 0,
        y: 0,
        w: 280,
        h: 360,
        source: post.source || 'vk',
        link: post.link || '',
        video: post.video || null,
      })
    }

    return NextResponse.json(posts)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Ошибка сервера' }, { status: 500 })
  }
}
