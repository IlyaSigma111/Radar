'use client'

import { useEffect, useState, useCallback } from 'react'
import './admin.css'

interface ScanState {
  maxId: number
  updatedAt: number
}

interface GroupInfo {
  name: string
  url: string
  maxId: number
  updatedAt: number
  postsFound?: number
  newPosts?: number
  vkTime?: number
  batches?: number
  errors?: string[]
}

interface PostData {
  id: string
  name: string
  text: string
  time: string
  likes: number
  comments?: number
  views?: number
  domain: string
  video: any
  images?: string[]
  link?: string
  createdAt: number
}

interface LogEntry {
  time: number
  level: string
  message: string
  duration?: number
  retry?: number
  errors?: string[]
}

interface ScannerStats {
  uptime?: number
  lastScan?: {
    start: number
    end: number
    duration: number
    groups: number
    newPosts: number
    errors: string[]
  }
  totals?: {
    scans: number
    scanned: number
    new: number
    posted: number
    errors: number
    retries: number
    vkApiCalls: number
    vkRateLimits: number
    vkServerErrors: number
  }
  groups?: Record<string, any>
  logs?: LogEntry[]
  updatedAt?: number
}

const DB_URL = 'https://radar-fdaae-default-rtdb.firebaseio.com'
const API_URL = typeof window !== 'undefined' ? window.location.origin : ''

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m < 60) return `${m}m ${sec}s`
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${h}h ${min}m`
}

function timeAgo(ts: number): string {
  if (!ts) return 'Никогда'
  const diff = Date.now() - ts
  if (diff < 5000) return 'Только что'
  if (diff < 60000) return `${Math.floor(diff / 1000)}с назад`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}м назад`
  return `${Math.floor(diff / 3600000)}ч назад`
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}д`)
  if (h % 24 > 0) parts.push(`${h % 24}ч`)
  if (m % 60 > 0) parts.push(`${m % 60}м`)
  return parts.join(' ') || '< 1м'
}

export default function AdminPage() {
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [posts, setPosts] = useState<PostData[]>([])
  const [scanState, setScanState] = useState<Record<string, ScanState>>({})
  const [stats, setStats] = useState<ScannerStats | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string>('')
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [parserWorking, setParserWorking] = useState(false)

  async function dbFetch<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${DB_URL}/${path}.json`)
      return await res.json()
    } catch { return null }
  }

  const loadData = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    else setFetching(true)
    try {
      // Try new API endpoint first, fallback to Firebase
      try {
        const res = await fetch(`${API_URL}/api/admin/stats`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setGroups(data.groups || [])
          setPosts(data.recentPosts || [])
          setScanState({})
          if (data.stats) {
            setStats(data.stats)
            const sinceUpdate = Date.now() - (data.stats.updatedAt || 0)
            setParserWorking(sinceUpdate < 60000)
          }
          setLastUpdated(Date.now())
          return
        }
      } catch {
        // Fallback to Firebase
      }

      // Firebase fallback
      const [groupsData, postsData, stateData, statsData] = await Promise.all([
        dbFetch<Record<string, string>>('groups'),
        dbFetch<Record<string, PostData>>('posts'),
        dbFetch<Record<string, ScanState>>('scanState'),
        dbFetch<ScannerStats>('scannerStats')
      ])

      // Groups
      const groupList: GroupInfo[] = []
      if (groupsData && typeof groupsData === 'object') {
        for (const [, raw] of Object.entries(groupsData)) {
          let url = String(raw).trim()
          if (!url.startsWith('http')) url = 'https://' + url
          try {
            const parsed = new URL(url)
            const domain = parsed.pathname.split('/').filter(Boolean)[0]
            const st = stateData?.[domain]
            const sg = statsData?.groups?.[domain]
            groupList.push({
              name: domain,
              url,
              maxId: st?.maxId || 0,
              updatedAt: st?.updatedAt || 0,
              vkTime: sg?.vkTime,
              batches: sg?.batches,
              postsFound: sg?.postsFound,
              newPosts: sg?.newPosts,
              errors: sg?.errors
            })
          } catch {}
        }
      }
      setGroups(groupList)

      // Posts
      const postList: PostData[] = []
      if (postsData && typeof postsData === 'object') {
        for (const [, p] of Object.entries(postsData)) {
          postList.push(p)
        }
        postList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      }
      setPosts(postList.slice(0, 20))

      setScanState(stateData || {})

      // Stats
      if (statsData) {
        setStats(statsData)
        const sinceUpdate = Date.now() - (statsData.updatedAt || 0)
        setParserWorking(sinceUpdate < 60000)
      } else {
        let latestStateUpdate = 0
        if (stateData && typeof stateData === 'object') {
          for (const [, s] of Object.entries(stateData)) {
            if (s?.updatedAt > latestStateUpdate) latestStateUpdate = s.updatedAt
          }
        }
        setParserWorking(latestStateUpdate > 0 && (Date.now() - latestStateUpdate) < 60000)
      }

      setLastUpdated(Date.now())
    } catch {
      // ignore errors, keep showing last data
    } finally {
      setLoading(false)
      setFetching(false)
    }
  }, [])

  async function triggerScan() {
    setScanning(true)
    setScanResult('')
    try {
      const res = await fetch('/api/scan')
      const data = await res.json()
      setScanResult(data.result || 'Завершено')
    } catch (e: any) {
      setScanResult(`Ошибка: ${e.message}`)
    }
    setScanning(false)
    setTimeout(() => loadData(false), 2000)
  }

  useEffect(() => {
    loadData(true)
    const interval = setInterval(() => loadData(false), 10000)
    return () => clearInterval(interval)
  }, [loadData])

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Radar — Админ-панель</h1>
        <div className="header-info">
          <span className="updated">Обновлено: {new Date(lastUpdated).toLocaleTimeString('ru-RU')}</span>
          <button onClick={() => loadData(false)} className="refresh-btn" title="Обновить">&#x21bb;</button>
        </div>
      </div>

      {loading && <div className="loading">Загрузка данных...</div>}
      {fetching && <div className="fetching-indicator">Обновление...</div>}
      <div className="admin-content">
          {/* Health Status */}
          <div className="health-section">
            <h2>Здоровье парсера</h2>
            <div className="health-grid">
              <div className={`health-status ${parserWorking ? 'working' : 'stopped'}`}>
                <div className="status-dot" />
                <div>
                  <span className="status-label">Парсер</span>
                  <span className="status-value">{parserWorking ? 'Работает' : 'Не работает / Нет данных'}</span>
                </div>
              </div>
              {stats?.uptime && (
                <div className="health-card">
                  <span className="card-label">Аптайм</span>
                  <span className="card-value">{formatUptime(stats.uptime)}</span>
                </div>
              )}
              {stats?.totals && (
                <>
                  <div className="health-card">
                    <span className="card-label">Всего сканов</span>
                    <span className="card-value">{stats.totals.scans}</span>
                  </div>
                  <div className="health-card">
                    <span className="card-label">Постов найдено</span>
                    <span className="card-value">{stats.totals.new}</span>
                  </div>
                  <div className="health-card">
                    <span className="card-label">Авто-репостов</span>
                    <span className="card-value">{stats.totals.posted}</span>
                  </div>
                  <div className="health-card">
                    <span className="card-label">VK API вызовов</span>
                    <span className="card-value">{stats.totals.vkApiCalls}</span>
                  </div>
                  <div className={`health-card ${stats.totals.vkRateLimits > 0 ? 'warning' : ''}`}>
                    <span className="card-label">Rate limits</span>
                    <span className="card-value">{stats.totals.vkRateLimits}</span>
                  </div>
                  <div className={`health-card ${stats.totals.errors > 0 ? 'error' : ''}`}>
                    <span className="card-label">Ошибки</span>
                    <span className="card-value">{stats.totals.errors}</span>
                  </div>
                  <div className="health-card">
                    <span className="card-label">Ретраи</span>
                    <span className="card-value">{stats.totals.retries}</span>
                  </div>
                </>
              )}
            </div>

            {/* Last scan detail */}
            {stats?.lastScan && (
              <div className="last-scan">
                <h3>Последний скан</h3>
                <div className="scan-details">
                  <div className="scan-detail">
                    <span className="detail-label">Начало</span>
                    <span className="detail-value">{new Date(stats.lastScan.start).toLocaleTimeString('ru-RU')}</span>
                  </div>
                  <div className="scan-detail">
                    <span className="detail-label">Длительность</span>
                    <span className={`detail-value ${(stats.lastScan.duration > 5000) ? 'slow' : ''}`}>
                      {formatDuration(stats.lastScan.duration)}
                      {stats.lastScan.duration > 5000 && ' ⚠️'}
                    </span>
                  </div>
                  <div className="scan-detail">
                    <span className="detail-label">Групп просканировано</span>
                    <span className="detail-value">{stats.lastScan.groups}</span>
                  </div>
                  <div className="scan-detail">
                    <span className="detail-label">Новых постов</span>
                    <span className="detail-value">{stats.lastScan.newPosts}</span>
                  </div>
                  {stats.lastScan.errors?.length > 0 && (
                    <div className="scan-detail full">
                      <span className="detail-label">Ошибки скана</span>
                      <span className="detail-value error">
                        {stats.lastScan.errors.map((e, i) => (
                          <span key={i} className="error-item">{e}</span>
                        ))}
                      </span>
                    </div>
                  )}
                  {stats.updatedAt && (
                    <div className="scan-detail">
                      <span className="detail-label">Обновление статов</span>
                      <span className="detail-value">{timeAgo(stats.updatedAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Logs */}
            {stats?.logs && stats.logs.length > 0 && (
              <div className="logs-section">
                <h3>Логи парсера</h3>
                <div className="logs-list">
                  {stats.logs.slice().reverse().slice(0, 20).map((log, i) => (
                    <div key={i} className={`log-entry log-${log.level}`}>
                      <span className="log-time">{new Date(log.time).toLocaleTimeString('ru-RU')}</span>
                      <span className={`log-level ${log.level}`}>{log.level}</span>
                      <span className="log-message">{log.message}</span>
                      {log.duration && <span className="log-duration">{formatDuration(log.duration)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Manual Scan */}
          <div className="manual-scan">
            <h2>Ручное сканирование</h2>
            <button
              onClick={triggerScan}
              disabled={scanning}
              className="scan-btn"
            >
              {scanning ? 'Сканирование...' : 'Запустить сканирование'}
            </button>
            {scanResult && <div className="scan-result">{scanResult}</div>}
          </div>

          {/* Group Status */}
          <div className="groups-section">
            <h2>Группы ({groups.length})</h2>
            <table className="groups-table">
              <thead>
                <tr>
                  <th>Группа</th>
                  <th>URL</th>
                  <th>Max ID</th>
                  <th>VK время</th>
                  <th>Батчей</th>
                  <th>Постов найдено</th>
                  <th>Новых</th>
                  <th>Ошибки</th>
                  <th>Обновлено</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group, i) => {
                  const sinceUpdate = Date.now() - group.updatedAt
                  const isStale = sinceUpdate > 120000 // 2 min
                  const hasErrors = group.errors && group.errors.length > 0
                  const isSlow = (group.vkTime || 0) > 3000

                  return (
                    <tr key={i} className={hasErrors ? 'row-error' : isStale ? 'row-stale' : ''}>
                      <td className="group-name">{group.name}</td>
                      <td className="group-url">
                        <a href={group.url} target="_blank" rel="noopener noreferrer">
                          {group.url.replace('https://', '')}
                        </a>
                      </td>
                      <td className="group-maxid">#{group.maxId}</td>
                      <td className={isSlow ? 'slow' : ''}>{group.vkTime ? `${group.vkTime}ms` : '—'}</td>
                      <td>{group.batches || '—'}</td>
                      <td>{group.postsFound ?? '—'}</td>
                      <td>{group.newPosts ?? 0}</td>
                      <td className="group-errors">
                        {hasErrors ? (
                          <span className="error-badge">{group.errors?.length} err</span>
                        ) : '—'}
                      </td>
                      <td className="group-time">{timeAgo(group.updatedAt)}</td>
                      <td>
                        <span className={`status-badge ${isStale ? 'stale' : hasErrors ? 'error' : 'ok'}`}>
                          {isStale ? 'Тормозит' : hasErrors ? 'Ошибка' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Recent Posts */}
          <div className="posts-section">
            <h2>Последние посты ({posts.length})</h2>
            <div className="posts-list">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="post-card"
                  onClick={() => setSelectedPost(post)}
                >
                  <div className="post-header">
                    <span className="post-name">{post.name}</span>
                    <span className="post-domain">{post.domain}</span>
                    <span className="post-time">{post.time}</span>
                  </div>
                  <div className="post-text">
                    {post.text.length > 150 ? post.text.substring(0, 150) + '...' : post.text}
                  </div>
                  <div className="post-footer">
                    <span className="post-likes">&#x2764; {post.likes}</span>
                    {post.comments !== undefined && <span className="post-comments">&#x1F4AC; {post.comments}</span>}
                    {post.views !== undefined && <span className="post-views">&#x1F441; {post.views}</span>}
                    {post.video && <span className="post-video">{post.video.isClip ? '🎬' : '📹'} Видео</span>}
                    {post.images && post.images.length > 0 && <span className="post-images">&#x1F4F7; {post.images.length}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      {/* Post Modal */}
      {selectedPost && (
        <div className="modal-overlay" onClick={() => setSelectedPost(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedPost(null)}>&times;</button>
            <h2>{selectedPost.name}</h2>
            <span className="modal-domain">{selectedPost.domain}</span>
            <p className="modal-time">{selectedPost.time}</p>
            <div className="modal-text">{selectedPost.text}</div>
            <div className="modal-stats">
              <span>&#x2764; {selectedPost.likes}</span>
              {selectedPost.comments !== undefined && <span>&#x1F4AC; {selectedPost.comments}</span>}
              {selectedPost.views !== undefined && <span>&#x1F441; {selectedPost.views}</span>}
            </div>
            {selectedPost.images && selectedPost.images.length > 0 && (
              <div className="modal-images">
                <p>{selectedPost.images.length} изображений</p>
                {selectedPost.images.map((img, i) => (
                  <img key={i} src={img} alt="" className="modal-image" />
                ))}
              </div>
            )}
            {selectedPost.video && (
              <div className="modal-video">
                <p>{selectedPost.video.isClip ? 'Клип' : 'Видео'}: {selectedPost.video.title}</p>
                {selectedPost.video.thumb && (
                  <img src={selectedPost.video.thumb} alt="" className="modal-video-thumb" />
                )}
              </div>
            )}
            <div className="modal-link">
              <a href={selectedPost.link || '#'} target="_blank" rel="noopener noreferrer">
                Открыть в VK
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
