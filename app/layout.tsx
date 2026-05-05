import type { Metadata } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'РАДАР | Движение Первых',
  description: 'Мониторинг активности Движения Первых',
  icons: [
    { rel: 'icon', url: '/logo.png', sizes: '32x32', type: 'image/png' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <head>
        <link rel="icon" href="/logo.png" sizes="any" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <Script
          id="init-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var raw = localStorage.getItem('radar-settings-v5') || localStorage.getItem('radar-settings-v4') || '{}';
                var s = JSON.parse(raw);
                var t = s.theme || 'blue';
                var icons = { blue: '/logo.png', red: '/logo-red.png', green: '/logo-green.png', white: '/logo-white.png', victory: '/logo.png', glass: '/logo.png' };
                var link = document.querySelector("link[rel='icon']");
                if (link) link.href = icons[t] || '/logo.png';
                document.documentElement.setAttribute('data-theme', t);
              } catch(e) {}
            `,
          }}
        />
        {children}
      </body>
    </html>
  )
}
