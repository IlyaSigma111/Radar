'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface Video {
  id: string
  title: string
  duration: number
  thumb: string | null
  isClip: boolean
}

interface Post {
  id: string
  name: string
  text: string
  time: string
  likes: number
  comments: number
  reposts: number
  views: number
  hasPoll: boolean
  hasLink: boolean
  mediaTypes: string[]
  image: string | null
  images: string[]
  avatar: string | null
  createdAt: number
  publishedAt: number
  link: string
  source: string
  video: Video | null
  attachmentsCount: number
}

interface ScanStats {
  totalScans: number
  postsScanned: number
  newPosts: number
  errors: number
  apiCalls: number
  rateLimits: number
  updatedAt: number
}

type Tab = 'dashboard' | 'posts' | 'groups' | 'settings'

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - Math.floor(ts / 1000)
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return `${Math.floor(diff / 86400)} дн назад`
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function decodeHtml(s: string): string {
  if (!s) return ''
  const el = typeof document !== 'undefined' ? document.createElement('textarea') : null
  if (!el) return s
  el.innerHTML = s
  return el.value
}

function parseVkLinks(text: string): string {
  return text
    .replace(/club(\d+)/g, '<a href="https://vk.com/public$1" target="_blank" class="vk-link">club$1</a>')
    .replace(/id(\d+)/g, '<a href="https://vk.com/id$1" target="_blank" class="vk-link">id$1</a>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" class="vk-link">$1</a>')
}

