// Автономный polling-скрипт для VK Radar
// Опрос VK API каждые 15 секунд, запись в MongoDB
require('dotenv').config()
const https = require('https')
const mongo = require('./mongo')

// === CONFIG ===
const VK_TOKEN = process.env.VK_SERVICE_TOKEN
const AUTO_POST_GROUP_ID = process.env.AUTO_POST_GROUP_ID || '238105044'
const SCAN_INTERVAL = 120000 // 2 минуты — один проход по всем группам занимает ~1-2 мин
const POSTS_PER_REQUEST = 100 // Максимум VK API
const MAX_POSTS_PER_GROUP = 100 // Лимит за один скан
const MAX_RETRY = 3
const RETRY_DELAY = 2000
const MAX_LOGS = 100 // Максимум логов

if (!VK_TOKEN) {
  console.error('ERROR: VK_SERVICE_TOKEN not set')
  process.exit(1)
}

// === STATS ===
const stats = {
  startTime: Date.now(),
  totalScans: 0,
  totalScanned: 0,
  totalNew: 0,
  totalPosted: 0,
  totalErrors: 0,
  totalRetries: 0,
  vkApiCalls: 0,
  vkRateLimits: 0,
  vkServerErrors: 0,
  lastScanStart: null,
  lastScanEnd: null,
  lastScanDuration: 0,
  lastScanGroups: 0,
  lastScanNew: 0,
  lastScanErrors: [],
  groupStats: {},
  logs: []
}

function addLog(level, message, data = {}) {
  const entry = {
    time: Date.now(),
    level,
    message,
    ...data
  }
  stats.logs.push(entry)
  if (stats.logs.length > MAX_LOGS) stats.logs.shift()
}

// === HELPERS ===
function log(msg) {
  const time = new Date().toLocaleTimeString('ru-RU')
  console.log(`[${time}] ${msg}`)
}

function vkApi(method, params, retry = 0) {
  const query = Object.entries({
    access_token: VK_TOKEN,
    v: '5.199',
    ...params,
  })
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')

  return new Promise((resolve, reject) => {
    const callStart = Date.now()
    stats.vkApiCalls++

    https.get(`https://api.vk.com/method/${method}?${query}`, {
      headers: { 'User-Agent': 'VK Radar/2.0' }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        const duration = Date.now() - callStart
        try {
          const json = JSON.parse(data)
          // VK rate limit or server error
          if (json.error && (json.error.error_code === 6 || json.error.error_code === 10)) {
            stats.vkRateLimits++
            stats.totalRetries++
            addLog('warn', `VK API rate limit on ${method} (${duration}ms)`, { retry, errorCode: json.error.error_code, duration })
            if (retry < MAX_RETRY) {
              log(`VK API rate limit, retry ${retry + 1}/${MAX_RETRY} for ${method}`)
              setTimeout(() => {
                vkApi(method, params, retry + 1).then(resolve, reject)
              }, RETRY_DELAY * (retry + 1))
            } else {
              reject(new Error(`VK API error ${json.error.error_code}: ${json.error.error_msg}`))
            }
            return
          }
          if (json.error) {
            stats.vkServerErrors++
            addLog('error', `VK API error on ${method} (${duration}ms)`, { errorCode: json.error.error_code, errorMsg: json.error.error_msg, duration })
          }
          resolve(json)
        } catch (e) {
          reject(new Error(data))
        }
      })
    }).on('error', (err) => {
      stats.vkServerErrors++
      if (retry < MAX_RETRY) {
        log(`Network error, retry ${retry + 1}/${MAX_RETRY}`)
        stats.totalRetries++
        addLog('warn', `Network error on ${method}, retrying`, { retry, error: err.message })
        setTimeout(() => {
          vkApi(method, params, retry + 1).then(resolve, reject)
        }, RETRY_DELAY * (retry + 1))
      } else {
        addLog('error', `Network error on ${method}`, { error: err.message })
        reject(err)
      }
    })
  })
}

