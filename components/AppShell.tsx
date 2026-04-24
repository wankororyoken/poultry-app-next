'use client'

import { useApp } from '@/context/AppContext'
import SetupScreen from './SetupScreen'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { currentWorker, isReady } = useApp()

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="text-text2 text-sm">読み込み中...</div>
      </div>
    )
  }

  if (!currentWorker) {
    return <SetupScreen />
  }

  return (
    <div className="bg-bg">
      <main className="pb-[calc(72px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
