'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'

interface VideoData {
  id: string
  title: string
  duration: number
  player: string | null
  thumb: string | null
  files: Record<string, string> | null
  isClip?: boolean
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
  attachmentsCount: number
  hasPoll: boolean
  hasLink: boolean
  mediaTypes: string[]
  image: string | null
  images: string[]
  avatar: string | null
  createdAt: number
  publishedAt: number
  x: number
  y: number
  w: number
  h: number
  source: string
  link: string
  video: VideoData | null
}

interface DragState {
  postId: string
  startX: number
  startY: number
  origX: number
  origY: number
  currentX: number
  currentY: number
  moved: boolean
}

interface Settings {
  refreshInterval: number
  postPeriod: number
  maxPosts: number
  theme: 'blue' | 'red' | 'green' | 'white'
  videoAutoplay: boolean
  soundEnabled: boolean
  particles: boolean
}

const DEFAULT_SETTINGS: Settings = {
  refreshInterval: 10,
  postPeriod: 1440,
  maxPosts: 20,
  theme: 'blue',
  videoAutoplay: true,
  soundEnabled: true,
  particles: true,
}

const THEMES = {
  blue: { label: 'Синяя', dot: '#4169e1' },
  red: { label: 'Красная', dot: '#e14141' },
  green: { label: 'Зелёная', dot: '#41e141' },
  white: { label: 'Белая', dot: '#ffffff' },
} as const

type ThemeKey = keyof typeof THEMES

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem('radar-test-settings-v1')
    if (raw) {
      const parsed = JSON.parse(raw)
      const merged = { ...DEFAULT_SETTINGS, ...parsed }
      merged.maxPosts = Math.max(5, merged.maxPosts || 10)
      return merged
    }
  } catch {}
  return DEFAULT_SETTINGS
}

function saveSettings(s: Settings) {
  localStorage.setItem('radar-test-settings-v1', JSON.stringify(s))
}

function decodeHtml(str: string): string {
  const textarea = typeof document !== 'undefined' ? document.createElement('textarea') : null
  if (textarea) { textarea.innerHTML = str; return textarea.value.trim() }
  return str.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c))).trim()
}

