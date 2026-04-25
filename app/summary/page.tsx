'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import AppShell from '@/components/AppShell'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabase'

type DayRow = {
  date: string
  eggs: number
  feed: number
  dead: number
  feedPerEgg: number | null
}

export default function SummaryPage() {
  const { rooms } = useApp()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [rows, setRows] = useState<DayRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const [{ data: eggs }, { data: feed }, { data: dead }] = await Promise.all([
      supabase.from('egg_records').select('record_date, count').gte('record_date', from).lte('record_date', to),
      supabase.from('feed_records').select('record_date, amount_kg').gte('record_date', from).lte('record_date', to),
      supabase.from('dead_records').select('record_date, count').gte('record_date', from).lte('record_date', to),
    ])

    // 日付ごとに集計
    const eggMap: Record<string, number> = {}
    eggs?.forEach((r) => { eggMap[r.record_date] = (eggMap[r.record_date] || 0) + r.count })

    const feedMap: Record<string, number> = {}
    feed?.forEach((r) => {
      feedMap[r.record_date] = Math.round(((feedMap[r.record_date] || 0) + r.amount_kg) * 10) / 10
    })

    const deadMap: Record<string, number> = {}
    dead?.forEach((r) => { deadMap[r.record_date] = (deadMap[r.record_date] || 0) + r.count })

    // データがある日だけ行を作る
    const dates = new Set([
      ...Object.keys(eggMap),
      ...Object.keys(feedMap),
      ...Object.keys(deadMap),
    ])

    const result: DayRow[] = Array.from(dates).sort().map((date) => {
      const e = eggMap[date] || 0
      const f = feedMap[date] || 0
      return {
        date,
        eggs: e,
        feed: f,
        dead: deadMap[date] || 0,
        feedPerEgg: e > 0 && f > 0 ? Math.round((f * 1000) / e) : null,
      }
    })

    setRows(result)
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  const moveMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1)  { m = 12; y-- }
    setMonth(m); setYear(y)
  }

  const totalEggs = rows.reduce((s, r) => s + r.eggs, 0)
  const totalFeed = Math.round(rows.reduce((s, r) => s + r.feed, 0) * 10) / 10
  const totalDead = rows.reduce((s, r) => s + r.dead, 0)
  const totalFeedPerEgg = totalEggs > 0 && totalFeed > 0
    ? Math.round((totalFeed * 1000) / totalEggs) : null

  const feedPerEggStyle = (g: number | null): React.CSSProperties => {
    if (g == null) return { color: 'var(--color-border)' }
    if (g <= 200) return { color: 'var(--color-green)' }
    if (g <= 300) return { color: 'var(--color-accent)' }
    if (g <= 400) return { color: '#e8743b' }
    return { color: 'var(--color-red)' }
  }

  return (
    <AppShell>
      <Header title="養鶏管理" />
      <div className="pt-[calc(52px+env(safe-area-inset-top))] px-3 py-4 space-y-4">

        {/* 月選択 */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => moveMonth(-1)}
            className="w-10 h-10 flex items-center justify-center bg-surface2 border border-border
                       rounded-full text-text2 font-bold text-lg"
            style={{ touchAction: 'manipulation' }}>‹</button>
          <span className="text-base font-black text-text min-w-[100px] text-center">
            {year}年{month}月
          </span>
          <button onClick={() => moveMonth(1)}
            className="w-10 h-10 flex items-center justify-center bg-surface2 border border-border
                       rounded-full text-text2 font-bold text-lg"
            style={{ touchAction: 'manipulation' }}>›</button>
        </div>

        {/* 月間サマリーカード */}
        {!loading && rows.length > 0 && (
          <div className="bg-surface rounded-2xl border border-border p-4">
            <div className="text-xs font-black text-text2 tracking-widest uppercase mb-3">
              📊 {month}月 月間集計
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface2 rounded-xl border border-border p-3 text-center">
                <div className="text-[10px] text-text2 mb-1">🥚 採卵合計</div>
                <div className="text-xl font-black text-accent">
                  {totalEggs.toLocaleString()}<span className="text-xs ml-0.5">個</span>
                </div>
              </div>
              <div className="bg-surface2 rounded-xl border border-border p-3 text-center">
                <div className="text-[10px] text-text2 mb-1">🌾 餌合計</div>
                <div className="text-xl font-black text-green">
                  {totalFeed.toLocaleString()}<span className="text-xs ml-0.5">kg</span>
                </div>
              </div>
              <div className="bg-surface2 rounded-xl border border-border p-3 text-center">
                <div className="text-[10px] text-text2 mb-1">📈 月間餌/卵</div>
                <div className="text-xl font-black" style={feedPerEggStyle(totalFeedPerEgg)}>
                  {totalFeedPerEgg != null ? <>{totalFeedPerEgg}<span className="text-xs ml-0.5">g</span></> : '－'}
                </div>
              </div>
              <div className="bg-surface2 rounded-xl border border-border p-3 text-center">
                <div className="text-[10px] text-text2 mb-1">💀 死鶏合計</div>
                <div className={`text-xl font-black ${totalDead > 0 ? 'text-red' : 'text-text2'}`}>
                  {totalDead}<span className="text-xs ml-0.5">羽</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 日別テーブル */}
        <div className="bg-surface rounded-2xl border border-border p-4">
          <div className="text-xs font-black text-text2 tracking-widest uppercase mb-3">
            📅 日別一覧
          </div>
          {loading ? (
            <p className="text-sm text-text2 text-center py-4">読み込み中...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-text2 text-center py-4">データがありません</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[10px] text-text2 font-bold pb-2">日付</th>
                  <th className="text-center text-[10px] text-text2 font-bold pb-2">🥚採卵</th>
                  <th className="text-center text-[10px] text-text2 font-bold pb-2">🌾餌</th>
                  <th className="text-center text-[10px] text-text2 font-bold pb-2">📈餌/卵</th>
                  <th className="text-center text-[10px] text-text2 font-bold pb-2">💀死鶏</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const d = new Date(row.date + 'T00:00:00')
                  const dayLabel = d.toLocaleDateString('ja-JP', { day: 'numeric', weekday: 'short' })
                  const isSun = d.getDay() === 0
                  const isSat = d.getDay() === 6
                  return (
                    <tr key={row.date} className="border-b border-border/40 last:border-0">
                      <td className={`py-1.5 text-[11px] font-bold
                        ${isSun ? 'text-red' : isSat ? 'text-blue' : 'text-text2'}`}>
                        {dayLabel}
                      </td>
                      <td className="py-1.5 text-center text-[11px] font-bold text-accent">
                        {row.eggs > 0 ? row.eggs : '－'}
                      </td>
                      <td className="py-1.5 text-center text-[11px] font-bold text-green">
                        {row.feed > 0 ? row.feed : '－'}
                      </td>
                      <td className="py-1.5 text-center text-[11px] font-bold"
                          style={feedPerEggStyle(row.feedPerEgg)}>
                        {row.feedPerEgg ?? '－'}
                      </td>
                      <td className={`py-1.5 text-center text-[11px] font-bold
                        ${row.dead > 0 ? 'text-red' : 'text-text2'}`}>
                        {row.dead > 0 ? row.dead : '０'}
                      </td>
                    </tr>
                  )
                })}
                {/* 合計行 */}
                <tr className="border-t-2 border-border">
                  <td className="pt-2.5 text-[11px] font-black">合計</td>
                  <td className="pt-2.5 text-center text-[11px] font-black text-accent">
                    {totalEggs.toLocaleString()}<span className="text-[9px] ml-0.5">個</span>
                  </td>
                  <td className="pt-2.5 text-center text-[11px] font-black text-green">
                    {totalFeed}<span className="text-[9px] ml-0.5">kg</span>
                  </td>
                  <td className="pt-2.5 text-center text-[11px] font-black"
                      style={feedPerEggStyle(totalFeedPerEgg)}>
                    {totalFeedPerEgg != null ? <>{totalFeedPerEgg}<span className="text-[9px] ml-0.5">g</span></> : '－'}
                  </td>
                  <td className={`pt-2.5 text-center text-[11px] font-black ${totalDead > 0 ? 'text-red' : 'text-text2'}`}>
                    {totalDead}<span className="text-[9px] ml-0.5">羽</span>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

      </div>
    </AppShell>
  )
}
