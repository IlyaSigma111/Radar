'use client'

import { useState, useEffect } from 'react'

interface TestStats {
  groups: number
  posts: number
  lastScan: number
  parserActive: boolean
}

export default function TestLanding() {
  const [stats, setStats] = useState<TestStats>({ groups: 0, posts: 0, lastScan: 0, parserActive: false })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/test/groups').then(r => r.json()).catch(() => []),
      fetch('/api/test/scan').then(r => r.json()).catch(() => ({})),
    ]).then(([groups, scan]) => {
      setStats({
        groups: Array.isArray(groups) ? groups.length : 0,
        posts: scan.total || 0,
        lastScan: scan.lastScan || 0,
        parserActive: scan.stats?.updatedAt ? (Date.now() - scan.stats.updatedAt < 120000) : false,
      })
      setLoaded(true)
    })
  }, [])

  return (
    <main className="test-landing">
      <div className="test-bg">
        <div className="test-grid">
          <div className="test-circle c1" />
          <div className="test-circle c2" />
          <div className="test-circle c3" />
          <div className="test-line h" />
          <div className="test-line v" />
        </div>
        <div className="test-sweep" />
      </div>

      <div className="test-particles">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="tp" style={{
            left: `${(i * 29) % 100}%`,
            top: `${(i * 43) % 100}%`,
            width: `${1 + (i % 3)}px`,
            height: `${1 + (i % 3)}px`,
            animationDelay: `${(i * 0.6) % 10}s`,
            animationDuration: `${5 + (i % 8)}s`,
            opacity: 0.2 + (i % 5) * 0.08,
          }} />
        ))}
      </div>

      <div className="test-content">
        <div className="test-badge">BETA</div>

        <div className="test-logo">
          <img src="/logo.png" alt="" className="test-logo-img" />
        </div>

        <h1 className="test-title">
          <span className="test-title-radar">РАДАР</span>
          <span className="test-title-sub">тест-версия</span>
        </h1>

        <p className="test-desc">
          Экспериментальная версия парсера с улучшенной фильтрацией спама,
          расширенными мета-данными и адаптивным управлением лимитами VK API.
        </p>

        <div className="test-stats">
          <div className="test-stat">
            <span className="test-stat-value">{stats.groups}</span>
            <span className="test-stat-label">Групп</span>
          </div>
          <div className="test-stat">
            <span className="test-stat-value">{stats.posts}</span>
            <span className="test-stat-label">Постов</span>
          </div>
          <div className="test-stat">
            <span className={`test-stat-dot ${stats.parserActive ? 'active' : ''}`} />
            <span className="test-stat-value">{stats.parserActive ? 'ON' : 'OFF'}</span>
            <span className="test-stat-label">Парсер</span>
          </div>
        </div>

        <div className="test-actions">
          <a href="/test/radar" className="test-btn primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="1" fill="currentColor"/>
              <line x1="12" y1="2" x2="12" y2="6"/>
            </svg>
            Войти в радар
          </a>
          <a href="/test/links" className="test-btn secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            Управление группами
          </a>
        </div>

        <div className="test-features">
          <div className="test-feature">
            <div className="test-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h3>Фильтрация спама</h3>
            <p>Автоматическое распознавание рекламы, промо-кодов и накрутки</p>
          </div>
          <div className="test-feature">
            <div className="test-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
            </div>
            <h3>Богатые мета-данные</h3>
            <p>Комментарии, просмотры, репосты, типы вложений — всё на карточках</p>
          </div>
          <div className="test-feature">
            <div className="test-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <h3>Rate limit оптимизация</h3>
            <p>Адаптивная задержка между запросами — меньше ошибок VK API</p>
          </div>
          <div className="test-feature">
            <div className="test-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <h3>Анализ медиа</h3>
            <p>Точное определение видео, клипов, аудио, подкастов и историй</p>
          </div>
        </div>

        <div className="test-footer">
          <a href="/" className="test-back">← Основная версия</a>
          <span>© Движение Первых 2026</span>
        </div>
      </div>

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #060e1a; overflow-x: hidden; }
        .test-landing {
          min-height: 100vh;
          background: radial-gradient(ellipse at 50% 30%, #0d1f3c 0%, #060e1a 60%, #020810 100%);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
        }

        /* Background radar */
        .test-bg {
          position: fixed;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          opacity: 0.15;
        }
        .test-grid {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        .test-circle {
          position: absolute;
          border: 1px solid #4169e1;
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        .test-circle.c1 { width: 200px; height: 200px; }
        .test-circle.c2 { width: 400px; height: 400px; }
        .test-circle.c3 { width: 600px; height: 600px; }
        .test-line {
          position: absolute;
          background: #4169e1;
        }
        .test-line.h { width: 800px; height: 1px; top: 50%; left: 50%; transform: translate(-50%, -50%); }
        .test-line.v { width: 1px; height: 800px; top: 50%; left: 50%; transform: translate(-50%, -50%); }
        .test-sweep {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 400px;
          height: 400px;
          transform-origin: 0 0;
          background: conic-gradient(from 0deg, transparent 0deg, rgba(65, 105, 225, 0.3) 30deg, transparent 60deg);
          border-radius: 50%;
          animation: sweep 6s linear infinite;
        }
        @keyframes sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Particles */
        .test-particles {
          position: fixed;
          inset: 0;
          pointer-events: none;
        }
        .tp {
          position: absolute;
          background: #4169e1;
          border-radius: 50%;
          animation: twinkle 4s ease-in-out infinite alternate;
        }
        @keyframes twinkle {
          0% { opacity: 0.1; transform: scale(0.8); }
          100% { opacity: 0.5; transform: scale(1.2); }
        }

        /* Content */
        .test-content {
          position: relative;
          z-index: 1;
          max-width: 800px;
          text-align: center;
        }

        .test-badge {
          display: inline-block;
          background: linear-gradient(135deg, #f59e0b, #f97316);
          color: #000;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 3px;
          padding: 6px 20px;
          border-radius: 20px;
          margin-bottom: 28px;
          text-transform: uppercase;
        }

        .test-logo {
          margin-bottom: 24px;
        }
        .test-logo-img {
          width: 80px;
          height: 80px;
          filter: brightness(10) drop-shadow(0 0 20px rgba(65, 105, 225, 0.5));
          animation: pulse-glow 3s ease-in-out infinite;
        }
        @keyframes pulse-glow {
          0%, 100% { filter: brightness(10) drop-shadow(0 0 20px rgba(65, 105, 225, 0.3)); }
          50% { filter: brightness(12) drop-shadow(0 0 40px rgba(65, 105, 225, 0.6)); }
        }

        .test-title {
          margin-bottom: 20px;
        }
        .test-title-radar {
          display: block;
          font-size: 56px;
          font-weight: 900;
          letter-spacing: 8px;
          color: #4169e1;
          text-shadow: 0 0 40px rgba(65, 105, 225, 0.5);
        }
        .test-title-sub {
          display: block;
          font-size: 16px;
          font-weight: 400;
          letter-spacing: 6px;
          color: #7a8ba8;
          text-transform: uppercase;
          margin-top: 4px;
        }

        .test-desc {
          color: #8899b0;
          font-size: 16px;
          line-height: 1.7;
          max-width: 560px;
          margin: 0 auto 36px;
        }

        /* Stats */
        .test-stats {
          display: flex;
          justify-content: center;
          gap: 40px;
          margin-bottom: 40px;
        }
        .test-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .test-stat-value {
          font-size: 28px;
          font-weight: 800;
          color: #4169e1;
          font-variant-numeric: tabular-nums;
        }
        .test-stat-label {
          font-size: 12px;
          color: #5a6a80;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .test-stat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          margin-bottom: 4px;
        }
        .test-stat-dot.active {
          background: #22c55e;
          box-shadow: 0 0 12px rgba(34, 197, 94, 0.6);
          animation: dot-pulse 2s ease-in-out infinite;
        }
        @keyframes dot-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(34, 197, 94, 0.4); }
          50% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.8); }
        }

        /* Buttons */
        .test-actions {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-bottom: 60px;
          flex-wrap: wrap;
        }
        .test-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 16px 32px;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.25s ease;
          cursor: pointer;
          border: none;
        }
        .test-btn.primary {
          background: linear-gradient(135deg, #4169e1, #3b5dc9);
          color: #fff;
          box-shadow: 0 4px 24px rgba(65, 105, 225, 0.4);
        }
        .test-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(65, 105, 225, 0.6);
        }
        .test-btn.secondary {
          background: rgba(65, 105, 225, 0.1);
          color: #818cf8;
          border: 1px solid rgba(65, 105, 225, 0.3);
        }
        .test-btn.secondary:hover {
          background: rgba(65, 105, 225, 0.2);
          transform: translateY(-2px);
        }

        /* Features */
        .test-features {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 48px;
        }
        .test-feature {
          background: rgba(13, 31, 60, 0.6);
          border: 1px solid rgba(65, 105, 225, 0.12);
          border-radius: 16px;
          padding: 28px 24px;
          text-align: left;
          transition: border-color 0.3s, transform 0.3s;
        }
        .test-feature:hover {
          border-color: rgba(65, 105, 225, 0.3);
          transform: translateY(-2px);
        }
        .test-feature-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(65, 105, 225, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4169e1;
          margin-bottom: 16px;
        }
        .test-feature h3 {
          color: #c5d0e0;
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .test-feature p {
          color: #6b7b94;
          font-size: 13px;
          line-height: 1.5;
        }

        /* Footer */
        .test-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 24px;
          border-top: 1px solid rgba(65, 105, 225, 0.1);
          color: #4a5a70;
          font-size: 13px;
        }
        .test-back {
          color: #4169e1;
          text-decoration: none;
          font-weight: 500;
        }
        .test-back:hover { text-decoration: underline; }

        @media (max-width: 640px) {
          .test-title-radar { font-size: 36px; letter-spacing: 4px; }
          .test-features { grid-template-columns: 1fr; }
          .test-stats { gap: 24px; }
          .test-actions { flex-direction: column; align-items: center; }
          .test-footer { flex-direction: column; gap: 8px; }
        }
      `}</style>
    </main>
  )
}
