'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import './page.css'

const API_BASE = ''

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
  notifications: boolean
  enabledGroups: string[]
  particles: boolean
  effects: {
    newPostShake: boolean
    nebula: boolean
    snow: boolean
  }
}

const DEFAULT_SETTINGS: Settings = {
  refreshInterval: 10,
  postPeriod: 1440,
  maxPosts: 20,
  theme: 'blue',
  videoAutoplay: true,
  soundEnabled: true,
  notifications: false,
  enabledGroups: [],
  particles: true,
  effects: {
    newPostShake: false,
    nebula: true,
    snow: false,
  }
}

const REFRESH_OPTIONS = [
  { label: '1 минута', value: 1 },
  { label: '5 минут', value: 5 },
  { label: '10 минут', value: 10 },
  { label: '30 минут', value: 30 },
]

const PERIOD_OPTIONS = [
  { label: '30 минут', value: 30 },
  { label: '1 час', value: 60 },
  { label: '2 часа', value: 120 },
  { label: '6 часов', value: 360 },
  { label: '12 часов', value: 720 },
  { label: '24 часа', value: 1440 },
]

const THEMES = {
  blue: { label: 'Синяя', dot: '#4169e1' },
  red: { label: 'Красная', dot: '#e14141' },
  green: { label: 'Зелёная', dot: '#41e141' },
  white: { label: 'Белая', dot: '#ffffff' },
  purple: { label: 'Фиолет', dot: '#a855f7' },
  orange: { label: 'Оранж', dot: '#f97316' },
  cyan: { label: 'Циан', dot: '#06b6d4' },
  gold: { label: 'Золото', dot: '#eab308' },
  pink: { label: 'Розовый', dot: '#ec4899' },
  teal: { label: 'Бирюза', dot: '#14b8a6' },
  lilac: { label: 'Сирень', dot: '#c084fc' },
  slate: { label: 'Слейт', dot: '#94a3b8' },
  amber: { label: 'Янтарь', dot: '#f59e0b' },
  indigo: { label: 'Индиго', dot: '#6366f1' },
  coral: { label: 'Коралл', dot: '#f43f5e' },
  emerald: { label: 'Изумруд', dot: '#10b981' },
  lime: { label: 'Лайм', dot: '#84cc16' },
  ruby: { label: 'Рубин', dot: '#be123c' },
  lavender: { label: 'Лаванда', dot: '#a78bfa' },
  glass: { label: 'Жидкое стекло', dot: '#c0c0c0' },
  victory: { label: 'День Победы', dot: '#f59e0b' },
} as const

type ThemeKey = keyof typeof THEMES

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem('radar-settings-v5')
    if (raw) {
      const parsed = JSON.parse(raw)
      const merged = { ...DEFAULT_SETTINGS, ...parsed }
      if (merged.effects && typeof merged.effects === 'object') {
        merged.effects = { ...DEFAULT_SETTINGS.effects, ...merged.effects }
      }
      merged.maxPosts = Math.max(5, merged.maxPosts || 10)
      return merged
    }
  } catch {}
  return DEFAULT_SETTINGS
}

function saveSettings(s: Settings) {
  localStorage.setItem('radar-settings-v5', JSON.stringify(s))
}

function decodeHtml(str: string): string {
  const textarea = typeof document !== 'undefined' ? document.createElement('textarea') : null
  if (textarea) {
    textarea.innerHTML = str
    return textarea.value.trim()
  }
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)))
    .trim()
}

