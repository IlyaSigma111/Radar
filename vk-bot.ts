const FIREBASE_URL = 'https://radar-fdaae-default-rtdb.firebaseio.com'
const VK_BOT_TOKEN = process.env.VK_BOT_TOKEN || ''
const VK_CHAT_ID = parseInt(process.env.VK_CHAT_ID || '0')
const VK_GROUP_ID = parseInt(process.env.VK_GROUP_ID || '0')

let lastKnownPostId = ''

async function fetchPosts() {
  try {
    const res = await fetch(`${FIREBASE_URL}/posts.json?t=${Date.now()}`)
    const data = await res.json()
    if (!data) return []

    const posts = Object.entries(data).map(([id, p]: [string, any]) => ({
      id,
      name: p.name || 'VK сообщество',
      text: p.text || '',
      likes: p.likes || 0,
      link: p.link || '',
      video: p.video || null,
      image: p.image || null,
      publishedAt: p.publishedAt || p.createdAt || 0,
    }))

    posts.sort((a, b) => b.publishedAt - a.publishedAt)
    return posts
  } catch (e) {
    console.error('Fetch error:', e)
    return []
  }
}

function decodeHtml(str: string): string {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)))
    .trim()
}

async function sendToVK(text: string, attachment?: string) {
  if (!VK_BOT_TOKEN || !VK_CHAT_ID) return

  const params = new URLSearchParams({
    access_token: VK_BOT_TOKEN,
    v: '5.199',
    random_id: Date.now().toString(),
    peer_id: VK_CHAT_ID.toString(),
    message: text,
  })

  if (attachment) params.set('attachment', attachment)

  try {
    const res = await fetch(`https://api.vk.com/method/messages.send?${params}`)
    const data = await res.json()
    if (data.error) {
      console.error('VK error:', data.error)
    }
  } catch (e) {
    console.error('VK send error:', e)
  }
}

async function checkNewPosts() {
  const posts = await fetchPosts()
  if (posts.length === 0) return

  const newest = posts[0]
  if (newest.id === lastKnownPostId) return

  console.log(`New post from ${newest.name}`)

  const text = decodeHtml(newest.text).substring(0, 400)
  const vkText = `📡 ${newest.name}\n\n${text}${newest.text.length > 400 ? '...' : ''}\n\n${newest.likes > 0 ? `❤️ ${newest.likes}` : ''}  ${newest.link}`

  let attachment = ''
  if (newest.video?.thumb) {
    attachment = `photo${newest.video.thumb}`
  } else if (newest.image) {
    attachment = `photo${newest.image}`
  }

  await sendToVK(vkText, attachment || undefined)

  lastKnownPostId = newest.id
}

console.log('VK Radar Bot started')
console.log(`Chat ID: ${VK_CHAT_ID || 'not set'}`)
console.log(`Group ID: ${VK_GROUP_ID || 'not set'}`)

checkNewPosts()
setInterval(checkNewPosts, 30000)
