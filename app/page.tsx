'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/context/AppContext'
import SetupScreen from '@/components/SetupScreen'

export default function RootPage() {
  const { currentWorker, isReady } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (isReady && currentWorker) {
      router.replace('/home')
    }
  }, [isReady, currentWorker, router])

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="text-text2 text-sm">読み込み中...</div>
      </div>
    )
  }

  if (!currentWorker) return <SetupScreen />

  return null
}