export default function TestPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [posts, setPosts] = useState<Post[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [stats, setStats] = useState<ScanStats | null>(null)
  const [total, setTotal] = useState(0)
  const [lastScan, setLastScan] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [newGroup, setNewGroup] = useState('')
  const [bulkGroups, setBulkGroups] = useState('')
  const [loading, setLoading] = useState(false)
  const [scannerActive, setScannerActive] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    try {
      const [postsRes, groupsRes, scanRes] = await Promise.all([
        fetch('/api/test/posts'),
        fetch('/api/test/groups'),
        fetch('/api/test/scan'),
      ])
      if (postsRes.ok) {
        const p = await postsRes.json()
        setPosts(Array.isArray(p) ? p.sort((a: Post, b: Post) => b.publishedAt - a.publishedAt) : [])
      }
      if (groupsRes.ok) {
        const g = await groupsRes.json()
        setGroups(Array.isArray(g) ? g : [])
      }
      if (scanRes.ok) {
        const s = await scanRes.json()
        setStats(s.stats || null)
        setTotal(s.total || 0)
        setLastScan(s.lastScan || 0)
        setScannerActive(s.stats?.updatedAt ? Date.now() - s.stats.updatedAt < 120000 : false)
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchData()
    const iv = setInterval(fetchData, 15000)
    return () => clearInterval(iv)
  }, [fetchData])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedPost(null)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const addGroup = async () => {
    if (!newGroup.trim()) return
    setLoading(true)
    try {
      await fetch('/api/test/add-group', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: newGroup.trim() }) })
      setNewGroup('')
      fetchData()
    } finally { setLoading(false) }
  }

  const removeGroup = async (url: string) => {
    setLoading(true)
    try {
      await fetch('/api/test/remove-group', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      fetchData()
    } finally { setLoading(false) }
  }

  const addBulk = async () => {
    const urls = bulkGroups.split('\n').map(s => s.trim()).filter(Boolean)
    for (const url of urls) {
      await fetch('/api/test/add-group', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
    }
    setBulkGroups('')
    fetchData()
  }

  const filteredPosts = posts.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return (p.name?.toLowerCase().includes(q) || p.text?.toLowerCase().includes(q))
  })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayPosts = posts.filter(p => p.publishedAt >= todayStart.getTime() / 1000)
  const filteredCount = filteredPosts.length

  const navItems: { key: Tab; label: string; icon: JSX.Element }[] = [
    { key: 'dashboard', label: 'Дашборд', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { key: 'posts', label: 'Посты', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
    { key: 'groups', label: 'Группы', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { key: 'settings', label: 'Настройки', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.73 12.73l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> },
  ]

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {!sidebarCollapsed && <div className="logo">VK RADAR</div>}
          <button className="collapse-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="9" y1="18" x2="15" y2="18"/>
              <line x1="9" y1="6" x2="15" y2="6"/>
              {sidebarCollapsed ? <polyline points="5 12 2 12"/> : <polyline points="19 12 22 12"/>}
            </svg>
          </button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`nav-item ${tab === item.key ? 'active' : ''}`}
              onClick={() => setTab(item.key)}
              title={item.label}
            >
              {item.icon}
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className={`scanner-dot ${scannerActive ? 'active' : ''}`} />
          {!sidebarCollapsed && <span className="scanner-label">{scannerActive ? 'Сканер активен' : 'Сканер неактивен'}</span>}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1 className="topbar-title">{tab === 'dashboard' ? 'Дашборд' : tab === 'posts' ? 'Посты' : tab === 'groups' ? 'Группы' : 'Настройки'}</h1>
          <div className="topbar-search">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input ref={searchRef} type="text" placeholder="Поиск… (Ctrl+K)" value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
          </div>
          <div className={`status-badge ${scannerActive ? 'active' : ''}`}>
            <span className="status-dot" />
            {scannerActive ? 'ON' : 'OFF'}
          </div>
        </header>

        <div className="content">
          {tab === 'dashboard' && (
            <div className="dashboard">
              <div className="stat-cards">
                <div className="stat-card">
                  <div className="stat-icon groups"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
                  <div className="stat-info">
                    <div className="stat-value">{groups.length}</div>
                    <div className="stat-label">Групп</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon posts"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                  <div className="stat-info">
                    <div className="stat-value">{total || posts.length}</div>
                    <div className="stat-label">Всего постов</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon today"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                  <div className="stat-info">
                    <div className="stat-value">{todayPosts.length}</div>
                    <div className="stat-label">Сегодня</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon filtered"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg></div>
                  <div className="stat-info">
                    <div className="stat-value">{filteredCount}</div>
                    <div className="stat-label">Найдено</div>
                  </div>
                </div>
              </div>

              {stats && (
                <div className="dash-grid">
                  <div className="dash-card">
                    <div className="dash-card-title">Сканирований</div>
                    <div className="dash-card-value">{stats.totalScans}</div>
                  </div>
                  <div className="dash-card">
                    <div className="dash-card-title">Постов проверено</div>
                    <div className="dash-card-value">{stats.postsScanned}</div>
                  </div>
                  <div className="dash-card">
                    <div className="dash-card-title">Новых</div>
                    <div className="dash-card-value green">{stats.newPosts}</div>
                  </div>
                  <div className="dash-card">
                    <div className="dash-card-title">Ошибок</div>
                    <div className="dash-card-value red">{stats.errors}</div>
                  </div>
                  <div className="dash-card">
                    <div className="dash-card-title">API вызовов</div>
                    <div className="dash-card-value">{stats.apiCalls}</div>
                  </div>
                  <div className="dash-card">
                    <div className="dash-card-title">Rate limits</div>
                    <div className="dash-card-value">{stats.rateLimits}</div>
                  </div>
                </div>
              )}

              {lastScan > 0 && (
                <div className="last-scan">
                  Последнее сканирование: {timeAgo(lastScan / 1000)}
                </div>
              )}

              <div className="feed-section">
                <h3 className="feed-title">Последние посты</h3>
                <div className="feed-list">
                  {posts.slice(0, 20).map(p => (
                    <div key={p.id} className="feed-item" onClick={() => setSelectedPost(p)}>
                      {p.avatar ? <img src={p.avatar} className="feed-avatar" alt="" /> : <div className="feed-avatar-placeholder"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg></div>}
                      <div className="feed-item-content">
                        <div className="feed-item-header">
                          <span className="feed-item-name">{decodeHtml(p.name)}</span>
                          <span className="feed-item-time">{timeAgo(p.publishedAt)}</span>
                        </div>
                        <div className="feed-item-text" dangerouslySetInnerHTML={{ __html: parseVkLinks(decodeHtml(p.text?.substring(0, 200) || '')) }} />
                        <div className="feed-item-stats">
                          <span>❤ {fmtNum(p.likes)}</span>
                          <span>💬 {fmtNum(p.comments)}</span>
                          <span>👁 {fmtNum(p.views)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'posts' && (
            <div className="posts-page">
              <div className="feed-grid">
                {filteredPosts.map(p => (
                  <div key={p.id} className="feed-card" onClick={() => setSelectedPost(p)}>
                    {(p.image || (p.images && p.images.length > 0) || p.video) && (
                      <div className="feed-card-media">
                        {p.video ? (
                          <div className="feed-card-video">
                            {p.video.thumb && <img src={p.video.thumb} alt="" className="feed-card-thumb" />}
                            <div className="feed-card-play"><svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
                            {p.video.isClip && <span className="feed-card-clip">CLIP</span>}
                          </div>
                        ) : (
                          <img src={p.image || p.images[0]} alt="" className="feed-card-img" />
                        )}
                      </div>
                    )}
                    <div className="feed-card-body">
                      <div className="feed-card-header">
                        {p.avatar ? <img src={p.avatar} className="feed-card-avatar" alt="" /> : <div className="feed-card-avatar-placeholder" />}
                        <div>
                          <div className="feed-card-name">{decodeHtml(p.name)}</div>
                          <div className="feed-card-time">{timeAgo(p.publishedAt)}</div>
                        </div>
                      </div>
                      <div className="feed-card-text" dangerouslySetInnerHTML={{ __html: parseVkLinks(decodeHtml(p.text?.substring(0, 300) || '')) }} />
                      {p.hasPoll && <span className="feed-card-badge">Опрос</span>}
                      {p.hasLink && <span className="feed-card-badge link">Ссылка</span>}
                      {p.mediaTypes?.length > 0 && <span className="feed-card-badge media">{p.mediaTypes.join(', ')}</span>}
                    </div>
                    <div className="feed-card-footer">
                      <span>❤ {fmtNum(p.likes)}</span>
                      <span>💬 {fmtNum(p.comments)}</span>
                      <span>🔄 {fmtNum(p.reposts)}</span>
                      <span>👁 {fmtNum(p.views)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {filteredPosts.length === 0 && <div className="empty-state">Нет постов</div>}
            </div>
          )}

          {tab === 'groups' && (
            <div className="groups-page">
              <div className="groups-form">
                <h3 className="groups-section-title">Добавить группу</h3>
                <div className="groups-input-row">
                  <input type="text" placeholder="https://vk.com/groupname" value={newGroup} onChange={e => setNewGroup(e.target.value)} className="groups-input" onKeyDown={e => e.key === 'Enter' && addGroup()} />
                  <button onClick={addGroup} disabled={loading} className="groups-btn primary">Добавить</button>
                </div>
                <h3 className="groups-section-title">Массовое добавление</h3>
                <textarea placeholder="По одному URL на строку" value={bulkGroups} onChange={e => setBulkGroups(e.target.value)} className="groups-textarea" rows={4} />
                <button onClick={addBulk} disabled={loading || !bulkGroups.trim()} className="groups-btn primary">Добавить все</button>
              </div>
              <div className="groups-list">
                <h3 className="groups-section-title">Группы ({groups.length})</h3>
                {groups.map(g => (
                  <div key={g} className="group-item">
                    <svg className="vk-badge" width="20" height="20" viewBox="0 0 24 24" fill="#4f8eff"><path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.6-.188 1.37 1.245 2.185 1.793.616.414 1.085.324 1.085.324l2.175-.03s1.139-.07.599-.964c-.044-.073-.314-.663-1.618-1.872-1.366-1.266-1.183-1.06.462-3.254.999-1.332 1.398-2.144 1.273-2.494-.118-.33-.853-.243-.853-.243l-2.458.015s-.183-.025-.317.056c-.13.079-.214.264-.214.264s-.385 1.024-.898 1.894c-1.083 1.834-1.516 1.932-1.693 1.816-.411-.27-.308-1.085-.308-1.664 0-1.805.273-2.558-.531-2.754-.267-.066-.463-.109-1.144-.116-.874-.009-1.611.003-2.028.207-.278.136-.495.44-.363.458.163.022.531.1.727.366.252.34.244 1.106.244 1.106s.146 2.112-.341 2.371c-.333.178-.791-.185-1.774-1.852-.504-.854-.884-1.794-.884-1.794s-.073-.18-.205-.277c-.16-.117-.384-.154-.384-.154l-2.33.015s-.35.01-.478.162c-.115.134-.009.412-.009.412s1.826 4.278 3.893 6.435c1.891 1.976 4.033 1.844 4.033 1.844z"/></svg>
                    <span className="group-name">{g}</span>
                    <button onClick={() => removeGroup(g)} className="group-remove" title="Удалить">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
                {groups.length === 0 && <div className="empty-state">Нет добавленных групп</div>}
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="settings-page">
              <div className="settings-card">
                <h3 className="settings-card-title">Статус сканера</h3>
                <div className="settings-row">
                  <span className="settings-label">Статус:</span>
                  <span className={`settings-value ${scannerActive ? 'green' : 'red'}`}>{scannerActive ? 'Активен' : 'Неактивен'}</span>
                </div>
                {lastScan > 0 && (
                  <div className="settings-row">
                    <span className="settings-label">Последнее сканирование:</span>
                    <span className="settings-value">{timeAgo(lastScan / 1000)}</span>
                  </div>
                )}
                {stats && (
                  <div className="settings-row">
                    <span className="settings-label">Всего сканирований:</span>
                    <span className="settings-value">{stats.totalScans}</span>
                  </div>
                )}
              </div>

              <div className="settings-card">
                <h3 className="settings-card-title">Данные</h3>
                <div className="settings-row">
                  <span className="settings-label">Файл:</span>
                  <span className="settings-value mono">data/posts.json</span>
                </div>
                <div className="settings-row">
                  <span className="settings-label">Постов в файле:</span>
                  <span className="settings-value">{total || posts.length}</span>
                </div>
                <div className="settings-row">
                  <span className="settings-label">Групп:</span>
                  <span className="settings-value">{groups.length}</span>
                </div>
              </div>

              <div className="settings-card">
                <h3 className="settings-card-title">Как запустить</h3>
                <div className="settings-instructions">
                  <div className="settings-step">
                    <span className="step-num">1</span>
                    <div>
                      <div className="step-title">Запустить сканер</div>
                      <code className="step-code">node test-scanner.js</code>
                    </div>
                  </div>
                  <div className="settings-step">
                    <span className="step-num">2</span>
                    <div>
                      <div className="step-title">Запустить сервер</div>
                      <code className="step-code">npx next dev</code>
                    </div>
                  </div>
                  <div className="settings-step">
                    <span className="step-num">3</span>
                    <div>
                      <div className="step-title">Открыть в браузере</div>
                      <code className="step-code">localhost:3000/test</code>
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-card">
                <h3 className="settings-card-title">О приложении</h3>
                <p className="settings-about">
                  VK Radar — парсер и агрегатор постов из ВКонтакте. Сканер автоматически собирает посты из добавленных групп, сохраняет их в локальный JSON-файл.
                </p>
                <div className="settings-row">
                  <span className="settings-label">Версия:</span>
                  <span className="settings-value">1.0.0</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {selectedPost && (
        <div className="modal-overlay" onClick={() => setSelectedPost(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedPost(null)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div className="modal-header">
              {selectedPost.avatar && <img src={selectedPost.avatar} className="modal-avatar" alt="" />}
              <div>
                <div className="modal-name">{decodeHtml(selectedPost.name)}</div>
                <div className="modal-time">{timeAgo(selectedPost.publishedAt)}</div>
              </div>
            </div>
            <div className="modal-body">
              <div className="modal-text" dangerouslySetInnerHTML={{ __html: parseVkLinks(decodeHtml(selectedPost.text || '')) }} />
              {selectedPost.image && <img src={selectedPost.image} className="modal-img" alt="" />}
              {selectedPost.images && selectedPost.images.length > 1 && (
                <div className="modal-images">
                  {selectedPost.images.map((img, i) => <img key={i} src={img} className="modal-img" alt="" />)}
                </div>
              )}
              {selectedPost.video && (
                <div className="modal-video">
                  {selectedPost.video.thumb && <img src={selectedPost.video.thumb} alt="" />}
                  <div className="modal-video-info">{selectedPost.video.title} ({selectedPost.video.isClip ? 'Clip' : 'Video'})</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <span>❤ {fmtNum(selectedPost.likes)}</span>
              <span>💬 {fmtNum(selectedPost.comments)}</span>
              <span>🔄 {fmtNum(selectedPost.reposts)}</span>
              <span>👁 {fmtNum(selectedPost.views)}</span>
              <a href={selectedPost.link} target="_blank" rel="noopener noreferrer" className="modal-vk-link">Открыть в VK →</a>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #0c0f14; color: #c8cdd5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

        .app { display: flex; height: 100vh; overflow: hidden; }

        .sidebar { width: 220px; background: #10141b; border-right: 1px solid #1e2330; display: flex; flex-direction: column; transition: width .2s; flex-shrink: 0; }
        .sidebar.collapsed { width: 56px; }
        .sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #1e2330; }
        .logo { font-size: 14px; font-weight: 800; color: #4f8eff; letter-spacing: 2px; white-space: nowrap; }
        .collapse-btn { background: none; border: none; color: #6b7280; cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
        .collapse-btn:hover { background: #1e2330; color: #c8cdd5; }
        .sidebar-nav { flex: 1; padding: 8px; display: flex; flex-direction: column; gap: 2px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; border: none; background: none; color: #6b7280; cursor: pointer; font-size: 14px; transition: all .15s; text-align: left; width: 100%; }
        .nav-item:hover { background: #1a1f2e; color: #c8cdd5; }
        .nav-item.active { background: #1a2340; color: #4f8eff; }
        .nav-item span { white-space: nowrap; }
        .sidebar-footer { padding: 16px; border-top: 1px solid #1e2330; display: flex; align-items: center; gap: 8px; }
        .scanner-dot { width: 8px; height: 8px; border-radius: 50%; background: #374151; flex-shrink: 0; }
        .scanner-dot.active { background: #22c55e; box-shadow: 0 0 8px #22c55e88; }
        .scanner-label { font-size: 12px; color: #6b7280; white-space: nowrap; }

        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .topbar { display: flex; align-items: center; padding: 12px 24px; gap: 16px; border-bottom: 1px solid #1e2330; background: #0c0f14; flex-shrink: 0; }
        .topbar-title { font-size: 18px; font-weight: 700; color: #e5e7eb; flex-shrink: 0; }
        .topbar-search { flex: 1; max-width: 400px; position: relative; }
        .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #6b7280; }
        .search-input { width: 100%; padding: 8px 12px 8px 34px; background: #13171e; border: 1px solid #1e2330; border-radius: 8px; color: #c8cdd5; font-size: 13px; outline: none; }
        .search-input:focus { border-color: #4f8eff; }
        .status-badge { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #1a1a2e; color: #ef4444; flex-shrink: 0; }
        .status-badge.active { background: #0f2e1a; color: #22c55e; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

        .content { flex: 1; overflow-y: auto; padding: 24px; }

        .stat-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: #13171e; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; border: 1px solid #1e2330; }
        .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .stat-icon.groups { background: #1a2340; color: #4f8eff; }
        .stat-icon.posts { background: #2a1f3e; color: #a78bfa; }
        .stat-icon.today { background: #0f2e1a; color: #22c55e; }
        .stat-icon.filtered { background: #2e2a0f; color: #f59e0b; }
        .stat-value { font-size: 24px; font-weight: 700; color: #e5e7eb; }
        .stat-label { font-size: 12px; color: #6b7280; margin-top: 2px; }

        .dash-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .dash-card { background: #13171e; border-radius: 10px; padding: 16px; border: 1px solid #1e2330; }
        .dash-card-title { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
        .dash-card-value { font-size: 22px; font-weight: 700; color: #e5e7eb; }
        .dash-card-value.green { color: #22c55e; }
        .dash-card-value.red { color: #ef4444; }

        .last-scan { font-size: 12px; color: #6b7280; margin-bottom: 24px; padding: 8px 12px; background: #13171e; border-radius: 8px; display: inline-block; }

        .feed-section { margin-top: 8px; }
        .feed-title { font-size: 14px; font-weight: 600; color: #9ca3af; margin-bottom: 12px; }
        .feed-list { display: flex; flex-direction: column; gap: 2px; }
        .feed-item { display: flex; gap: 12px; padding: 12px; border-radius: 8px; cursor: pointer; transition: background .15s; }
        .feed-item:hover { background: #13171e; }
        .feed-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .feed-avatar-placeholder { width: 36px; height: 36px; border-radius: 50%; background: #1e2330; display: flex; align-items: center; justify-content: center; color: #6b7280; flex-shrink: 0; }
        .feed-item-content { flex: 1; min-width: 0; }
        .feed-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .feed-item-name { font-size: 13px; font-weight: 600; color: #e5e7eb; }
        .feed-item-time { font-size: 11px; color: #6b7280; flex-shrink: 0; }
        .feed-item-text { font-size: 13px; color: #9ca3af; line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .feed-item-stats { display: flex; gap: 12px; margin-top: 6px; font-size: 12px; color: #6b7280; }

        .posts-page {}
        .feed-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
        .feed-card { background: #13171e; border-radius: 12px; overflow: hidden; border: 1px solid #1e2330; cursor: pointer; transition: border-color .15s, transform .15s; display: flex; flex-direction: column; }
        .feed-card:hover { border-color: #4f8eff44; transform: translateY(-2px); }
        .feed-card-media { position: relative; }
        .feed-card-img { width: 100%; height: 200px; object-fit: cover; }
        .feed-card-video { position: relative; height: 200px; background: #0c0f14; display: flex; align-items: center; justify-content: center; }
        .feed-card-thumb { width: 100%; height: 100%; object-fit: cover; }
        .feed-card-play { position: absolute; width: 48px; height: 48px; background: #00000088; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .feed-card-clip { position: absolute; top: 8px; right: 8px; background: #000000aa; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
        .feed-card-body { padding: 14px; flex: 1; }
        .feed-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .feed-card-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
        .feed-card-avatar-placeholder { width: 32px; height: 32px; border-radius: 50%; background: #1e2330; }
        .feed-card-name { font-size: 13px; font-weight: 600; color: #e5e7eb; }
        .feed-card-time { font-size: 11px; color: #6b7280; }
        .feed-card-text { font-size: 13px; color: #9ca3af; line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; margin-bottom: 8px; }
        .feed-card-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; background: #1e2330; color: #6b7280; margin-right: 6px; margin-top: 4px; }
        .feed-card-badge.link { background: #1a2340; color: #4f8eff; }
        .feed-card-badge.media { background: #2a1f3e; color: #a78bfa; }
        .feed-card-footer { display: flex; gap: 16px; padding: 10px 14px; border-top: 1px solid #1e2330; font-size: 12px; color: #6b7280; }

        .groups-page { max-width: 700px; }
        .groups-form { background: #13171e; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #1e2330; }
        .groups-section-title { font-size: 14px; font-weight: 600; color: #e5e7eb; margin-bottom: 12px; }
        .groups-input-row { display: flex; gap: 8px; margin-bottom: 16px; }
        .groups-input { flex: 1; padding: 10px 14px; background: #0c0f14; border: 1px solid #1e2330; border-radius: 8px; color: #c8cdd5; font-size: 13px; outline: none; }
        .groups-input:focus { border-color: #4f8eff; }
        .groups-textarea { width: 100%; padding: 10px 14px; background: #0c0f14; border: 1px solid #1e2330; border-radius: 8px; color: #c8cdd5; font-size: 13px; outline: none; resize: vertical; margin-bottom: 12px; }
        .groups-textarea:focus { border-color: #4f8eff; }
        .groups-btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background .15s; }
        .groups-btn.primary { background: #4f8eff; color: #fff; }
        .groups-btn.primary:hover { background: #3d7ae6; }
        .groups-btn:disabled { opacity: .5; cursor: not-allowed; }
        .groups-list { background: #13171e; border-radius: 12px; padding: 20px; border: 1px solid #1e2330; }
        .group-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #1e2330; }
        .group-item:last-child { border-bottom: none; }
        .vk-badge { flex-shrink: 0; }
        .group-name { flex: 1; font-size: 14px; color: #e5e7eb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .group-remove { background: none; border: none; color: #6b7280; cursor: pointer; padding: 4px; border-radius: 4px; display: flex; }
        .group-remove:hover { color: #ef4444; background: #1e2330; }

        .settings-page { max-width: 700px; display: flex; flex-direction: column; gap: 16px; }
        .settings-card { background: #13171e; border-radius: 12px; padding: 20px; border: 1px solid #1e2330; }
        .settings-card-title { font-size: 14px; font-weight: 600; color: #e5e7eb; margin-bottom: 16px; }
        .settings-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #1e233022; }
        .settings-row:last-child { border-bottom: none; }
        .settings-label { font-size: 13px; color: #6b7280; }
        .settings-value { font-size: 13px; color: #e5e7eb; }
        .settings-value.green { color: #22c55e; }
        .settings-value.red { color: #ef4444; }
        .settings-value.mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; background: #0c0f14; padding: 2px 8px; border-radius: 4px; }
        .settings-about { font-size: 13px; color: #9ca3af; line-height: 1.6; margin-bottom: 12px; }
        .settings-instructions { display: flex; flex-direction: column; gap: 14px; }
        .settings-step { display: flex; align-items: flex-start; gap: 12px; }
        .step-num { width: 24px; height: 24px; border-radius: 50%; background: #4f8eff22; color: #4f8eff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .step-title { font-size: 13px; color: #c8cdd5; margin-bottom: 4px; }
        .step-code { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; background: #0c0f14; padding: 4px 10px; border-radius: 6px; color: #a78bfa; display: inline-block; border: 1px solid #1e2330; }

        .modal-overlay { position: fixed; inset: 0; background: #000000cc; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .modal { background: #13171e; border-radius: 16px; max-width: 640px; width: 100%; max-height: 85vh; overflow-y: auto; position: relative; border: 1px solid #1e2330; }
        .modal-close { position: absolute; top: 12px; right: 12px; background: #0c0f14; border: none; color: #6b7280; cursor: pointer; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; z-index: 1; }
        .modal-close:hover { color: #e5e7eb; background: #1e2330; }
        .modal-header { display: flex; align-items: center; gap: 12px; padding: 20px 20px 0; }
        .modal-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
        .modal-name { font-size: 15px; font-weight: 600; color: #e5e7eb; }
        .modal-time { font-size: 12px; color: #6b7280; }
        .modal-body { padding: 16px 20px; }
        .modal-text { font-size: 14px; color: #c8cdd5; line-height: 1.7; word-break: break-word; }
        .modal-img { width: 100%; border-radius: 10px; margin-top: 12px; }
        .modal-images { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
        .modal-video { margin-top: 12px; text-align: center; }
        .modal-video img { max-width: 100%; border-radius: 10px; }
        .modal-video-info { font-size: 13px; color: #6b7280; margin-top: 8px; }
        .modal-footer { display: flex; align-items: center; gap: 20px; padding: 14px 20px; border-top: 1px solid #1e2330; font-size: 13px; color: #6b7280; flex-wrap: wrap; }
        .modal-vk-link { margin-left: auto; color: #4f8eff; text-decoration: none; font-weight: 600; font-size: 13px; }
        .modal-vk-link:hover { text-decoration: underline; }

        .vk-link { color: #4f8eff; text-decoration: none; }
        .vk-link:hover { text-decoration: underline; }

        .empty-state { text-align: center; padding: 60px 20px; color: #6b7280; font-size: 14px; }
      `}</style>
    </div>
  )
}