'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/context/AppContext'

export default function SetupScreen() {
  const { workers, setCurrentWorker, currentDate, setCurrentDate } = useApp()
  const [selectedWorker, setSelectedWorker] = useState('')
  const [date, setDate] = useState(currentDate)
  const router = useRouter()

  const handleStart = () => {
    const worker = workers.find((w) => w.name === selectedWorker)
    if (!worker) return
    if (!date) return
    setCurrentWorker(worker)
    setCurrentDate(date)
    router.push('/home')
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* タイトル */}
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">🐔</div>
          <h1 className="text-2xl font-black"
            style={{ background: 'linear-gradient(135deg, #f5a623, #e8743b)',
                     WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            養鶏管理
          </h1>
        </div>

        {/* 入力者選択 */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-text2 mb-2 tracking-widest uppercase">
            入力者
          </label>
          <div className="grid grid-cols-2 gap-2">
            {workers.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedWorker(w.name)}
                className={`py-3 px-4 rounded-xl text-sm font-bold border transition-all
                  ${selectedWorker === w.name
                    ? 'bg-accent text-black border-accent'
                    : 'bg-surface2 text-text border-border'}`}
              >
                {w.name}
              </button>
            ))}
          </div>
        </div>

        {/* 日付選択 */}
        <div className="mb-8">
          <label className="block text-xs font-bold text-text2 mb-2 tracking-widest uppercase">
            日付
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-surface2 border border-border rounded-xl px-4 py-3
                       text-text text-sm font-bold focus:outline-none focus:border-accent"
          />
        </div>

        {/* 開始ボタン */}
        <button
          onClick={handleStart}
          disabled={!selectedWorker || !date}
          className="w-full py-4 rounded-xl text-base font-black text-black
                     disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
          style={{ background: 'linear-gradient(135deg, #f5a623, #e8743b)' }}
        >
          開始する
        </button>
      </div>
    </div>
  )
}
