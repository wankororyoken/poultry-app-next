import type { Metadata, Viewport } from 'next'
import { Noto_Sans_JP } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/context/AppContext'

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: '養鶏管理',
  description: '養鶏管理アプリ',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '養鶏管理' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <body className={`${notoSansJP.className} h-full bg-bg text-text`}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  )
}
