const https = require('https')

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
  const html = await fetchMobile('m.vk.com', '/pervie_vagay/wall')
  
  // Ищем class="pi_text"
  const piClass = html.indexOf('class="pi_text"')
  console.log('pi_text class at:', piClass)
  
  if (piClass > 0) {
    // Находим > после class="pi_text"
    const gt = html.indexOf('>', piClass)
    console.log('> at:', gt)
    console.log('Char after >:', html.substring(gt + 1, gt + 50))
    
    // Находим </div> — это конец pi_text div
    const divEnd = html.indexOf('</div>', gt + 1)
    console.log('</div> at:', divEnd)
    console.log('Block length:', divEnd - gt - 1)
    
    const raw = html.substring(gt + 1, divEnd)
    console.log('\nFirst 500 chars:')
    console.log(raw.substring(0, 500))
    console.log('\nLast 200 chars:')
    console.log(raw.substring(Math.max(0, raw.length - 200)))
  }
  
  // Теперь ищем скрытый span
  console.log('\n\n=== Hidden span search ===')
  const hiddenIdx = html.indexOf('display: none', piClass)
  console.log('display:none at:', hiddenIdx)
  
  if (hiddenIdx > 0) {
    // Находим > после display: none
    const spanGt = html.indexOf('>', hiddenIdx)
    // Находим </span>
    const spanEnd = html.indexOf('</span>', spanGt + 1)
    
    if (spanEnd > spanGt) {
      const hidden = html.substring(spanGt + 1, spanEnd)
      console.log('\nHidden text:')
      console.log(hidden.substring(0, 500))
      console.log('\nCleaned:')
      console.log(cleanHtml(hidden).substring(0, 500))
    }
  }
}

run()