function parseDomain(url) {
  let u = url.trim()
  if (!u.startsWith('http')) u = 'https://' + u
  try {
    const parsed = new URL(u)
    return parsed.pathname.split('/').filter(Boolean)[0] || ''
  } catch { return '' }
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`
}

function getBiggestPhotoUrl(photo) {
  if (!photo?.sizes?.length) return null
  const sizes = photo.sizes
  const preferred = ['z', 'y', 'x', 'r', 'q', 'o', 'p']
  for (const type of preferred) {
    const found = sizes.find(s => s.type === type)
    if (found) return found.url
  }
  return sizes[sizes.length - 1].url
}

// Группы кэшируются чтобы не делать getById каждый раз
const groupInfoCache = new Map()

async function loadGroups() {
  return await mongo.loadGroups()
}

async function loadExistingPosts() {
  return await mongo.loadAllPosts()
}

// === ATTACHMENT EXTRACTOR ===
function extractAttachments(attachments, images, videoData) {
  for (const att of (attachments || [])) {
    if (att.type === 'photo' && att.photo) {
      const url = getBiggestPhotoUrl(att.photo)
      if (url && !images.includes(url)) images.push(url)
    }
    else if (att.type === 'video' && att.video) {
      const v = att.video
      const vf = v.first_frame || v.image
      let thumbUrl = null
      if (vf && vf.length > 0) thumbUrl = vf[vf.length - 1].url
      if (!videoData.id) {
        Object.assign(videoData, {
          id: `${v.owner_id}_${v.id}`,
          title: v.title || '',
          duration: v.duration || 0,
          thumb: thumbUrl,
          player: v.player || null,
          files: v.files || null,
          isClip: false
        })
      }
      if (thumbUrl && !images.includes(thumbUrl)) images.push(thumbUrl)
    }
    else if (att.type === 'clip' && att.clip) {
      const c = att.clip
      const vf = c.first_frame || c.thumb_photo
      let thumbUrl = null
      if (vf) thumbUrl = vf.url || (vf.sizes?.[vf.sizes.length - 1]?.url) || null
      if (!videoData.id) {
        Object.assign(videoData, {
          id: `${c.owner_id}_${c.id}`,
          title: c.title || '',
          duration: c.duration || 0,
          thumb: thumbUrl,
          player: c.player || null,
          files: c.files || null,
          isClip: true
        })
      }
    }
    else if (att.type === 'link' && att.link) {
      if (att.link.photo) {
        const url = getBiggestPhotoUrl(att.link.photo)
        if (url && !images.includes(url)) images.push(url)
      }
      if (att.link.caption && !images.includes('link:' + att.link.url)) {
        images.push('link:' + att.link.url)
      }
    }
    else if (att.type === 'doc' && att.doc) {
      const doc = att.doc
      const preview = doc.preview?.photo?.sizes?.slice(-1)[0]?.url
      if (preview && !images.includes(preview)) images.push(preview)
      else if (doc.url && !images.includes(doc.url)) images.push(doc.url)
    }
    else if (att.type === 'article' && att.article?.photo) {
      const url = att.article.photo.sizes?.[att.article.photo.sizes.length - 1]?.url
      if (url && !images.includes(url)) images.push(url)
    }
    else if (att.type === 'audio' && att.audio) {
      const a = att.audio
      if (!videoData.id) {
        Object.assign(videoData, {
          id: `audio_${a.owner_id}_${a.id}`,
          title: `${a.artist} — ${a.title}`,
          duration: a.duration || 0,
          thumb: a.image?.slice(-1)[0]?.url || null,
          isClip: false,
          isAudio: true
        })
      }
    }
    else if (att.type === 'podcast' && att.podcast) {
      const p = att.podcast
      if (!videoData.id) {
        Object.assign(videoData, {
          id: `podcast_${p.owner_id}_${p.id}`,
          title: p.title || '',
          duration: p.duration || 0,
          thumb: p.image?.slice(-1)[0]?.url || p.main_color || null,
          isClip: false,
          isAudio: true
        })
      }
    }
    else if (att.type === 'graffiti' && att.graffiti) {
      const url = att.graffiti.url
      if (url && !images.includes(url)) images.push(url)
    }
    else if (att.type === 'story' && att.story) {
      const s = att.story
      const vf = s.first_frame || s.video
      if (vf?.sizes?.length) {
        const thumbUrl = vf.sizes[vf.sizes.length - 1].url
        if (!videoData.id) {
          Object.assign(videoData, {
            id: `story_${s.owner_id}_${s.id}`,
            title: 'История',
            duration: 0,
            thumb: thumbUrl,
            isClip: true
          })
        }
        if (thumbUrl && !images.includes(thumbUrl)) images.push(thumbUrl)
      }
    }
    else if (att.type === 'market' && att.market) {
      const m = att.market
      const photos = m.thumb_photo || m.photos
      if (photos?.length) {
        const url = photos[photos.length - 1]?.url
        if (url && !images.includes(url)) images.push(url)
      }
    }
    else if (att.type === 'wall' && att.wall) {
      // Репост со стены — извлекаем вложения
      const wallItem = att.wall
      extractAttachments(wallItem.attachments, images, videoData)
      if (!images.includes('wall:' + wallItem.id)) {
        images.push('wall:' + wallItem.id)
      }
    }
    else if (att.type === 'note' && att.note) {
      const n = att.note
      if (n.photo) {
        const url = getBiggestPhotoUrl(n.photo)
        if (url && !images.includes(url)) images.push(url)
      }
    }
    else if (att.type === 'album' && att.album) {
      const a = att.album
      if (a.thumb?.sizes?.length) {
        const url = a.thumb.sizes[a.thumb.sizes.length - 1].url
        if (url && !images.includes(url)) images.push(url)
      }
    }
  }
}

// Рекурсивно извлекаем из copy_history
function extractCopyHistory(copyItems, images, videoData, depth = 0) {
  if (depth > 2 || !copyItems?.length) return
  const copyItem = copyItems[0]

  // Текст из репоста
  if (copyItem.text) return copyItem.text

  extractAttachments(copyItem.attachments, images, videoData)

  // Вложенный copy_history
  if (copyItem.copy_history?.length) {
    const nestedText = extractCopyHistory(copyItem.copy_history, images, videoData, depth + 1)
    if (nestedText) return nestedText
  }

  return null
}

// === MAIN SCAN LOGIC ===
async function scanSingleGroup(url, maxKnownId = 0) {
  const groupStart = Date.now()
  const domain = parseDomain(url)
  if (!domain) return { posts: [], maxId: maxKnownId, errors: [], vkTime: 0, batches: 0 }

  // Кэш группы
  if (!groupInfoCache.has(domain)) {
    try {
      const groupsRes = await vkApi('groups.getById', { group_id: domain, fields: 'name,photo_200' })
      if (groupsRes.response?.groups?.length) {
        const g = groupsRes.response.groups[0]
        groupInfoCache.set(domain, { name: g.name || domain, avatar: g.photo_200 || null })
      } else {
        groupInfoCache.set(domain, { name: domain, avatar: null })
      }
    } catch {
      groupInfoCache.set(domain, { name: domain, avatar: null })
    }
  }

  const groupInfo = groupInfoCache.get(domain)
  const allPosts = []
  let maxId = maxKnownId
  let offset = 0
  let batches = 0

  // Paginated fetch — берём новые посты пачками по 100, пока не найдём уже известный
  while (offset < MAX_POSTS_PER_GROUP) {
    let wallRes
    const batchStart = Date.now()
    batches++
    try {
      wallRes = await vkApi('wall.get', {
        domain, count: POSTS_PER_REQUEST, offset, filter: 'all', extended: 1, fields: 'photo_200'
      })
    } catch (e) {
      allPosts.errors = allPosts.errors || []
      allPosts.errors.push(e.message)
      break
    }

    if (wallRes.error) {
      allPosts.errors = allPosts.errors || []
      allPosts.errors.push(wallRes.error.error_msg)
      break
    }
    if (!wallRes.response?.items?.length) break

    const groups = wallRes.response.groups || []
    const profiles = wallRes.response.profiles || []
    let foundKnown = false

    for (const item of wallRes.response.items) {
      // Если уже видели этот пост — значит дальше только старые
      if (item.id <= maxKnownId) {
        foundKnown = true
        break
      }

      // Текст поста
      let text = (item.text || '').trim()
      if (!text && item.source_text) {
        text = item.source_text.trim()
      }

      const images = []
      const videoData = { id: null, title: '', duration: 0, thumb: null, isClip: false }

      // Основные вложения
      extractAttachments(item.attachments, images, videoData)

      // Вложения из репоста
      if (item.copy_history?.length) {
        const copyText = extractCopyHistory(item.copy_history, images, videoData)
        if (!text && copyText) text = copyText
      }

      // Чистим служебные маркеры из изображений
      const cleanImages = images.filter(img => !img.startsWith('link:') && !img.startsWith('wall:'))

      // Заглушка если нет текста
      if (!text && cleanImages.length > 0 && !videoData.id) {
        text = '[Изображение]'
      }
      if (!text && videoData.id) {
        text = videoData.isAudio ? `[Аудио: ${videoData.title}]` : (videoData.title ? `[Видео: ${videoData.title}]` : '[Видео]')
      }

      // Автор
      let authorName = domain
      let avatarUrl = null
      if (groupInfo) {
        authorName = groupInfo.name
        avatarUrl = groupInfo.avatar
      } else if (item.from_id < 0) {
        const group = groups.find(g => -g.id === item.from_id)
        if (group) {
          authorName = group.name || domain
          avatarUrl = group.photo_200 || null
        }
      } else {
        const profile = profiles.find(p => p.id === item.from_id)
        if (profile) {
          authorName = `${profile.first_name} ${profile.last_name}`
          avatarUrl = profile.photo_200 || null
        }
      }

      // Резолвим домен через screen_name
      let resolvedDomain = domain
      if (item.from_id < 0) {
        const group = groups.find(g => -g.id === item.from_id)
        if (group?.screen_name && group.screen_name !== domain) {
          resolvedDomain = group.screen_name
        }
      }

      const postId = `post_${domain}_${item.id}`
      allPosts.push({
        id: postId,
        name: authorName,
        text: text.substring(0, 3000),
        time: formatTime(item.date),
        likes: item.likes?.count || 0,
        comments: item.comments?.count || 0,
        reposts: item.reposts?.count || 0,
        views: item.views?.count || 0,
        image: cleanImages.length > 0 ? cleanImages[0] : null,
        images: cleanImages.slice(0, 10),
        avatar: avatarUrl,
        postLink: `https://vk.com/wall-${Math.abs(item.from_id)}_${item.id}`,
        link: `https://vk.com/wall-${Math.abs(item.from_id)}_${item.id}`,
        domain: resolvedDomain,
        source: 'vk',
        video: videoData.id ? { ...videoData } : null,
        publishedAt: item.date * 1000,
        createdAt: Date.now(),
      })

      if (item.id > maxId) maxId = item.id
    }

    if (foundKnown) break
    offset += POSTS_PER_REQUEST

    // Если VK вернул меньше 100 — это конец стены
    if (wallRes.response.items.length < POSTS_PER_REQUEST) break
  }

  const vkTime = Date.now() - groupStart
  return { posts: allPosts, maxId, errors: allPosts.errors || [], vkTime, batches, groupTime: vkTime }
}

