'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface VideoPlayerProps {
  video: {
    id: string
    title: string
    duration: number
    player: string | null
    thumb: string | null
    files: Record<string, string> | null
  }
  onClose?: () => void
  autoplay?: boolean
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function VideoPlayer({ video, onClose }: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [showThumb, setShowThumb] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const buildIframeSrc = useCallback(() => {
    if (!video.player) return null
    try {
      const url = new URL(video.player)
      url.searchParams.set('hd', '2')
      url.searchParams.set('autoplay', '0')
      return url.toString()
    } catch {
      return video.player
    }
  }, [video.player])

  const iframeSrc = buildIframeSrc()

  const toggleFullscreen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  if (!iframeSrc) {
    return (
      <div className="video-error">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>Видео доступно только в VK</p>
        <a href={`https://vk.com/video${video.id}`} target="_blank" rel="noopener noreferrer" className="video-fallback-link">
          Открыть в VK →
        </a>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`video-player ${fullscreen ? 'fullscreen' : ''}`}>
      {showThumb && (
        <div className="video-play-overlay" onClick={() => setShowThumb(false)}>
          {video.thumb && <img src={video.thumb} alt="" className="video-thumb-bg" />}
          <div className="video-big-play">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          {video.duration > 0 && (
            <div className="video-duration-badge">{formatDuration(video.duration)}</div>
          )}
          {onClose && (
            <button className="video-close-btn" onClick={(e) => { e.stopPropagation(); onClose() }}>
              ×
            </button>
          )}
        </div>
      )}

      {!showThumb && (
        <>
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            frameBorder="0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
            allowFullScreen
            className="video-iframe"
          />
          <div className="video-iframe-controls">
            <button className="video-ctrl-btn" onClick={toggleFullscreen}>
              {fullscreen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="4 14 10 14 10 20"/>
                  <polyline points="20 10 14 10 14 4"/>
                  <line x1="14" y1="10" x2="20" y2="4"/>
                  <line x1="10" y1="14" x2="4" y2="20"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 3 21 3 21 9"/>
                  <polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/>
                  <line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              )}
            </button>
            {video.title && <span className="video-title">{video.title}</span>}
          </div>
        </>
      )}
    </div>
  )
}
