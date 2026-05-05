'use client'

import { useState, useEffect } from 'react'

const FIREBASE_URL = 'https://radar-fdaae-default-rtdb.firebaseio.com'

export default function LinksPage() {
  const [links, setLinks] = useState<string[]>([])
  const [bulkText, setBulkText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch(`${FIREBASE_URL}/groups.json`)
      .then(r => r.json())
      .then(data => {
        if (data && typeof data === 'object') {
          const seen = new Set<string>()
          const unique: string[] = []
          for (const link of Object.values(data) as string[]) {
            try {
              const u = new URL(link)
              const parts = u.pathname.split('/').filter(Boolean)
              if (parts.length === 0) continue
              const key = parts[0]
              if (!seen.has(key)) {
                seen.add(key)
                unique.push(link)
              }
            } catch {}
          }
          setLinks(unique)
        } else {
          setLinks([])
        }
      })
      .catch(() => setLinks([]))
  }, [])

  const normalizeUrl = (raw: string): string | null => {
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

  const getDisplayName = (url: string): string => {
    try {
      const u = new URL(url)
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts.length === 0) return url
      const name = parts[0]
      if (name.startsWith('club') || /^\d+$/.test(name)) return `vk.com/${name}`
      return name.replace(/_/g, ' ')
    } catch {
      return url
    }
  }

  const extractLinks = (text: string): string[] => {
    const results: string[] = []
    const lines = text.split(/[\s,;]+/)
    for (const line of lines) {
      if (!line.trim()) continue
      const norm = normalizeUrl(line.trim())
      if (norm) results.push(norm)
    }
    // Дедупликация
    const seen = new Set<string>()
    return results.filter(l => {
      if (seen.has(l)) return false
      seen.add(l)
      return true
    })
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    const urls = extractLinks(bulkText)
    if (urls.length === 0) {
      setMessage('❌ Не найдено ни одной ссылки на ВК')
      return
    }

    setSaving(true)
    const added: string[] = []
    const errors: string[] = []
    const duplicates: string[] = []

    for (const url of urls) {
      try {
        const res = await fetch('/api/add-group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        const data = await res.json()
        if (res.status === 409) {
          duplicates.push(getDisplayName(url))
        } else if (!res.ok) {
          errors.push(`${getDisplayName(url)}: ${data.error}`)
        } else {
          added.push(url)
        }
      } catch {
        errors.push(getDisplayName(url))
      }
    }

    if (added.length > 0) {
      setLinks(prev => [...prev, ...added])
      setBulkText('')
    }

    const parts: string[] = []
    if (added.length > 0) parts.push(`✅ Добавлено: ${added.length}`)
    if (duplicates.length > 0) parts.push(`⚠️ Уже есть: ${duplicates.length}`)
    if (errors.length > 0) parts.push(`❌ Ошибки: ${errors.length}`)
    setMessage(parts.join(' | '))
    setSaving(false)
  }

  const handleRemove = async (url: string) => {
    const normalized = normalizeUrl(url)
    if (!normalized) return
    try {
      const res = await fetch('/api/remove-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized }),
      })
      if (!res.ok) return
      setLinks(prev => prev.filter(l => normalizeUrl(l) !== normalized))
    } catch {}
  }

  return (
    <main className="links-page">
      <div className="links-container">
        <a href="/" className="back-link">← Назад к радару</a>

        <h1 className="links-title">Добавить группу</h1>
        <p className="links-desc">
          Вставьте одну или сразу много ссылок. Поддерживаются: одна на строку, через запятую, пробел или точку с запятой.
        </p>

        <form onSubmit={handleBulkSubmit} className="links-form">
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder={`vk.com/group1, vk.com/group2\nhttps://vk.com/club123\nvk.com/club456; vk.com/group7`}
            className="links-input"
            rows={4}
            disabled={saving}
          />
          <button type="submit" disabled={saving} className="links-btn">
            {saving ? `Добавляю (${links.length + 1}...)` : 'Добавить все'}
          </button>
        </form>

        {message && <div className={`links-msg ${message.startsWith('✅') ? 'ok' : message.startsWith('❌') ? 'err' : 'warn'}`}>{message}</div>}

        <div className="links-list-section">
          <h2 className="links-list-title">Группы на радаре ({links.length})</h2>
          <div className="links-list">
            {links.map((url, i) => {
              const normalized = normalizeUrl(url) || url
              return (
                <div key={i} className="links-item">
                  <a href={normalized} target="_blank" rel="noopener noreferrer" className="links-item-link">
                    <span className="links-item-icon">VK</span>
                    <span className="links-item-name">{getDisplayName(url)}</span>
                  </a>
                  <button onClick={() => handleRemove(url)} className="links-item-remove" title="Удалить">×</button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="links-footer">
          <span>© Движение Первых 2026</span>
        </div>
      </div>

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #0a1628; }
        .links-page {
          min-height: 100vh;
          background: radial-gradient(ellipse at center, #0d1f3c 0%, #0a1628 50%, #060e1a 100%);
          padding: 40px 20px 80px;
        }
        .links-container {
          max-width: 600px;
          margin: 0 auto;
        }
        .back-link {
          color: #4169e1;
          text-decoration: none;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 32px;
        }
        .back-link:hover { text-decoration: underline; }
        .links-title {
          color: #4169e1;
          font-size: 32px;
          font-weight: 900;
          letter-spacing: 2px;
          margin-bottom: 8px;
        }
        .links-desc {
          color: #7a8ba8;
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .links-form {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
          flex-direction: column;
        }
        .links-input {
          width: 100%;
          padding: 14px 18px;
          border-radius: 12px;
          border: 2px solid rgba(65, 105, 225, 0.3);
          background: rgba(13, 31, 60, 0.8);
          color: #c5d0e0;
          font-size: 15px;
          outline: none;
          resize: vertical;
          font-family: inherit;
          line-height: 1.6;
        }
        .links-input:focus {
          border-color: #4169e1;
        }
        .links-input::placeholder {
          color: #5a6a80;
        }
        .links-btn {
          padding: 14px 24px;
          border-radius: 12px;
          border: none;
          background: #4169e1;
          color: white;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          white-space: nowrap;
        }
        .links-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .links-msg {
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
          margin-bottom: 24px;
        }
        .links-msg.ok {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }
        .links-msg.err {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .links-msg.warn {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }
        .links-list-section { margin-top: 16px; }
        .links-list-title {
          color: #7a8ba8;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
        }
        .links-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .links-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: rgba(65, 105, 225, 0.08);
          border: 1px solid rgba(65, 105, 225, 0.12);
          border-radius: 10px;
        }
        .links-item-link {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          flex: 1;
          min-width: 0;
        }
        .links-item-link:hover .links-item-name {
          color: #818cf8;
        }
        .links-item-icon {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: rgba(65, 105, 225, 0.2);
          color: #4169e1;
          font-size: 9px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .links-item-name {
          color: #c5d0e0;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .links-item-remove {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: none;
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          font-size: 18px;
          cursor: pointer;
          flex-shrink: 0;
          margin-left: 12px;
        }
        .links-item-remove:hover {
          background: rgba(239, 68, 68, 0.3);
        }
        .links-footer {
          text-align: center;
          margin-top: 40px;
          font-size: 12px;
          color: #5a6a80;
        }
      `}</style>
    </main>
  )
}
