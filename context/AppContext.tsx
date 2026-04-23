'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Room, Worker } from '@/lib/types'
import { supabase } from '@/lib/supabase'

type AppContextType = {
  currentWorker: Worker | null
  currentDate: string
  rooms: Room[]
  workers: Worker[]
  setCurrentWorker: (worker: Worker | null) => void
  setCurrentDate: (date: string) => void
  isReady: boolean
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentWorker, setCurrentWorkerState] = useState<Worker | null>(null)
  const [currentDate, setCurrentDate] = useState<string>('')
  const [rooms, setRooms] = useState<Room[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [roomsRes, workersRes] = await Promise.all([
        supabase.from('rooms').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('workers').select('*').eq('is_active', true).order('name'),
      ])
      if (roomsRes.data) setRooms(roomsRes.data)
      if (workersRes.data) setWorkers(workersRes.data)

      // 前回の入力者を復元
      const saved = localStorage.getItem('poultry_worker')
      if (saved && workersRes.data) {
        const w = workersRes.data.find((x) => x.name === saved)
        if (w) setCurrentWorkerState(w)
      }

      // 今日の日付をセット
      const today = new Date()
      const y = today.getFullYear()
      const m = String(today.getMonth() + 1).padStart(2, '0')
      const d = String(today.getDate()).padStart(2, '0')
      setCurrentDate(`${y}-${m}-${d}`)

      setIsReady(true)
    }
    load()
  }, [])

  const setCurrentWorker = (worker: Worker | null) => {
    setCurrentWorkerState(worker)
    if (worker) localStorage.setItem('poultry_worker', worker.name)
    else localStorage.removeItem('poultry_worker')
  }

  return (
    <AppContext.Provider value={{
      currentWorker, currentDate, rooms, workers,
      setCurrentWorker, setCurrentDate, isReady,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
