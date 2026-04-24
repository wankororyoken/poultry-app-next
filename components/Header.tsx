'use client'

import { useApp } from '@/context/AppContext'
import { useState } from 'react'

export default function Header({ title }: { title: string }) {
  const { currentWorker, currentDate, setCurrentDate, setCurrentWorker } = useApp()
  const [showWorkerMenu, setShowWorkerMenu] = useState(false)
  const { workers } = useApp()

  const dateLabel = currentDate
    ? new Date(currentDate + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
    : ''

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-surface border-b border-border
                         flex items-center justify-between px-4
                         h-[calc(52px+env(safe-area-inset-top,0px))]
                         pt-[env(safe-area-inset-top,0px)]">
        <span className="text-base font-black"
          style={{ background: 'linear-gradient(135deg, #f5a623, #e8743b)',
                   WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {title}
        </span>

        <div className="flex items-center gap-2">
          {/* 日付 */}
          <label className="relative bg-surface2 border border-border rounded-full
                            px-3 py-1 text-xs font-bold text-text cursor-pointer">
            📅 {dateLabel}
            <input
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              className="absolute inset-0 opacity-0 w-full cursor-pointer"
            />
          </label>

          {/* 入力者 */}
          <button
            onClick={() => setShowWorkerMenu(true)}
            className="bg-surface2 border border-border rounded-full px-3 py-1
                       text-xs font-bold text-accent"
          >
            {currentWorker?.name}
          </button>
        </div>
      </header>

      {/* 入力者変更モーダル */}
      {showWorkerMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end"
          onClick={() => setShowWorkerMenu(false)}
        >
          <div
            className="w-full bg-surface rounded-t-2xl p-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-bold text-text2 mb-4">入力者を変更</div>
            <div className="grid grid-cols-2 gap-2">
              {workers.map((w) => (
                <button
                  key={w.id}
                  onClick={() => { setCurrentWorker(w); setShowWorkerMenu(false) }}
                  className={`py-3 rounded-xl text-sm font-bold border transition-all
                    ${currentWorker?.id === w.id
                      ? 'bg-accent text-black border-accent'
                      : 'bg-surface2 text-text border-border'}`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
