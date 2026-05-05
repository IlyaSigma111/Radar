// Простой polling-скрипт для постоянного сканирования
const { exec } = require('child_process')
const https = require('https')

const SCAN_URL = 'https://radar-main.vercel.app/api/scan'
const INTERVAL_MS = 30000 // 30 секунд

function log(msg) {
  const time = new Date().toLocaleTimeString('ru-RU')
  console.log(`[${time}] ${msg}`)
}

function runScan() {
  log('Запуск сканирования...')
  const start = Date.now()
  
  https.get(SCAN_URL, (res) => {
    let data = ''
    res.on('data', chunk => data += chunk)
    res.on('end', () => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      try {
        const result = JSON.parse(data)
        log(`Готово за ${elapsed}s: ${result.scanned} просканировано, ${result.new} новых, ${result.posted} репостов`)
      } catch {
        log(`Готово за ${elapsed}s: ${data.substring(0, 100)}`)
      }
    })
  }).on('error', (err) => {
    log(`Ошибка: ${err.message}`)
  })
}

log(`Polling запущен. Интервал: ${INTERVAL_MS / 1000}с`)
log(`URL: ${SCAN_URL}`)

// Запускаем сразу
runScan()

// Затем каждые 30 секунд
setInterval(runScan, INTERVAL_MS)