function parseVkLinks(text: string): string {
  return text.replace(/\[(club|id|group)(\d+)\|([^\]]*)\]/gi, (match, type, id, label) => {
    const trimmedLabel = label.trim() || `${type}${id}`
    let url = ''
    if (type.toLowerCase() === 'club' || type.toLowerCase() === 'group') {
      url = `https://vk.com/club${id}`
    } else if (type.toLowerCase() === 'id') {
      url = `https://vk.com/id${id}`
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="vk-link" onclick="event.stopPropagation()">${trimmedLabel}</a>`
  }).replace(/\[(club|id|group)(\d+)\]/gi, (match, type, id) => {
    let url = ''
    let label = `${type}${id}`
    if (type.toLowerCase() === 'club' || type.toLowerCase() === 'group') {
      url = `https://vk.com/club${id}`
      label = `club${id}`
    } else if (type.toLowerCase() === 'id') {
      url = `https://vk.com/id${id}`
      label = `id${id}`
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="vk-link" onclick="event.stopPropagation()">${label}</a>`
  })
}

const MARGIN = 24
const HEADER_BUFFER = 80
const GAP = 12
const MIN_POST_W = 220
const MIN_POST_H = 280
const MAX_POST_W = 320
const MAX_POST_H = 400

function getPostSize(count: number) {
  if (count <= 4) return { pw: MAX_POST_W, ph: MAX_POST_H }
  if (count <= 8) {
    const scale = (8 - count) / 4
    return {
      pw: Math.round(260 + (MAX_POST_W - 260) * scale),
      ph: Math.round(320 + (MAX_POST_H - 320) * scale),
    }
  }
  if (count <= 15) {
    const scale = (15 - count) / 7
    return {
      pw: Math.round(200 + (260 - 200) * scale),
      ph: Math.round(260 + (320 - 260) * scale),
    }
  }
  if (count <= 25) {
    const scale = (25 - count) / 10
    return {
      pw: Math.round(170 + (200 - 170) * scale),
      ph: Math.round(220 + (260 - 220) * scale),
    }
  }
  return { pw: 170, ph: 220 }
}

function getVideoSrc(video: VideoData): string {
  if (!video.files) return ''
  return video.files.mp4_1080 || video.files.mp4_720 || video.files.mp4_480 || video.files.mp4_360 || video.files.mp4_240 || ''
}

function getVideoLabel(duration: number): string {
  if (!duration) return 'Видео'
  return `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`
}

function playPingSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(1200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch {}
}

function seededRandom(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    return h / 0x7fffffff
  }
}

function assignPositions(posts: Post[], w: number, h: number): Post[] {
  const sorted = [...posts].sort((a, b) => a.id.localeCompare(b.id))
  const count = sorted.length
  if (count === 0) return []

  const { pw, ph } = getPostSize(count)

  const areaLeft = MARGIN
  const areaRight = w - MARGIN - pw
  const areaTop = HEADER_BUFFER + 16
  const areaBottom = h - MARGIN - ph

  const seed = sorted.map(p => p.id).join('|')
  const rand = seededRandom(seed)

  const positions: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    positions.push({
      x: areaLeft + rand() * Math.max(0, areaRight - areaLeft),
      y: areaTop + rand() * Math.max(0, areaBottom - areaTop),
    })
  }

  for (let iter = 0; iter < 300; iter++) {
    for (let i = 0; i < count; i++) {
      let pushX = 0
      let pushY = 0

      for (let j = 0; j < count; j++) {
        if (i === j) continue
        const dx = (positions[i].x + pw / 2) - (positions[j].x + pw / 2)
        const dy = (positions[i].y + ph / 2) - (positions[j].y + ph / 2)

        const overlapX = pw + GAP - Math.abs(dx)
        const overlapY = ph + GAP - Math.abs(dy)

        if (overlapX > 0 && overlapY > 0) {
          if (overlapX < overlapY) {
            pushX += (dx > 0 ? 1 : -1) * overlapX * 0.5
          } else {
            pushY += (dy > 0 ? 1 : -1) * overlapY * 0.5
          }
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

  for (let i = 0; i < count; i++) {
    const post = sorted[i]
    post.w = pw
    post.h = ph
    post.x = positions[i].x + pw / 2
    post.y = positions[i].y + ph / 2
  }

  return sorted
}

function setFavicon(theme: ThemeKey) {
  const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
  if (link) {
    link.href = '/logo.png'
  }
}

export default function Home() {
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [now, setNow] = useState(Date.now())
  const [mobileSearch, setMobileSearch] = useState('')
  const [mobileSort, setMobileSort] = useState<'newest' | 'oldest' | 'likes'>('newest')
  const [exportRange, setExportRange] = useState<'today' | 'week' | 'all'>('today')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [photoIndexes, setPhotoIndexes] = useState<Map<string, number>>(new Map())
  const [modalPhotoIndex, setModalPhotoIndex] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [sonarMode, setSonarMode] = useState(false)
  const [sonarFound, setSonarFound] = useState<Set<string>>(new Set())
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [draggedPositions, setDraggedPositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const draggedPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const [textSearch, setTextSearch] = useState('')
  const [effectsOpen, setEffectsOpen] = useState(false)
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set())
  const [prevPostIds, setPrevPostIds] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const dragElementRef = useRef<HTMLElement | null>(null)
  const dragRafRef = useRef<number>(0)
  const dragStateRef = useRef<{ currentX: number; currentY: number } | null>(null)

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
    setFavicon(settings.theme)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'f' || e.key === 'F') handleFullscreenToggle()
      else if (e.key === 'h' || e.key === 'H') { setHistoryOpen(p => !p); setPanelOpen(false) }
      else if (e.key === ' ') { e.preventDefault(); handleSonarToggle() }
      else if (e.key === 'Escape') { setSelectedPost(null); setHistoryOpen(false); setPanelOpen(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const postLifetimeMs = (settings.postPeriod || 1440) * 60000

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
    setFavicon(settings.theme)
  }, [settings.theme])

  useEffect(() => {
    if (settings.notifications && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [settings.notifications])

  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  const handleEffectToggle = (key: keyof Settings['effects']) => {
    setSettings(prev => ({
      ...prev,
      effects: { ...prev.effects, [key]: !prev.effects[key] }
    }))
  }

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        fetch('/api/scan').catch(() => {})

        const res = await fetch(`/api/posts?t=${Date.now()}`)
        const data = await res.json()
        if (!Array.isArray(data) || data.length === 0) return

        const validPosts: Post[] = data.map((p: any) => ({
          id: p.id, name: p.name || 'VK сообщество', text: p.text || '',
          time: p.time || 'только что', likes: p.likes || 0, image: p.image || null,
          images: p.images || [], avatar: p.avatar || null, createdAt: p.createdAt, publishedAt: p.publishedAt,
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
            if (settings.notifications && 'Notification' in window && Notification.permission === 'granted') {
              const names = [...newlyAdded].map(id => top.find(p => p.id === id)?.name).filter(Boolean)
              new Notification('РАДАР', { body: `Новые посты: ${names.slice(0, 2).join(', ')}${names.length > 2 ? ' и ещё ' + (names.length - 2) : ''}`, icon: '/logo.png' })
            }
          }
          return incoming
        })

        const positioned = assignPositions(top, window.innerWidth, window.innerHeight)
        const dp = draggedPositionsRef.current
        setAllPosts(prev => {
          const merged = positioned.map(p => {
            const dragged = dp.get(p.id)
            if (dragged) {
              return { ...p, x: dragged.x, y: dragged.y }
            }
            return p
          })
          return merged
        })
      } catch (e) {
        console.log('Fetch error:', e)
      }
    }

    fetchPosts()
    const interval = setInterval(fetchPosts, 30000)
    return () => clearInterval(interval)
  }, [settings.maxPosts, settings.soundEnabled, settings.notifications, settings.postPeriod])

  useEffect(() => {
    if (dragState) {
      document.body.classList.add('dragging-active')
      return () => document.body.classList.remove('dragging-active')
    }
  }, [!!dragState])

  useEffect(() => {
    if (!dragState) return

    const handleMove = (e: MouseEvent) => {
      if (dragRafRef.current) return
      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = 0
        const dx = e.clientX - dragState.startX
        const dy = e.clientY - dragState.startY
        const currentX = dragState.origX + dx
        const currentY = dragState.origY + dy
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
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current)
        dragRafRef.current = 0
      }
      const finalState = dragStateRef.current
      if (!dragState || !dragState.moved || !finalState) {
        dragElementRef.current = null
        dragStateRef.current = null
        setDragState(null)
        return
      }

      const updated = allPosts.map(p => {
        if (p.id === dragState.postId) {
          return { ...p, x: finalState.currentX, y: finalState.currentY }
        }
        return p
      })

      const { pw, ph } = getPostSize(updated.length)
      const count = updated.length

      for (let iter = 0; iter < 60; iter++) {
        let changed = false
        for (let i = 0; i < count; i++) {
          const pi = updated[i]
          if (pi.id === dragState.postId) continue
          let pushX = 0
          let pushY = 0

          const dx = (finalState.currentX + pw / 2) - (pi.x + pw / 2)
          const dy = (finalState.currentY + ph / 2) - (pi.y + ph / 2)
          const overlapX = pw + GAP - Math.abs(dx)
          const overlapY = ph + GAP - Math.abs(dy)

          if (overlapX > 0 && overlapY > 0) {
            if (overlapX < overlapY) {
              pushX -= (dx > 0 ? 1 : -1) * overlapX * 0.5
            } else {
              pushY -= (dy > 0 ? 1 : -1) * overlapY * 0.5
            }
            changed = true
          }

          if (changed) {
            updated[i] = { ...pi, x: pi.x + pushX, y: pi.y + pushY }
          }
        }
        if (!changed) break
      }

      setAllPosts(updated)
      const newDragged = new Map(draggedPositions)
      newDragged.set(dragState.postId, { x: finalState.currentX, y: finalState.currentY })
      setDraggedPositions(newDragged)
      draggedPositionsRef.current = newDragged
      dragElementRef.current = null
      dragStateRef.current = null
      setDragState(null)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current)
    }
  }, [dragState, allPosts])

  const handleMouseDown = useCallback((postId: string, e: React.MouseEvent) => {
    if (sonarMode) return
    if ((e.target as HTMLElement).closest('a, button, video, .clip-watch-btn')) return
    e.preventDefault()
    e.stopPropagation()
    const post = allPosts.find(p => p.id === postId)
    if (!post) return
    dragElementRef.current = e.currentTarget as HTMLElement
    dragStateRef.current = { currentX: post.x, currentY: post.y }
    setDragState({
      postId,
      startX: e.clientX,
      startY: e.clientY,
      origX: post.x,
      origY: post.y,
      currentX: post.x,
      currentY: post.y,
      moved: false,
    })
  }, [allPosts, sonarMode])

  const handleSettingsChange = (key: keyof Settings, value: number | ThemeKey | boolean | string[]) => {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    saveSettings(updated)
  }

  const handleFullscreenToggle = () => {
    if (!fullscreen) {
      const el = document.documentElement
      if (el.requestFullscreen) el.requestFullscreen()
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen()
      setFullscreen(true)
    } else {
      if (document.exitFullscreen) document.exitFullscreen()
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen()
      setFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => {
      setFullscreen(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement)
    }
    document.addEventListener('fullscreenchange', handler)
    document.addEventListener('webkitfullscreenchange', handler)
    return () => {
      document.removeEventListener('fullscreenchange', handler)
      document.removeEventListener('webkitfullscreenchange', handler)
    }
  }, [])

   const handleSonarToggle = () => {
    if (!sonarMode) {
      setSonarFound(new Set())
      setSonarMode(true)
      setTimeout(() => {
        visiblePosts.forEach((post, i) => {
          setTimeout(() => {
            setSonarFound(prev => new Set(prev).add(post.id))
          }, i * 400)
        })
      }, 500)
    } else {
      setSonarMode(false)
      setSonarFound(new Set())
    }
  }

   const handleManualScan = async () => {
    if (scanning) return
    setScanning(true)
    setScanResult(null)
    try {
      const [scanRes, postsRes] = await Promise.all([
        fetch('/api/scan'),
        fetch(`/api/posts?t=${Date.now()}`),
      ])
      const scanData = await scanRes.json()
      const postsData = await postsRes.json()
      if (Array.isArray(postsData) && postsData.length > 0) {
        const validPosts: Post[] = postsData.map((p: any) => ({
          id: p.id, name: p.name || 'VK сообщество', text: p.text || '',
          time: p.time || 'только что', likes: p.likes || 0, image: p.image || null,
          images: p.images || [], avatar: p.avatar || null, createdAt: p.createdAt, publishedAt: p.publishedAt,
          x: 0, y: 0, w: 280, h: 360, source: p.source || 'vk', link: p.link || '',
          video: p.video || null,
        }))
        validPosts.sort((a, b) => b.publishedAt - a.publishedAt)
        const top = validPosts.slice(0, settings.maxPosts)
        const positioned = assignPositions(top, window.innerWidth, window.innerHeight)
        const dp = draggedPositionsRef.current
        setAllPosts(prev => {
          const merged = positioned.map(p => {
            const dragged = dp.get(p.id)
            if (dragged) {
              return { ...p, x: dragged.x, y: dragged.y }
            }
            return p
          })
          return merged
        })
      }
      const lastScan = scanData.lastScan ? new Date(scanData.lastScan).toLocaleTimeString('ru-RU') : '—'
      const postCount = Array.isArray(postsData) ? postsData.length : 0
      setScanResult(`Постов: ${postCount} · Скан: ${lastScan}`)
      setTimeout(() => setScanResult(null), 5000)
    } catch {
      setScanResult('Ошибка обновления')
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setPhotoIndexes(prev => {
        const next = new Map(prev)
        const multiPhotoPosts = allPosts.filter(p => (p.images?.length || 0) > 1 && (!selectedPost || p.id !== selectedPost.id))
        for (const post of multiPhotoPosts) {
          const current = next.get(post.id) || 0
          next.set(post.id, (current + 1) % post.images!.length)
        }
        return next
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [allPosts, selectedPost])

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayCount = allPosts.filter(p => p.publishedAt >= todayStart.getTime()).length

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)

  const visiblePosts = allPosts.filter(p => now - p.publishedAt <= postLifetimeMs)

  const filteredPosts = textSearch
    ? visiblePosts.filter(p => p.text.toLowerCase().includes(textSearch.toLowerCase()) || p.name.toLowerCase().includes(textSearch.toLowerCase()))
    : visiblePosts

  const highlightedText = (text: string, search: string) => {
    if (!search) return text
    const idx = text.toLowerCase().indexOf(search.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.substring(0, idx)}
        <mark className="search-highlight">{text.substring(idx, idx + search.length)}</mark>
        {text.substring(idx + search.length)}
      </>
    )
  }

  useEffect(() => {
    const visibleIds = new Set(visiblePosts.map(p => p.id))
    const toRemove: string[] = []
    videoRefs.current.forEach((v, id) => {
      if (!visibleIds.has(id)) {
        v.pause()
        toRemove.push(id)
      }
    })
    toRemove.forEach(id => videoRefs.current.delete(id))

    videoRefs.current.forEach(v => {
      if (settings.videoAutoplay) {
        v.muted = true
        v.loop = true
        v.playsInline = true
        v.play().catch(() => {})
      } else {
        v.pause()
      }
    })
  }, [settings.videoAutoplay, visiblePosts.length])

  const exportTXT = () => {
    const now = Date.now()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)

    let filtered = allPosts
    if (exportRange === 'today') filtered = allPosts.filter(p => p.publishedAt >= todayStart.getTime())
    else if (exportRange === 'week') filtered = allPosts.filter(p => p.publishedAt >= weekStart.getTime())

    const unique = new Map<string, { name: string; link: string; lastPost: number }>()
    filtered.forEach(p => {
      const key = p.name.toLowerCase().trim()
      if (!unique.has(key) || unique.get(key)!.lastPost < p.publishedAt) {
        unique.set(key, { name: p.name, link: p.link, lastPost: p.publishedAt })
      }
    })

    const sorted = [...unique.values()].sort((a, b) => b.lastPost - a.lastPost)

    let lines = ['Список групп', '='.repeat(50), '']
    if (exportRange === 'today') lines.push('Период: сегодня')
    else if (exportRange === 'week') lines.push('Период: последние 7 дней')
    else lines.push('Период: все посты')
    lines.push('')

    let i = 1
    sorted.forEach(v => {
      const date = new Date(v.lastPost).toLocaleString('ru-RU')
      lines.push(`${i}. ${v.name}`)
      lines.push(`   ${v.link}`)
      lines.push(`   Последнее обновление: ${date}`)
      lines.push('')
      i++
    })

    lines.push('='.repeat(50))
    lines.push(`Всего: ${sorted.length} групп`)
    lines.push('')
    lines.push('Сгенерировано: ' + new Date().toLocaleString('ru-RU'))

    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `radar-groups-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getPostDisplayProps = (post: Post) => {
    const age = now - post.publishedAt
    const isHot = post.likes >= 100
    const isNew = age < 2000
    const scale = isHot ? 1.15 : 1
    const isIlluminated = !sonarMode || sonarFound.has(post.id)
    let breatheDelay = 0
    const seed = post.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    breatheDelay = (seed % 5000) / 1000
    const isDragging = dragState?.postId === post.id

    return { scale, opacity: 1, isIlluminated, breatheDelay, isHot, isNew, isDragging, visible: !sonarMode || sonarFound.has(post.id) }
  }

  return (
    <main className={`wall ${fullscreen ? 'fullscreen' : ''}`} ref={containerRef}>
      <div className="radar-bg">
        <div className="radar-grid">
          <div className="radar-circle c1" />
          <div className="radar-circle c2" />
          <div className="radar-circle c3" />
          <div className="radar-circle c4" />
          <div className="radar-line h" />
          <div className="radar-line v" />
        </div>
        <div className="radar-sweep" />
      </div>

      <header className="header">
        <div className="logo"><img src="/logo.png" alt="ДП" style={{ filter: 'brightness(10)' }} /></div>
        <h1 className="title">РАДАР</h1>
        <div className="header-actions">
          <button className="icon-btn" onClick={() => { setHistoryOpen(!historyOpen); setPanelOpen(false) }} title="История">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
          <button className="icon-btn" onClick={() => { setPanelOpen(!panelOpen); setHistoryOpen(false) }} title="Панель">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </header>

      {/* History Sidebar */}
      <div className={`sidebar history-sidebar ${historyOpen ? 'open' : ''}`}>
        <div className="sidebar-content">
          <div className="sidebar-header">
            <span>История постов</span>
            <button className="sidebar-close" onClick={() => setHistoryOpen(false)}>×</button>
          </div>
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
          <div className="sidebar-footer"><span>© Движение Первых 2026</span></div>
        </div>
      </div>

      {/* Settings Panel Sidebar */}
      <div className={`sidebar settings-sidebar ${panelOpen ? 'open' : ''}`}>
        <div className="sidebar-content">
          <div className="sidebar-header">
            <span>Панель</span>
            <button className="sidebar-close" onClick={() => setPanelOpen(false)}>×</button>
          </div>

          <div className="panel-section">
            <div className="panel-section-label">Тема</div>
            <div className="panel-themes">
              {(Object.keys(THEMES) as ThemeKey[]).map(key => (
                <button
                  key={key}
                  className={`panel-theme-btn ${settings.theme === key ? 'active' : ''}`}
                  onClick={() => handleSettingsChange('theme', key)}
                >
                  <span className="theme-dot-inline" style={{ background: THEMES[key].dot }} />
                  {THEMES[key].label}
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
            <div className="panel-section-label">Автоплей видео (без звука)</div>
            <button
              className={`panel-toggle-btn ${settings.videoAutoplay ? 'active' : ''}`}
              onClick={() => handleSettingsChange('videoAutoplay', !settings.videoAutoplay)}
            >
              {settings.videoAutoplay ? 'Включён' : 'Выключен'}
            </button>
          </div>

          <div className="panel-section">
            <div className="panel-section-label">Звук при новом посте</div>
            <button
              className={`panel-toggle-btn ${settings.soundEnabled ? 'active' : ''}`}
              onClick={() => handleSettingsChange('soundEnabled', !settings.soundEnabled)}
            >
              {settings.soundEnabled ? 'Включён' : 'Выключен'}
            </button>
          </div>

          <div className="panel-section">
            <div className="panel-section-label">Уведомления</div>
            <button
              className={`panel-toggle-btn ${settings.notifications ? 'active' : ''}`}
              onClick={() => {
                if (!settings.notifications && 'Notification' in window) {
                  Notification.requestPermission().then(p => {
                    handleSettingsChange('notifications', p === 'granted')
                  })
                } else {
                  handleSettingsChange('notifications', !settings.notifications)
                }
              }}
            >
              {settings.notifications ? 'Включены' : 'Выключены'}
            </button>
          </div>

          <div className="panel-section">
            <div className="panel-section-label">Частицы на фоне</div>
            <button
              className={`panel-toggle-btn ${settings.particles ? 'active' : ''}`}
              onClick={() => handleSettingsChange('particles', !settings.particles)}
            >
              {settings.particles ? 'Включены' : 'Выключены'}
            </button>
          </div>

          <div className="panel-section">
            <button className="panel-effects-header" onClick={() => setEffectsOpen(!effectsOpen)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              Эффекты
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`effects-chevron ${effectsOpen ? 'open' : ''}`}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {effectsOpen && (
              <div className="panel-effects-list">
                <label className="panel-effect-item">
                  <span className="panel-effect-icon">❄</span>
                  <span className="panel-effect-label">Снег</span>
                  <input type="checkbox" checked={settings.effects.snow} onChange={() => handleEffectToggle('snow')} />
                  <span className="panel-effect-toggle"><span className={`toggle-dot ${settings.effects.snow ? 'on' : ''}`} /></span>
                </label>
                <label className="panel-effect-item">
                  <span className="panel-effect-icon">⚡</span>
                  <span className="panel-effect-label">Тряска нового поста</span>
                  <input type="checkbox" checked={settings.effects.newPostShake} onChange={() => handleEffectToggle('newPostShake')} />
                  <span className="panel-effect-toggle"><span className={`toggle-dot ${settings.effects.newPostShake ? 'on' : ''}`} /></span>
                </label>
                <label className="panel-effect-item">
                  <span className="panel-effect-icon">🌌</span>
                  <span className="panel-effect-label">Туманность на фоне</span>
                  <input type="checkbox" checked={settings.effects.nebula} onChange={() => handleEffectToggle('nebula')} />
                  <span className="panel-effect-toggle"><span className={`toggle-dot ${settings.effects.nebula ? 'on' : ''}`} /></span>
                </label>
              </div>
            )}
          </div>

          <div className="panel-section">
            <div className="panel-section-label">Частота обновления</div>
            <div className="panel-options">
              {REFRESH_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`panel-option ${settings.refreshInterval === opt.value ? 'active' : ''}`}
                  onClick={() => handleSettingsChange('refreshInterval', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-section-label">Показывать посты за</div>
            <div className="panel-options">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`panel-option ${settings.postPeriod === opt.value ? 'active' : ''}`}
                  onClick={() => handleSettingsChange('postPeriod', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-section-label">Инструменты</div>
            <div className="panel-tools">
              <button className={`panel-tool-btn ${sonarMode ? 'active' : ''}`} onClick={handleSonarToggle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>
                Сонар {sonarMode ? 'ВКЛ' : 'ВЫКЛ'}
              </button>
              <button className="panel-tool-btn" onClick={handleFullscreenToggle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {fullscreen ? (
                    <><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/></>
                  ) : (
                    <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></>
                  )}
                </svg>
                {fullscreen ? 'Выйти' : 'Полный экран'}
              </button>
              <button className={`panel-tool-btn ${scanning ? 'active' : ''}`} onClick={handleManualScan} disabled={scanning}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                  <polyline points="21 3 21 9 15 9"/>
                </svg>
                {scanning ? 'Обновление...' : scanResult || 'Обновить'}
              </button>
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-section-label">Экспорт групп</div>
            <div className="export-range-btns">
              <button className={`range-btn ${exportRange === 'today' ? 'active' : ''}`} onClick={() => setExportRange('today')}>Сегодня</button>
              <button className={`range-btn ${exportRange === 'week' ? 'active' : ''}`} onClick={() => setExportRange('week')}>Неделя</button>
              <button className={`range-btn ${exportRange === 'all' ? 'active' : ''}`} onClick={() => setExportRange('all')}>Все</button>
            </div>
            <button className="export-btn" onClick={exportTXT}>Скачать .txt</button>
          </div>
        </div>
      </div>

      <div className="posts-layer">
        {!fullscreen && (
          <div className="mobile-controls">
            <div className="mobile-search">
              <input type="text" placeholder="Поиск по группам..." value={mobileSearch} onChange={e => setMobileSearch(e.target.value)} />
            </div>
            <div className="mobile-sort">
              <button className={mobileSort === 'newest' ? 'active' : ''} onClick={() => setMobileSort('newest')}>Новые</button>
              <button className={mobileSort === 'likes' ? 'active' : ''} onClick={() => setMobileSort('likes')}>Лайки</button>
            </div>
          </div>
        )}

        {filteredPosts
          .filter(p => !mobileSearch || p.name.toLowerCase().includes(mobileSearch.toLowerCase()))
          .sort((a, b) => {
            if (mobileSort === 'likes') return b.likes - a.likes
            if (mobileSort === 'oldest') return a.publishedAt - b.publishedAt
            return b.publishedAt - a.publishedAt
          })
          .map(post => {
            const props = getPostDisplayProps(post)
            const isDragging = dragState?.postId === post.id && dragState.moved
            const isNewPost = newPostIds.has(post.id)
            const postType = post.video ? 'video' : post.image ? 'image' : 'text'
            const itemLeft = isDragging ? dragState.currentX : post.x
            const itemTop = isDragging ? dragState.currentY : post.y
            const transform = `translate(-50%, -50%) scale(${isDragging ? 1.05 : props.scale})`
            const hasVictoryMention = post.text.toLowerCase().includes('день победы') || post.text.toLowerCase().includes('9 мая')

            return (
              <div
                key={post.id}
                className={`post ${postType}-post ${isNewPost ? 'just-appeared' : ''} ${props.isHot ? 'hot' : ''} ${props.isNew ? 'new-post' : ''} ${isDragging ? 'dragging' : ''} ${isNewPost && settings.effects.newPostShake ? 'shake' : ''} ${hasVictoryMention ? 'victory-post' : ''}`}
                style={{
                  left: itemLeft,
                  top: itemTop,
                  width: post.w,
                  opacity: sonarMode ? (props.visible ? 1 : 0) : 1,
                  transform: transform,
                  transition: isDragging ? 'none' : 'left 0.2s ease-out, top 0.2s ease-out, transform 0.2s, opacity 0.3s, width 0.3s',
                  animation: isNewPost ? 'appearFromCenter 0.6s ease-out' : `breathe 6s ease-in-out ${props.breatheDelay}s infinite`,
                  zIndex: isDragging ? 1000 : 1,
                  filter: 'none',
                  cursor: sonarMode ? 'default' : 'grab',
                }}
                onClick={(e) => {
                  if (isDragging || sonarMode) return
                  const target = e.target as HTMLElement
                  if (target.closest('.vk-link')) return
                  setSelectedPost(post)
                  setModalPhotoIndex(0)
                }}
                onMouseDown={e => handleMouseDown(post.id, e)}
              >
                <div className="post-header">
                  <div className={`avatar avatar-${postType}`}>{post.avatar ? <img src={post.avatar} alt="" /> : 'П'}</div>
                  <div className="post-info"><h3>{post.name}</h3><span>{post.time}</span></div>
                </div>
                <div className="post-text"
                  onClick={(e) => e.stopPropagation()}
                >{textSearch ? highlightedText(decodeHtml(post.text || '[Без текста]'), textSearch) : <span dangerouslySetInnerHTML={{ __html: parseVkLinks(decodeHtml(post.text || '[Без текста]')) }} />}</div>
                {post.video && !post.video.isClip ? (
                  getVideoSrc(post.video) ? (
                    <video
                      ref={el => {
                        if (el) {
                          videoRefs.current.set(post.id, el)
                          if (settings.videoAutoplay) {
                            el.muted = true
                            el.loop = true
                            el.playsInline = true
                            el.play().catch(() => {})
                          } else {
                            el.pause()
                          }
                        }
                      }}
                      src={getVideoSrc(post.video)}
                      preload="auto"
                      className={`video-autoplay-inline ${settings.videoAutoplay ? 'playing' : ''}`}
                      onCanPlay={e => {
                        if (settings.videoAutoplay) {
                          const v = e.currentTarget
                          v.muted = true
                          v.loop = true
                          v.play().catch(() => {})
                        }
                      }}
                    />
                  ) : (
                    <div className="video-thumb-only">
                      {post.video.thumb && <img src={post.video.thumb} alt="" />}
                      <div className="video-thumb-badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        {post.video.duration > 0 && <span>{Math.floor(post.video.duration / 60)}:{(post.video.duration % 60).toString().padStart(2, '0')}</span>}
                      </div>
                    </div>
                  )
                ) : null}
                {post.video && post.video.isClip ? (
                  <div className="clip-preview">
                    {post.video.thumb && <img src={post.video.thumb} alt="" />}
                    <div className="clip-preview-overlay">
                      <span className="clip-label">КЛИП</span>
                      <a href={post.link} target="_blank" rel="noopener" className="clip-watch-btn" onClick={e => e.stopPropagation()}>Смотреть</a>
                    </div>
                  </div>
                ) : null}
                {post.images && post.images.length > 1 && !post.video ? (
                  <div className="post-image-carousel">
                    <img src={post.images[photoIndexes.get(post.id) || 0]} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <div className="carousel-dots">
                      {post.images.map((_, i) => (
                        <span key={i} className={`carousel-dot ${(photoIndexes.get(post.id) || 0) === i ? 'active' : ''}`} />
                      ))}
                    </div>
                  </div>
                ) : post.image && !post.video && (
                  <div className="post-image">
                    <img src={post.image} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  </div>
                )}
                <div className="post-footer">
                  <div className="footer-actions">
                    <span className="footer-action likes">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      {post.likes || 0}
                    </span>
                    <span className="footer-action comments">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </span>
                    <span className="footer-action shares">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                    </span>
                  </div>
                  {post.link && (
                    <a href={post.link} target="_blank" rel="noopener noreferrer" className="footer-open-link" onClick={e => e.stopPropagation()}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            )
          })}
      </div>

        {selectedPost && (
        <div className="post-modal" onClick={() => setSelectedPost(null)}>
          <div className="post-modal-content" onClick={e => e.stopPropagation()}>
            <div className="post-modal-header"><h2>{selectedPost.name}</h2><button className="close-btn" onClick={() => setSelectedPost(null)}>×</button></div>
            <div className="post-modal-text" dangerouslySetInnerHTML={{ __html: parseVkLinks(decodeHtml(selectedPost.text)) }}></div>
            {selectedPost.video && (
              <div className="post-modal-video">
                {getVideoSrc(selectedPost.video) ? (
                  <video
                    className="post-modal-video-iframe"
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                    src={getVideoSrc(selectedPost.video)}
                  />
                ) : selectedPost.video.player ? (
                  <iframe
                    className="post-modal-video-iframe"
                    src={selectedPost.video.player}
                    frameBorder="0"
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="post-modal-video-fallback">
                    <a href={`https://vk.com/video${selectedPost.video.id}`} target="_blank" rel="noopener noreferrer" className="post-modal-video-link">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      Открыть видео в VK
                    </a>
                  </div>
                )}
              </div>
            )}
            {selectedPost.images && selectedPost.images.length > 1 && !selectedPost.video && (
              <div className="post-modal-image-carousel">
                <button className="carousel-arrow carousel-prev" onClick={() => {
                  setModalPhotoIndex(idx => idx === 0 ? selectedPost.images!.length - 1 : idx - 1)
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div className="post-modal-image">
                  <img src={selectedPost.images[modalPhotoIndex]} alt="" />
                </div>
                <button className="carousel-arrow carousel-next" onClick={() => {
                  setModalPhotoIndex(idx => (idx + 1) % selectedPost.images!.length)
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                <div className="carousel-counter">{modalPhotoIndex + 1} / {selectedPost.images.length}</div>
              </div>
            )}
            {selectedPost.image && (!selectedPost.images || selectedPost.images.length <= 1) && !selectedPost.video && <div className="post-modal-image"><img src={selectedPost.image} alt="" /></div>}
            <div className="post-modal-footer">
              <span className="likes">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                {selectedPost.likes || 0}
              </span>
              {selectedPost.link && <a href={selectedPost.link} target="_blank" rel="noopener noreferrer" className="source-link">Открыть в VK</a>}
            </div>
          </div>
        </div>
      )}

      {settings.particles && (
        <div className="particles-bg">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              width: `${2 + (i % 4)}px`,
              height: `${2 + (i % 4)}px`,
              animationDelay: `${(i * 0.7) % 8}s`,
              animationDuration: `${6 + (i % 6)}s`,
              opacity: 0.3 + (i % 5) * 0.1,
            }} />
          ))}
        </div>
      )}

      {settings.effects.snow && (
        <div className="snow-bg">
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i} className="snowflake" style={{
              left: `${(i * 23) % 100}%`,
              animationDelay: `${(i * 0.47) % 12}s`,
              animationDuration: `${8 + (i % 7)}s`,
              width: `${2 + (i % 4)}px`,
              height: `${2 + (i % 4)}px`,
              opacity: 0.4 + (i % 5) * 0.12,
            }} />
          ))}
        </div>
      )}

      {settings.effects.nebula && (
        <div className="nebula-bg">
          <div className="nebula-cloud n1" />
          <div className="nebula-cloud n2" />
          <div className="nebula-cloud n3" />
          <div className="nebula-cloud n4" />
        </div>
      )}

      {!fullscreen && (
        <div className="queue-info">
          <span className="pulse" />
          На радаре: {visiblePosts.length} | Всего: {allPosts.length} | Сегодня: {todayCount}
        </div>
      )}

      {fullscreen && (
        <button className="exit-fullscreen" onClick={handleFullscreenToggle}>
          Выйти из полного экрана (Esc)
        </button>
      )}

      {settings.theme === 'victory' && (
        <div className="victory-scenery">
          <div className="victory-ribbon-across"></div>
          <svg className="victory-kremlin-svg" viewBox="0 0 1600 350" preserveAspectRatio="none">
            <defs>
              <linearGradient id="krGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9"/>
                <stop offset="40%" stopColor="#d97706" stopOpacity="0.7"/>
                <stop offset="100%" stopColor="#1a1208" stopOpacity="0.95"/>
              </linearGradient>
              <linearGradient id="tankGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4a5d23"/>
                <stop offset="100%" stopColor="#2a3d13"/>
              </linearGradient>
              <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffeb3b"/>
                <stop offset="50%" stopColor="#f59e0b"/>
                <stop offset="100%" stopColor="#d97706"/>
              </linearGradient>
              <filter id="kglow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Kremlin Wall */}
            <rect x="0" y="280" width="1600" height="70" fill="url(#krGrad)" filter="url(#kglow)"/>
            {/* Wall teeth pattern */}
            <path d="M0 280 L40 280 L40 260 L80 260 L80 280 L120 280 L120 260 L160 260 L160 280 L200 280 L200 260 L240 260 L240 280 L280 280 L280 260 L320 260 L320 280 L360 280 L360 260 L400 260 L400 280 L440 280 L440 260 L480 260 L480 280 L520 280 L520 260 L560 260 L560 280 L600 280 L600 260 L640 260 L640 280 L680 280 L680 260 L720 260 L720 280 L760 280 L760 260 L800 260 L800 280 L840 280 L840 260 L880 260 L880 280 L920 280 L920 260 L960 260 L960 280 L1000 280 L1000 260 L1040 260 L1040 280 L1080 280 L1080 260 L1120 260 L1120 280 L1160 280 L1160 260 L1200 260 L1200 280 L1240 280 L1240 260 L1280 260 L1280 280 L1320 280 L1320 260 L1360 260 L1360 280 L1400 280 L1400 260 L1440 260 L1440 280 L1480 280 L1480 260 L1520 260 L1520 280 L1560 280 L1560 260 L1600 260" fill="url(#krGrad)"/>
            {/* Spasskaya Tower (center) */}
            <rect x="700" y="100" width="60" height="180" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="700,100 730,40 760,100" fill="url(#krGrad)" filter="url(#kglow)"/>
            <rect x="725" y="20" width="10" height="80" fill="url(#krGrad)"/>
            <polygon points="725,20 730,0 735,20" fill="#f59e0b" filter="url(#softGlow)"/>
            <circle cx="730" cy="80" r="12" fill="none" stroke="#f59e0b" strokeWidth="2" filter="url(#softGlow)"/>
            <line x1="730" y1="80" x2="730" y2="72" stroke="#f59e0b" strokeWidth="2"/>
            <line x1="730" y1="80" x2="736" y2="80" stroke="#f59e0b" strokeWidth="1.5"/>
            {/* Borovitskaya Tower */}
            <rect x="300" y="140" width="45" height="140" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="300,140 322.5,90 345,140" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="322.5,95 319,75 322.5,55 326,75" fill="#f59e0b" filter="url(#softGlow)"/>
            {/* Troitskaya Tower */}
            <rect x="1100" y="120" width="50" height="160" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="1100,120 1125,70 1150,120" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="1125,75 1122,55 1125,35 1128,55" fill="#f59e0b" filter="url(#softGlow)"/>
            {/* Nikolskaya Tower */}
            <rect x="1350" y="150" width="40" height="130" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="1350,150 1370,110 1390,150" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="1370,115 1367,95 1370,75 1373,95" fill="#f59e0b" filter="url(#softGlow)"/>
            {/* Senate Tower */}
            <rect x="500" y="160" width="35" height="120" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="500,160 517.5,120 535,160" fill="url(#krGrad)" filter="url(#kglow)"/>
            {/* Arsenal Corner Tower */}
            <rect x="900" y="170" width="30" height="110" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="900,170 915,135 930,170" fill="url(#krGrad)" filter="url(#kglow)"/>
            {/* Additional wall sections */}
            <rect x="100" y="180" width="25" height="100" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="100,180 112.5,150 125,180" fill="url(#krGrad)"/>
            <rect x="200" y="190" width="20" height="90" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="200,190 210,165 220,190" fill="url(#krGrad)"/>
            <rect x="420" y="200" width="20" height="80" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="420,200 430,175 440,200" fill="url(#krGrad)"/>
            <rect x="600" y="175" width="22" height="105" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="600,175 611,145 622,175" fill="url(#krGrad)"/>
            <rect x="800" y="190" width="18" height="90" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="800,190 809,165 818,190" fill="url(#krGrad)"/>
            <rect x="1000" y="185" width="20" height="95" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="1000,185 1010,158 1020,185" fill="url(#krGrad)"/>
            <rect x="1250" y="175" width="22" height="105" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="1250,175 1261,148 1272,175" fill="url(#krGrad)"/>
            <rect x="1480" y="200" width="20" height="80" fill="url(#krGrad)" filter="url(#kglow)"/>
            <polygon points="1480,200 1490,175 1500,200" fill="url(#krGrad)"/>
            {/* Ground / Red Square */}
            <rect x="0" y="340" width="1600" height="10" fill="#f59e0b" opacity="0.3" filter="url(#softGlow)"/>
            {/* Tank T-34 - left side */}
            <g transform="translate(150, 300) scale(1.2)" filter="url(#softGlow)">
              <rect x="0" y="20" width="80" height="15" rx="3" fill="url(#tankGrad)"/>
              <path d="M5 20 Q5 5 40 5 Q75 5 75 20" fill="url(#tankGrad)"/>
              <rect x="10" y="2" width="30" height="8" rx="2" fill="url(#tankGrad)"/>
              <rect x="65" y="8" width="35" height="4" rx="1" fill="url(#tankGrad)"/>
              <circle cx="15" cy="35" r="6" fill="#3a4d1a" stroke="#4a5d23" strokeWidth="1"/>
              <circle cx="30" cy="35" r="6" fill="#3a4d1a" stroke="#4a5d23" strokeWidth="1"/>
              <circle cx="45" cy="35" r="6" fill="#3a4d1a" stroke="#4a5d23" strokeWidth="1"/>
              <circle cx="60" cy="35" r="6" fill="#3a4d1a" stroke="#4a5d23" strokeWidth="1"/>
              <circle cx="5" cy="35" r="5" fill="#3a4d1a" stroke="#4a5d23" strokeWidth="1"/>
              <circle cx="70" cy="35" r="5" fill="#3a4d1a" stroke="#4a5d23" strokeWidth="1"/>
              <rect x="8" y="30" width="58" height="4" fill="#3a4d1a"/>
            </g>
            {/* Tank IS-2 - right side */}
            <g transform="translate(1200, 295) scale(1.3)" filter="url(#softGlow)">
              <rect x="0" y="25" width="85" height="18" rx="3" fill="url(#tankGrad)"/>
              <path d="M5 25 Q5 8 42 8 Q77 8 77 25" fill="url(#tankGrad)"/>
              <rect x="15" y="3" width="25" height="10" rx="2" fill="url(#tankGrad)"/>
              <rect x="70" y="10" width="40" height="5" rx="1" fill="url(#tankGrad)"/>
              <circle cx="12" cy="43" r="7" fill="#3a4d1a" stroke="#4a5d23" strokeWidth="1"/>
              <circle cx="28" cy="43" r="7" fill="#3a4d1a" stroke="#4a5d23" strokeWidth="1"/>
              <circle cx="42" cy="43" r="7" fill="#3a4d1a" stroke="#4a5d23" strokeWidth="1"/>
              <circle cx="56" cy="43" r="7" fill="#3a4d1a" stroke="#4a5d23" strokeWidth="1"/>
              <circle cx="70" cy="43" r="7" fill="#3a4d1a" stroke="#4a5d23" strokeWidth="1"/>
              <circle cx="5" cy="43" r="5" fill="#3a4d1a" stroke="#4a5d23" strokeWidth="1"/>
              <circle cx="78" cy="43" r="5" fill="#3a4d1a" stroke="#4a5d23" strokeWidth="1"/>
              <rect x="10" y="38" width="60" height="5" fill="#3a4d1a"/>
            </g>
            {/* Firework bursts */}
            <g filter="url(#softGlow)" opacity="0.8">
              <g transform="translate(200, 50)">
                <line x1="0" y1="0" x2="-15" y2="-20" stroke="#f59e0b" strokeWidth="2"/>
                <line x1="0" y1="0" x2="15" y2="-20" stroke="#f59e0b" strokeWidth="2"/>
                <line x1="0" y1="0" x2="0" y2="-25" stroke="#f59e0b" strokeWidth="2"/>
                <line x1="0" y1="0" x2="-20" y2="-5" stroke="#ffeb3b" strokeWidth="1.5"/>
                <line x1="0" y1="0" x2="20" y2="-5" stroke="#ffeb3b" strokeWidth="1.5"/>
                <circle cx="0" cy="0" r="3" fill="#f59e0b"/>
              </g>
              <g transform="translate(600, 30)">
                <line x1="0" y1="0" x2="-12" y2="-18" stroke="#ff6b35" strokeWidth="2"/>
                <line x1="0" y1="0" x2="12" y2="-18" stroke="#ff6b35" strokeWidth="2"/>
                <line x1="0" y1="0" x2="0" y2="-22" stroke="#ff6b35" strokeWidth="2"/>
                <line x1="0" y1="0" x2="-18" y2="-8" stroke="#f59e0b" strokeWidth="1.5"/>
                <line x1="0" y1="0" x2="18" y2="-8" stroke="#f59e0b" strokeWidth="1.5"/>
                <circle cx="0" cy="0" r="3" fill="#ff6b35"/>
              </g>
              <g transform="translate(1000, 45)">
                <line x1="0" y1="0" x2="-14" y2="-19" stroke="#f59e0b" strokeWidth="2"/>
                <line x1="0" y1="0" x2="14" y2="-19" stroke="#f59e0b" strokeWidth="2"/>
                <line x1="0" y1="0" x2="0" y2="-24" stroke="#f59e0b" strokeWidth="2"/>
                <line x1="0" y1="0" x2="-19" y2="-6" stroke="#ffeb3b" strokeWidth="1.5"/>
                <line x1="0" y1="0" x2="19" y2="-6" stroke="#ffeb3b" strokeWidth="1.5"/>
                <circle cx="0" cy="0" r="3" fill="#f59e0b"/>
              </g>
              <g transform="translate(1400, 60)">
                <line x1="0" y1="0" x2="-13" y2="-17" stroke="#ffeb3b" strokeWidth="2"/>
                <line x1="0" y1="0" x2="13" y2="-17" stroke="#ffeb3b" strokeWidth="2"/>
                <line x1="0" y1="0" x2="0" y2="-21" stroke="#ffeb3b" strokeWidth="2"/>
                <line x1="0" y1="0" x2="-17" y2="-7" stroke="#f59e0b" strokeWidth="1.5"/>
                <line x1="0" y1="0" x2="17" y2="-7" stroke="#f59e0b" strokeWidth="1.5"/>
                <circle cx="0" cy="0" r="3" fill="#ffeb3b"/>
              </g>
            </g>
            {/* Stars above towers */}
            <g fill="url(#starGrad)" filter="url(#softGlow)">
              <polygon points="730,2 726,-8 730,-18 734,-8"/>
              <polygon points="730,-8 716,-12 730,-16 744,-12"/>
              <polygon points="322.5,60 318,48 322.5,36 327,48"/>
              <polygon points="322.5,48 308,44 322.5,40 337,44"/>
              <polygon points="1125,40 1121,28 1125,16 1129,28"/>
              <polygon points="1125,28 1111,24 1125,20 1139,24"/>
              <polygon points="1370,80 1366,68 1370,56 1374,68"/>
              <polygon points="1370,68 1356,64 1370,60 1384,64"/>
            </g>
          </svg>
          <div className="victory-sparks">
            <span className="spark s1"></span>
            <span className="spark s2"></span>
            <span className="spark s3"></span>
            <span className="spark s4"></span>
            <span className="spark s5"></span>
            <span className="spark s6"></span>
            <span className="spark s7"></span>
            <span className="spark s8"></span>
            <span className="spark s9"></span>
            <span className="spark s10"></span>
          </div>
        </div>
      )}
    </main>
  )
}
