const fs = require('fs')
const https = require('https')

const links = fs.readFileSync('public/links.txt', 'utf-8').trim().split('\n').slice(0, 3)

function fetchMobile(hostname, path) {
  return new Promise((resolve, reject) => {
    https.get({hostname, path, headers: {'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'}}, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d))
    }).on('error', reject)
  })
}

function cleanHtml(str) {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n\s*\n/g, '\n')
    .trim()
}

async function run() {
  for (const link of links) {
    const name = new URL(link).pathname.replace('/', '')
    console.log(`\n=== ${name} ===`)
    const html = await fetchMobile('m.vk.com', `/${name}/wall`)
    
    // Name
    const author = html.match(/class="[^"]*pi_author[^"]*"[^>]*>([^<]+)<\/a>/)
    console.log('Name:', author ? cleanHtml(author[1]) : 'N/A')
    
    // Avatar
    const avaMatch = html.match(/background-image:\s*url\(\s*['"]?([^)'"]*ava=1[^)'"]*)['"]?\s*\)/)
    console.log('Avatar:', avaMatch ? 'YES' : 'NO')
    
    // Post
    const piClass = html.indexOf('class="pi_text"')
    if (piClass < 0) { console.log('No pi_text'); continue }
    
    const gt = html.indexOf('>', piClass)
    const divEnd = html.indexOf('</div>', gt + 1)
    const raw = html.substring(gt + 1, divEnd)
    
    // Убираем PostTextMore
    const postTextMore = raw.indexOf('<a class="PostTextMore"')
    let visibleRaw = postTextMore > 0 ? raw.substring(0, postTextMore) : raw
    visibleRaw = visibleRaw.replace(/<span[^>]*display:\s*none[^>]*>[\s\S]*?<\/span>/gi, '')
    
    // Hidden
    const hiddenMatch = raw.match(/<span[^>]*display:\s*none[^>]*>([\s\S]*?)<\/span>/i)
    let fullText
    if (hiddenMatch) {
      const hiddenClean = cleanHtml(hiddenMatch[1])
      const visibleClean = cleanHtml(visibleRaw)
      const overlap = Math.min(visibleClean.length, hiddenClean.length, 20)
      fullText = visibleClean
      for (let i = overlap; i >= 0; i--) {
        if (hiddenClean.startsWith(visibleClean.substring(visibleClean.length - i))) {
          fullText = visibleClean + hiddenClean.substring(i)
          break
        }
      }
    } else {
      fullText = cleanHtml(visibleRaw)
    }
    
    // Image
    const gridImg = html.substring(piClass, piClass + 4000).match(/class="MediaGrid__imageElement"[^>]*src="([^"]+)"/)
    console.log('Image:', gridImg ? 'YES' : 'NO')
    
    console.log('Text:', fullText.substring(0, 100))
    console.log('Length:', fullText.length)
  }
}

run()
