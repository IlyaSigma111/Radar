const fs = require('fs')
const https = require('https')

const links = fs.readFileSync('public/links.txt', 'utf-8').trim().split('\n').slice(0, 3)

function fetchPage(hostname, path) {
  return new Promise((resolve, reject) => {
    https.get({hostname, path, headers: {'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'}}, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d))
    }).on('error', reject)
  })
}

function decodeHtml(str) {
  return str.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)))
    .replace(/&#39;/g, "'").trim()
}

async function run() {
  for (const link of links) {
    const name = new URL(link).pathname.replace('/', '')
    console.log(`\n=== ${name} ===`)
    const html = await fetchPage('m.vk.com', `/${name}/wall`)
    const se = html.lastIndexOf('</style>')
    const body = se > 0 ? html.substring(se) : html
    
    // Название
    const author = body.match(/class="[^"]*pi_author[^"]*"[^>]*>([^<]+)<\/a>/)
    console.log(`Name: ${author ? author[1].trim() : 'N/A'}`)
    
    // Аватарка
    const avaMatch = body.match(/background-image:\s*url\(([^)]*ava=1[^)]+)\)/)
    if (avaMatch) {
      let ava = avaMatch[1].replace(/&#39;/g, "'").trim()
      if (ava.startsWith('/')) ava = 'https://m.vk.com' + ava
      console.log(`Avatar: ${ava.substring(0, 80)}...`)
    }
    
    // Посты
    let piIdx = -1
    let found = 0
    while (found < 1) {
      piIdx = body.indexOf('pi_text', piIdx + 1)
      if (piIdx === -1) break
      found++
      
      const gt = body.indexOf('>', piIdx)
      const end = body.indexOf('</div>', gt + 1)
      
      // Текст из pi_text
      const raw = body.substring(gt + 1, end)
      let text = raw.replace(/<a[^>]*href="\/feed\?section=search[^"]*"[^>]*>.*?<\/a>/gi, '')
        .replace(/<a[^>]*class="PostTextMore[^"]*"[^>]*>.*?<\/a>/gi, '')
        .replace(/<[^>]+>/g, '')
      text = decodeHtml(text)
      const withoutHash = text.replace(/#[A-Za-zА-Яа-яЁё\d_]+/g, '').trim()
      
      console.log(`Text (${text.length} chars, withoutHash: ${withoutHash.length} chars): ${text.substring(0, 100)}...`)
      
      // Картинка поста - ищем img после pi_text до следующего wall_item или конца
      const nextWallItem = body.indexOf('wall_item', piIdx + 100)
      const searchBlock = body.substring(piIdx, nextWallItem > 0 ? nextWallItem : piIdx + 4000)
      const imgMatch = searchBlock.match(/<img[^>]*src=["']([^"']*userapi[^"']+)["']/)
      let img = null
      if (imgMatch) {
        img = imgMatch[1].replace(/&#39;/g, "'").replace(/"/g, '').trim()
        if (!img.startsWith('http')) img = 'https://m.vk.com' + img
        console.log(`Image: ${img.substring(0, 100)}...`)
      } else {
        console.log(`Image: none`)
      }
    }
  }
}

run()