async function autoRepost(post) {
  if (!AUTO_POST_GROUP_ID) return false
  try {
    await vkApi('wall.post', {
      owner_id: AUTO_POST_GROUP_ID,
      message: post.text,
      attachments: `link${post.postLink}`,
    })
    return true
  } catch { return false }
}

async function runScan() {
  await mongo.getDb() // ensure connection
  stats.lastScanStart = Date.now()
  stats.lastScanErrors = []
  stats.totalScans++

  const groupLinks = await loadGroups()
  const existingPosts = await loadExistingPosts()

  // Загружаем последние ID для каждой группы
  const scanState = await mongo.loadScanState()
  const groupMaxIds = new Map()
  if (scanState && typeof scanState === 'object') {
    for (const [domain, data] of Object.entries(scanState)) {
      groupMaxIds.set(domain, data?.maxId || 0)
    }
  }

  let totalScanned = 0
  let totalNew = 0
  let totalPosted = 0
  const newPosts = []
  let scanErrors = []
  const updatedMaxIds = {}
  const currentGroupStats = {}

  for (const url of groupLinks) {
    const domain = parseDomain(url)
    if (!domain) {
      scanErrors.push(`Invalid URL: ${url}`)
      continue
    }

    const maxKnownId = groupMaxIds.get(domain) || 0
    const result = await scanSingleGroup(url, maxKnownId)

    await new Promise(r => setTimeout(r, 2000))

    const count = result.posts.length
    totalScanned += count
    if (result.errors?.length) {
      scanErrors.push(`[${domain}] ${result.errors.join(', ')}`)
      addLog('error', `Scan errors for ${domain}`, { errors: result.errors })
    }

    for (const post of result.posts) {
      if (existingPosts.has(post.id)) continue
      totalNew++
      newPosts.push(post)
    }

    // Per-group stats
    currentGroupStats[domain] = {
      vkTime: result.vkTime || 0,
      batches: result.batches || 0,
      postsFound: count,
      newPosts: newPosts.filter(p => p.id.includes(domain)).length,
      maxId: result.maxId,
      lastScan: Date.now(),
      errors: result.errors || []
    }

    // Сохраняем новый maxId
    if (result.maxId > maxKnownId) {
      updatedMaxIds[domain] = { maxId: result.maxId, updatedAt: Date.now() }
    }
  }

  if (newPosts.length > 0) {
    await mongo.savePosts(newPosts)

    // Auto-repost
    for (const post of newPosts) {
      if (post.text.length >= 3) {
        const posted = await autoRepost(post)
        if (posted) totalPosted++
      }
    }
  }

  // Обновляем scanState
  if (Object.keys(updatedMaxIds).length > 0) {
    await mongo.saveScanState(updatedMaxIds)
  }

  const elapsed = Date.now() - stats.lastScanStart
  stats.lastScanEnd = Date.now()
  stats.lastScanDuration = elapsed
  stats.lastScanGroups = groupLinks.length
  stats.lastScanNew = totalNew
  stats.totalScanned += totalScanned
  stats.totalNew += totalNew
  stats.totalPosted += totalPosted

  if (scanErrors.length) {
    stats.totalErrors += scanErrors.length
    stats.lastScanErrors = scanErrors.slice(0, 5)
    addLog('error', `Scan completed with ${scanErrors.length} errors`, { errors: scanErrors.slice(0, 5), duration: elapsed })
  }

  // Merge group stats
  for (const [domain, gs] of Object.entries(currentGroupStats)) {
    stats.groupStats[domain] = gs
  }

  const errText = scanErrors.length ? ` | Ошибки: ${scanErrors.slice(0, 2).join(', ')}` : ''
  log(`Готово за ${elapsed}ms: ${totalScanned} просканировано, ${totalNew} новых, ${totalPosted} репостов${errText}`)

  // Write stats to MongoDB for admin panel
  try {
    await mongo.saveStats({
      uptime: Date.now() - stats.startTime,
      lastScan: {
        start: stats.lastScanStart,
        end: stats.lastScanEnd,
        duration: stats.lastScanDuration,
        groups: stats.lastScanGroups,
        newPosts: stats.lastScanNew,
        errors: stats.lastScanErrors
      },
      totals: {
        scans: stats.totalScans,
        scanned: stats.totalScanned,
        new: stats.totalNew,
        posted: stats.totalPosted,
        errors: stats.totalErrors,
        retries: stats.totalRetries,
        vkApiCalls: stats.vkApiCalls,
        vkRateLimits: stats.vkRateLimits,
        vkServerErrors: stats.vkServerErrors
      },
      groups: stats.groupStats,
      logs: stats.logs.slice(-30)
    })
  } catch (e) {
    log(`Error saving stats: ${e.message}`)
  }
}

// === START ===
log(`=== VK Radar Polling запущен ===`)
log(`Интервал: ${SCAN_INTERVAL / 1000}с | Пачка: ${POSTS_PER_REQUEST} постов | Лимит: ${MAX_POSTS_PER_GROUP}/группу`)
log(`DB: MongoDB ${process.env.MONGODB_URI?.split('@')[1] || 'unknown'}`)
log(`Auto-repost: ${AUTO_POST_GROUP_ID ? 'вкл' : 'выкл'}`)
log(`Tracking: по maxId — ни один пост не пропустится`)
log('')

mongo.getDb().then(() => {
  let scanning = false

  async function runCycle() {
    if (scanning) {
      log('Пропуск: предыдущий скан ещё выполняется')
      return
    }
    scanning = true
    try {
      await runScan()
    } catch (e) {
      log(`Ошибка сканирования: ${e.message}`)
    } finally {
      scanning = false
    }
  }

  runCycle()
  setInterval(runCycle, SCAN_INTERVAL)
}).catch(e => {
  log(`Fatal: Cannot connect to MongoDB: ${e.message}`)
  process.exit(1)
})