function parseVkLinks(text: string): string {
  return text.replace(/\[(club|id|group)(\d+)\|([^\]]*)\]/gi, (_, type, id, label) => {
    const trimmedLabel = label.trim() || `${type}${id}`
    let url = ''
    if (type.toLowerCase() === 'club' || type.toLowerCase() === 'group') url = `https://vk.com/club${id}`
    else if (type.toLowerCase() === 'id') url = `https://vk.com/id${id}`
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="vk-link" onclick="event.stopPropagation()">${trimmedLabel}</a>`
  }).replace(/\[(club|id|group)(\d+)\]/gi, (_, type, id) => {
    let url = '', label = `${type}${id}`
    if (type.toLowerCase() === 'club' || type.toLowerCase() === 'group') { url = `https://vk.com/club${id}`; label = `club${id}` }
    else if (type.toLowerCase() === 'id') { url = `https://vk.com/id${id}`; label = `id${id}` }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="vk-link" onclick="event.stopPropagation()">${label}</a>`
  })
}

const MARGIN = 24
const HEADER_BUFFER = 80
const GAP = 12

function getPostSize(count: number) {
  if (count <= 4) return { pw: 320, ph: 400 }
  if (count <= 8) { const s = (8 - count) / 4; return { pw: Math.round(260 + 60 * s), ph: Math.round(320 + 80 * s) } }
  if (count <= 15) { const s = (15 - count) / 7; return { pw: Math.round(200 + 60 * s), ph: Math.round(260 + 60 * s) } }
  if (count <= 25) { const s = (25 - count) / 10; return { pw: Math.round(170 + 30 * s), ph: Math.round(220 + 40 * s) } }
  return { pw: 170, ph: 220 }
}

function getVideoSrc(video: VideoData): string {
  if (!video.files) return ''
  return video.files.mp4_1080 || video.files.mp4_720 || video.files.mp4_480 || video.files.mp4_360 || video.files.mp4_240 || ''
}

function playPingSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(1200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3)
  } catch {}
}

function seededRandom(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  return () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff }
}

function assignPositions(posts: Post[], w: number, h: number): Post[] {
  const sorted = [...posts].sort((a, b) => a.id.localeCompare(b.id))
  const count = sorted.length
  if (count === 0) return []
  const { pw, ph } = getPostSize(count)
  const areaLeft = MARGIN, areaRight = w - MARGIN - pw, areaTop = HEADER_BUFFER + 16, areaBottom = h - MARGIN - ph
  const seed = sorted.map(p => p.id).join('|')
  const rand = seededRandom(seed)
  const positions: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) positions.push({ x: areaLeft + rand() * Math.max(0, areaRight - areaLeft), y: areaTop + rand() * Math.max(0, areaBottom - areaTop) })
  for (let iter = 0; iter < 300; iter++) {
    for (let i = 0; i < count; i++) {
      let pushX = 0, pushY = 0
      for (let j = 0; j < count; j++) {
        if (i === j) continue
        const dx = (positions[i].x + pw / 2) - (positions[j].x + pw / 2)
        const dy = (positions[i].y + ph / 2) - (positions[j].y + ph / 2)
        const overlapX = pw + GAP - Math.abs(dx), overlapY = ph + GAP - Math.abs(dy)
        if (overlapX > 0 && overlapY > 0) {
          if (overlapX < overlapY) pushX += (dx > 0 ? 1 : -1) * overlapX * 0.5
          else pushY += (dy > 0 ? 1 : -1) * overlapY * 0.5
        }
      }
      if (pushX !== 0 || pushY !== 0) {
        const strength = Math.min(1, 4 / (iter + 1))
        positions[i].x += pushX * strength * 0.3
        positions[i].y += pushY * strength * 0.3
        positions[i].x = Math.max(areaLeft, Math.min(areaRight, positions[i].x))
        positions[i].y = Math.max(areaTop, Math.min(areaBottom, positions[i].y))
      }
    }
  }
  for (let i = 0; i < count; i++) { const post = sorted[i]; post.w = pw; post.h = ph; post.x = positions[i].x + pw / 2; post.y = positions[i].y + ph / 2 }
  return sorted
}

export default function TestRadar() {
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [now, setNow] = useState(Date.now())
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [photoIndexes, setPhotoIndexes] = useState<Map<string, number>>(new Map())
  const [modalPhotoIndex, setModalPhotoIndex] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [draggedPositions, setDraggedPositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const draggedPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const [textSearch, setTextSearch] = useState('')
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set())
  const [prevPostIds, setPrevPostIds] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const dragElementRef = useRef<HTMLElement | null>(null)
  const dragRafRef = useRef<number>(0)
  const dragStateRef = useRef<{ currentX: number; currentY: number } | null>(null)
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') { setSelectedPost(null); setHistoryOpen(false); setPanelOpen(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const postLifetimeMs = (settings.postPeriod || 1440) * 60000

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        fetch('/api/test/scan').catch(() => {})
        const res = await fetch(`/api/test/posts?t=${Date.now()}`)
        const data = await res.json()
        if (!Array.isArray(data) || data.length === 0) return
        const validPosts: Post[] = data.map((p: any) => ({
          id: p.id, name: p.name || 'VK', text: p.text || '',
          time: p.time || 'только что', likes: p.likes || 0, comments: p.comments || 0,
          reposts: p.reposts || 0, views: p.views || 0, attachmentsCount: p.attachmentsCount || 0,
          hasPoll: p.hasPoll || false, hasLink: p.hasLink || false, mediaTypes: p.mediaTypes || [],
          image: p.image || null, images: p.images || [], avatar: p.avatar || null,
          createdAt: p.createdAt, publishedAt: p.publishedAt,
          x: 0, y: 0, w: 280, h: 360, source: p.source || 'vk', link: p.link || '',
          video: p.video || null,
        }))
        validPosts.sort((a, b) => b.publishedAt - a.publishedAt)
        const top = validPosts.slice(0, settings.maxPosts)
        setPrevPostIds(prev => {
          const current = new Set(prev)
          const incoming = new Set(top.map(p => p.id))
          const newlyAdded = new Set([...incoming].filter(id => !current.has(id)))
          if (newlyAdded.size > 0) {
            setNewPostIds(newlyAdded)
            setTimeout(() => setNewPostIds(new Set()), 3000)
            if (settings.soundEnabled) playPingSound()
          }
          return incoming
        })
        const positioned = assignPositions(top, window.innerWidth, window.innerHeight)
        const dp = draggedPositionsRef.current
        setAllPosts(positioned.map(p => { const dragged = dp.get(p.id); return dragged ? { ...p, x: dragged.x, y: dragged.y } : p }))
      } catch (e) { console.log('Fetch error:', e) }
    }
    fetchPosts()
    const interval = setInterval(fetchPosts, 30000)
    return () => clearInterval(interval)
  }, [settings.maxPosts, settings.soundEnabled, settings.postPeriod])

  useEffect(() => {
    if (dragState) { document.body.classList.add('dragging-active'); return () => document.body.classList.remove('dragging-active') }
  }, [!!dragState])

  useEffect(() => {
    if (!dragState) return
    const handleMove = (e: MouseEvent) => {
      if (dragRafRef.current) return
      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = 0
        const dx = e.clientX - dragState.startX, dy = e.clientY - dragState.startY
        const currentX = dragState.origX + dx, currentY = dragState.origY + dy
        const moved = dragState.moved || Math.abs(dx) > 5 || Math.abs(dy) > 5
        setDragState(prev => prev ? { ...prev, currentX, currentY, moved } : null)
        dragStateRef.current = { currentX, currentY }
        if (dragElementRef.current) {
          dragElementRef.current.style.left = `${currentX}px`
          dragElementRef.current.style.top = `${currentY}px`
          dragElementRef.current.style.transition = 'none'
        }
      })
    }
    const handleUp = () => {
      if (dragRafRef.current) { cancelAnimationFrame(dragRafRef.current); dragRafRef.current = 0 }
      const finalState = dragStateRef.current
      if (!dragState || !dragState.moved || !finalState) { dragElementRef.current = null; dragStateRef.current = null; setDragState(null); return }
      const updated = allPosts.map(p => p.id === dragState.postId ? { ...p, x: finalState.currentX, y: finalState.currentY } : p)
      const { pw, ph } = getPostSize(updated.length)
      for (let iter = 0; iter < 60; iter++) {
        let changed = false
        for (let i = 0; i < updated.length; i++) {
          const pi = updated[i]; if (pi.id === dragState.postId) continue
          const dx = (finalState.currentX + pw / 2) - (pi.x + pw / 2), dy = (finalState.currentY + ph / 2) - (pi.y + ph / 2)
          const overlapX = pw + GAP - Math.abs(dx), overlapY = ph + GAP - Math.abs(dy)
          if (overlapX > 0 && overlapY > 0) {
            let pushX = 0, pushY = 0
            if (overlapX < overlapY) pushX -= (dx > 0 ? 1 : -1) * overlapX * 0.5
            else pushY -= (dy > 0 ? 1 : -1) * overlapY * 0.5
            updated[i] = { ...pi, x: pi.x + pushX, y: pi.y + pushY }; changed = true
          }
        }
        if (!changed) break
      }
      setAllPosts(updated)
      const newDragged = new Map(draggedPositions); newDragged.set(dragState.postId, { x: finalState.currentX, y: finalState.currentY })
      setDraggedPositions(newDragged); draggedPositionsRef.current = newDragged
      dragElementRef.current = null; dragStateRef.current = null; setDragState(null)
    }
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    return () => { document.removeEventListener('mousemove', handleMove); document.removeEventListener('mouseup', handleUp); if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current) }
  }, [dragState, allPosts])

  const handleMouseDown = useCallback((postId: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a, button, video')) return
    e.preventDefault(); e.stopPropagation()
    const post = allPosts.find(p => p.id === postId); if (!post) return
    dragElementRef.current = e.currentTarget as HTMLElement
    dragStateRef.current = { currentX: post.x, currentY: post.y }
    setDragState({ postId, startX: e.clientX, startY: e.clientY, origX: post.x, origY: post.y, currentX: post.x, currentY: post.y, moved: false })
  }, [allPosts])

  const handleSettingsChange = (key: keyof Settings, value: any) => {
    const updated = { ...settings, [key]: value }; setSettings(updated); saveSettings(updated)
  }

  const handleManualScan = async () => {
    if (scanning) return
    setScanning(true); setScanResult(null)
    try {
      const [scanRes, postsRes] = await Promise.all([fetch('/api/test/scan'), fetch(`/api/test/posts?t=${Date.now()}`)])
      const scanData = await scanRes.json()
      const postsData = await postsRes.json()
      if (Array.isArray(postsData) && postsData.length > 0) {
        const validPosts: Post[] = postsData.map((p: any) => ({
          id: p.id, name: p.name || 'VK', text: p.text || '', time: p.time || 'только что',
          likes: p.likes || 0, comments: p.comments || 0, reposts: p.reposts || 0, views: p.views || 0,
          attachmentsCount: p.attachmentsCount || 0, hasPoll: p.hasPoll || false, hasLink: p.hasLink || false,
          mediaTypes: p.mediaTypes || [], image: p.image || null, images: p.images || [], avatar: p.avatar || null,
          createdAt: p.createdAt, publishedAt: p.publishedAt, x: 0, y: 0, w: 280, h: 360, source: p.source || 'vk', link: p.link || '', video: p.video || null,
        }))
        validPosts.sort((a, b) => b.publishedAt - a.publishedAt)
        const top = validPosts.slice(0, settings.maxPosts)
        const positioned = assignPositions(top, window.innerWidth, window.innerHeight)
        setAllPosts(positioned)
      }
      const postCount = Array.isArray(postsData) ? postsData.length : 0
      setScanResult(`Постов: ${postCount}`)
      setTimeout(() => setScanResult(null), 5000)
    } catch { setScanResult('Ошибка') } finally { setScanning(false) }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setPhotoIndexes(prev => {
        const next = new Map(prev)
        allPosts.filter(p => (p.images?.length || 0) > 1 && (!selectedPost || p.id !== selectedPost.id)).forEach(post => {
          next.set(post.id, ((next.get(post.id) || 0) + 1) % post.images!.length)
        })
        return next
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [allPosts, selectedPost])

  const visiblePosts = allPosts.filter(p => now - p.publishedAt <= postLifetimeMs)
  const filteredPosts = textSearch ? visiblePosts.filter(p => p.text.toLowerCase().includes(textSearch.toLowerCase()) || p.name.toLowerCase().includes(textSearch.toLowerCase())) : visiblePosts

  useEffect(() => {
    const visibleIds = new Set(visiblePosts.map(p => p.id))
    const toRemove: string[] = []
    videoRefs.current.forEach((v, id) => { if (!visibleIds.has(id)) { v.pause(); toRemove.push(id) } })
    toRemove.forEach(id => videoRefs.current.delete(id))
    videoRefs.current.forEach(v => { if (settings.videoAutoplay) { v.muted = true; v.loop = true; v.playsInline = true; v.play().catch(() => {}) } else v.pause() })
  }, [settings.videoAutoplay, visiblePosts.length])

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayCount = allPosts.filter(p => p.publishedAt >= todayStart.getTime()).length

  const formatViews = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return String(n)
  }

  return (
    <main className={`wall ${fullscreen ? 'fullscreen' : ''}`} ref={containerRef}>
      {/* TEST badge */}
      <div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#000', fontSize: 10, fontWeight: 900, letterSpacing: 3, padding: '4px 16px', borderRadius: 12, textTransform: 'uppercase', fontFamily: 'system-ui' }}>BETA</div>

      <div className="radar-bg">
        <div className="radar-grid">
          <div className="radar-circle c1" /><div className="radar-circle c2" /><div className="radar-circle c3" /><div className="radar-circle c4" />
          <div className="radar-line h" /><div className="radar-line v" />
        </div>
        <div className="radar-sweep" />
      </div>

      <header className="header">
        <div className="logo"><img src="/logo.png" alt="" style={{ filter: 'brightness(10)' }} /></div>
        <h1 className="title">РАДАР <span style={{ fontSize: '0.5em', opacity: 0.5, fontWeight: 400 }}>TEST</span></h1>
        <div className="header-actions">
          <a href="/test" className="icon-btn" title="На лендинг" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </a>
          <button className="icon-btn" onClick={() => { setHistoryOpen(!historyOpen); setPanelOpen(false) }} title="История">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          <button className="icon-btn" onClick={() => { setPanelOpen(!panelOpen); setHistoryOpen(false) }} title="Панель">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </header>

      {/* History Sidebar */}
      <div className={`sidebar history-sidebar ${historyOpen ? 'open' : ''}`}>
        <div className="sidebar-content">
          <div className="sidebar-header"><span>История</span><button className="sidebar-close" onClick={() => setHistoryOpen(false)}>×</button></div>
          <div className="post-history">
            {allPosts.slice().reverse().map(post => {
              const remaining = postLifetimeMs - (now - post.publishedAt)
              const isActive = remaining > 0
              return (
                <div key={post.id} className={`history-item ${isActive ? 'active' : ''}`} onClick={() => { setSelectedPost(post); setHistoryOpen(false) }}>
                  <div className="history-name">{post.name}</div>
                  <div className="history-text">{post.text.substring(0, 80)}...</div>
                  {!isActive && <span className="history-badge">истёк</span>}
                  {isActive && <span className="history-badge">{Math.ceil(remaining / 60000)} мин</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <div className={`sidebar settings-sidebar ${panelOpen ? 'open' : ''}`}>
        <div className="sidebar-content">
          <div className="sidebar-header"><span>Панель TEST</span><button className="sidebar-close" onClick={() => setPanelOpen(false)}>×</button></div>

          <div className="panel-section">
            <div className="panel-section-label">Тема</div>
            <div className="panel-themes">
              {(Object.keys(THEMES) as ThemeKey[]).map(key => (
                <button key={key} className={`panel-theme-btn ${settings.theme === key ? 'active' : ''}`} onClick={() => handleSettingsChange('theme', key)}>
                  <span className="theme-dot-inline" style={{ background: THEMES[key].dot }} />{THEMES[key].label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-section-label">Количество постов</div>
            <div className="panel-count">
              <button className="count-btn" onClick={() => handleSettingsChange('maxPosts', Math.max(1, settings.maxPosts - 1))}>−</button>
              <span className="count-value">{settings.maxPosts}</span>
              <button className="count-btn" onClick={() => handleSettingsChange('maxPosts', Math.min(20, settings.maxPosts + 1))}>+</button>
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-section-label">Автоплей видео</div>
            <button className={`panel-toggle-btn ${settings.videoAutoplay ? 'active' : ''}`} onClick={() => handleSettingsChange('videoAutoplay', !settings.videoAutoplay)}>
              {settings.videoAutoplay ? 'Включён' : 'Выключен'}
            </button>
          </div>

          <div className="panel-section">
            <div className="panel-section-label">Звук</div>
            <button className={`panel-toggle-btn ${settings.soundEnabled ? 'active' : ''}`} onClick={() => handleSettingsChange('soundEnabled', !settings.soundEnabled)}>
              {settings.soundEnabled ? 'Включён' : 'Выключен'}
            </button>
          </div>

          <div className="panel-section">
            <div className="panel-section-label">Частота обновления</div>
            <div className="panel-options">
              {[{ label: '1 мин', value: 1 }, { label: '5 мин', value: 5 }, { label: '10 мин', value: 10 }, { label: '30 мин', value: 30 }].map(opt => (
                <button key={opt.value} className={`panel-option ${settings.refreshInterval === opt.value ? 'active' : ''}`} onClick={() => handleSettingsChange('refreshInterval', opt.value)}>{opt.label}</button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-section-label">Показывать посты за</div>
            <div className="panel-options">
              {[{ label: '30 мин', value: 30 }, { label: '1 час', value: 60 }, { label: '6 час', value: 360 }, { label: '24 часа', value: 1440 }].map(opt => (
                <button key={opt.value} className={`panel-option ${settings.postPeriod === opt.value ? 'active' : ''}`} onClick={() => handleSettingsChange('postPeriod', opt.value)}>{opt.label}</button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <button className={`panel-tool-btn ${scanning ? 'active' : ''}`} onClick={handleManualScan} disabled={scanning}>
              {scanning ? 'Обновление...' : scanResult || 'Обновить'}
            </button>
          </div>
        </div>
      </div>

      <div className="posts-layer">
        <div className="mobile-controls">
          <div className="mobile-search">
            <input type="text" placeholder="Поиск..." value={textSearch} onChange={e => setTextSearch(e.target.value)} />
          </div>
        </div>

        {filteredPosts
          .sort((a, b) => b.publishedAt - a.publishedAt)
          .map(post => {
            const age = now - post.publishedAt
            const isHot = post.likes >= 100
            const isNew = age < 2000
            const isDragging = dragState?.postId === post.id && dragState.moved
            const isNewPost = newPostIds.has(post.id)
            const postType = post.video ? 'video' : post.image ? 'image' : 'text'
            const itemLeft = isDragging ? dragState.currentX : post.x
            const itemTop = isDragging ? dragState.currentY : post.y
            const transform = `translate(-50%, -50%) scale(${isDragging ? 1.05 : isHot ? 1.15 : 1})`
            const seed = post.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
            const breatheDelay = (seed % 5000) / 1000

            return (
              <div
                key={post.id}
                className={`post ${postType}-post ${isNewPost ? 'just-appeared' : ''} ${isHot ? 'hot' : ''} ${isNew ? 'new-post' : ''} ${isDragging ? 'dragging' : ''}`}
                style={{
                  left: itemLeft, top: itemTop, width: post.w,
                  transform, zIndex: isDragging ? 1000 : 1, cursor: 'grab',
                  transition: isDragging ? 'none' : 'left 0.2s ease-out, top 0.2s ease-out, transform 0.2s, opacity 0.3s, width 0.3s',
                  animation: isNewPost ? 'appearFromCenter 0.6s ease-out' : `breathe 6s ease-in-out ${breatheDelay}s infinite`,
                }}
                onClick={(e) => { if (isDragging) return; if ((e.target as HTMLElement).closest('.vk-link')) return; setSelectedPost(post); setModalPhotoIndex(0) }}
                onMouseDown={e => handleMouseDown(post.id, e)}
              >
                <div className="post-header">
                  <div className={`avatar avatar-${postType}`}>{post.avatar ? <img src={post.avatar} alt="" /> : 'П'}</div>
                  <div className="post-info"><h3>{post.name}</h3><span>{post.time}</span></div>
                </div>
                <div className="post-text" onClick={e => e.stopPropagation()}>
                  <span dangerouslySetInnerHTML={{ __html: parseVkLinks(decodeHtml(post.text || '[Без текста]')) }} />
                </div>

                {/* Enhanced meta badges */}
                <div className="test-meta-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 12px', marginBottom: 6 }}>
                  {post.comments > 0 && <span style={{ fontSize: 11, color: '#6b9fff', background: 'rgba(65,105,225,0.12)', padding: '2px 7px', borderRadius: 6 }}>💬 {post.comments}</span>}
                  {post.reposts > 0 && <span style={{ fontSize: 11, color: '#22c55e', background: 'rgba(34,197,94,0.12)', padding: '2px 7px', borderRadius: 6 }}>🔄 {post.reposts}</span>}
                  {post.views > 0 && <span style={{ fontSize: 11, color: '#8899b0', background: 'rgba(136,153,176,0.12)', padding: '2px 7px', borderRadius: 6 }}>👁 {formatViews(post.views)}</span>}
                  {post.hasPoll && <span style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', padding: '2px 7px', borderRadius: 6 }}>📊 Опрос</span>}
                  {post.mediaTypes.length > 1 && <span style={{ fontSize: 11, color: '#a855f7', background: 'rgba(168,85,247,0.12)', padding: '2px 7px', borderRadius: 6 }}>{post.mediaTypes.length} типов</span>}
                </div>

                {post.video && !post.video.isClip ? (
                  getVideoSrc(post.video) ? (
                    <video ref={el => { if (el) { videoRefs.current.set(post.id, el); if (settings.videoAutoplay) { el.muted = true; el.loop = true; el.playsInline = true; el.play().catch(() => {}) } } }} src={getVideoSrc(post.video)} preload="auto" className="video-autoplay-inline" />
                  ) : (
                    <div className="video-thumb-only">
                      {post.video.thumb && <img src={post.video.thumb} alt="" />}
                      <div className="video-thumb-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>{post.video.duration > 0 && <span>{Math.floor(post.video.duration / 60)}:{(post.video.duration % 60).toString().padStart(2, '0')}</span>}</div>
                    </div>
                  )
                ) : null}
                {post.video && post.video.isClip ? (
                  <div className="clip-preview">
                    {post.video.thumb && <img src={post.video.thumb} alt="" />}
                    <div className="clip-preview-overlay"><span className="clip-label">КЛИП</span><a href={post.link} target="_blank" rel="noopener" className="clip-watch-btn" onClick={e => e.stopPropagation()}>Смотреть</a></div>
                  </div>
                ) : null}
                {post.images && post.images.length > 1 && !post.video ? (
                  <div className="post-image-carousel">
                    <img src={post.images[photoIndexes.get(post.id) || 0]} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <div className="carousel-dots">{post.images.map((_, i) => (<span key={i} className={`carousel-dot ${(photoIndexes.get(post.id) || 0) === i ? 'active' : ''}`} />))}</div>
                  </div>
                ) : post.image && !post.video && (
                  <div className="post-image"><img src={post.image} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} /></div>
                )}
                <div className="post-footer">
                  <div className="footer-actions">
                    <span className="footer-action likes"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>{post.likes || 0}</span>
                    <span className="footer-action comments"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>{post.comments || 0}</span>
                    <span className="footer-action shares"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>{post.reposts || 0}</span>
                  </div>
                  {post.link && (
                    <a href={post.link} target="_blank" rel="noopener noreferrer" className="footer-open-link" onClick={e => e.stopPropagation()}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      {/* Post Modal */}
      {selectedPost && (
        <div className="post-modal" onClick={() => setSelectedPost(null)}>
          <div className="post-modal-content" onClick={e => e.stopPropagation()}>
            <div className="post-modal-header"><h2>{selectedPost.name}</h2><button className="close-btn" onClick={() => setSelectedPost(null)}>×</button></div>
            <div className="post-modal-text" dangerouslySetInnerHTML={{ __html: parseVkLinks(decodeHtml(selectedPost.text)) }}></div>

            {/* Enhanced meta in modal */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid rgba(65,105,225,0.1)', marginTop: 12 }}>
              <span style={{ fontSize: 13, color: '#6b9fff' }}>💬 {selectedPost.comments} комментариев</span>
              <span style={{ fontSize: 13, color: '#22c55e' }}>🔄 {selectedPost.reposts} репостов</span>
              <span style={{ fontSize: 13, color: '#8899b0' }}>👁 {formatViews(selectedPost.views)} просмотров</span>
              {selectedPost.hasPoll && <span style={{ fontSize: 13, color: '#f59e0b' }}>📊 С опросом</span>}
              {selectedPost.mediaTypes.length > 0 && <span style={{ fontSize: 13, color: '#a855f7' }}>📎 {selectedPost.mediaTypes.join(', ')}</span>}
            </div>

            {selectedPost.video && (
              <div className="post-modal-video">
                {getVideoSrc(selectedPost.video) ? (
                  <video className="post-modal-video-iframe" controls autoPlay playsInline preload="metadata" src={getVideoSrc(selectedPost.video)} />
                ) : selectedPost.video.player ? (
                  <iframe className="post-modal-video-iframe" src={selectedPost.video.player} frameBorder="0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
                ) : (
                  <div className="post-modal-video-fallback">
                    <a href={`https://vk.com/video${selectedPost.video.id}`} target="_blank" rel="noopener noreferrer" className="post-modal-video-link">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Открыть видео в VK
                    </a>
                  </div>
                )}
              </div>
            )}
            {selectedPost.images && selectedPost.images.length > 1 && !selectedPost.video && (
              <div className="post-modal-image-carousel">
                <button className="carousel-arrow carousel-prev" onClick={() => setModalPhotoIndex(idx => idx === 0 ? selectedPost.images!.length - 1 : idx - 1)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div className="post-modal-image"><img src={selectedPost.images[modalPhotoIndex]} alt="" /></div>
                <button className="carousel-arrow carousel-next" onClick={() => setModalPhotoIndex(idx => (idx + 1) % selectedPost.images!.length)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                <div className="carousel-counter">{modalPhotoIndex + 1} / {selectedPost.images.length}</div>
              </div>
            )}
            {selectedPost.image && (!selectedPost.images || selectedPost.images.length <= 1) && !selectedPost.video && <div className="post-modal-image"><img src={selectedPost.image} alt="" /></div>}
            <div className="post-modal-footer">
              <span className="likes"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>{selectedPost.likes || 0}</span>
              {selectedPost.link && <a href={selectedPost.link} target="_blank" rel="noopener noreferrer" className="source-link">Открыть в VK</a>}
            </div>
          </div>
        </div>
      )}

      {settings.particles && (
        <div className="particles-bg">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="particle" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, width: `${2 + (i % 4)}px`, height: `${2 + (i % 4)}px`, animationDelay: `${(i * 0.7) % 8}s`, animationDuration: `${6 + (i % 6)}s`, opacity: 0.3 + (i % 5) * 0.1 }} />
          ))}
        </div>
      )}

      <div className="queue-info">
        <span className="pulse" />
        TEST: {visiblePosts.length} | Всего: {allPosts.length} | Сегодня: {todayCount}
      </div>
    </main>
  )
}
