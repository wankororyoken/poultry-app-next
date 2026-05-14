'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import AppShell from '@/components/AppShell'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabase'

type Metric = '採卵' | '餌' | '死鶏' | '餌/卵'
type Period = '午前' | '午後' | '合計'
type Range = 7 | 14 | 30

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 餌/卵の色
function feedPerEggStyle(g: number | null): React.CSSProperties {
  if (g == null) return { color: 'var(--color-border)' }
  if (g <= 200) return { color: 'var(--color-green)' }
  if (g <= 300) return { color: 'var(--color-accent)' }
  if (g <= 400) return { color: '#e8743b' }
  return { color: 'var(--color-red)' }
}

export default function SummaryPage() {
  const { rooms } = useApp()
  const [metric, setMetric] = useState<Metric>('採卵')
  const [period, setPeriod] = useState<Period>('合計')
  const [range, setRange] = useState<Range>(14)

  // roomId → date → {am, pm, total}
  const [eggData,  setEggData]  = useState<Record<string, Record<string, {am:number,pm:number}>>>({})
  const [feedData, setFeedData] = useState<Record<string, Record<string, {am:number,pm:number}>>>({})
  const [deadData, setDeadData] = useState<Record<string, Record<string, number>>>({})
  const [loading, setLoading] = useState(true)

  // 表示する日付一覧（新しい順）
  const today = new Date()
  const dates: string[] = []
  for (let i = 0; i < range; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    dates.push(toDateStr(d))
  }
  const fromDate = dates[dates.length - 1]
  const toDate   = dates[0]

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: eggs }, { data: feed }, { data: dead }] = await Promise.all([
      supabase.from('egg_records').select('record_date,room_id,period,count')
        .gte('record_date', fromDate).lte('record_date', toDate),
      supabase.from('feed_records').select('record_date,room_id,period,amount_kg')
        .gte('record_date', fromDate).lte('record_date', toDate),
      supabase.from('dead_records').select('record_date,room_id,count')
        .gte('record_date', fromDate).lte('record_date', toDate),
    ])

    // 採卵: roomId → date → {am, pm}
    const em: Record<string, Record<string, {am:number,pm:number}>> = {}
    eggs?.forEach((r) => {
      if (!em[r.room_id]) em[r.room_id] = {}
      if (!em[r.room_id][r.record_date]) em[r.room_id][r.record_date] = {am:0, pm:0}
      if (r.period === '午前') em[r.room_id][r.record_date].am += r.count
      else                     em[r.room_id][r.record_date].pm += r.count
    })
    setEggData(em)

    // 餌: roomId → date → {am, pm}
    const fm: Record<string, Record<string, {am:number,pm:number}>> = {}
    feed?.forEach((r) => {
      if (!fm[r.room_id]) fm[r.room_id] = {}
      if (!fm[r.room_id][r.record_date]) fm[r.room_id][r.record_date] = {am:0, pm:0}
      if (r.period === '午前') fm[r.room_id][r.record_date].am = Math.round((fm[r.room_id][r.record_date].am + r.amount_kg)*10)/10
      else                     fm[r.room_id][r.record_date].pm = Math.round((fm[r.room_id][r.record_date].pm + r.amount_kg)*10)/10
    })
    setFeedData(fm)

    // 死鶏: roomId → date → count
    const dm: Record<string, Record<string, number>> = {}
    dead?.forEach((r) => {
      if (!dm[r.room_id]) dm[r.room_id] = {}
      dm[r.room_id][r.record_date] = (dm[r.room_id][r.record_date] || 0) + r.count
    })
    setDeadData(dm)

    setLoading(false)
  }, [fromDate, toDate])

  useEffect(() => { load() }, [load])

  // セルの値を取得
  const getCellValue = (roomId: string, date: string): number | null => {
    if (metric === '採卵') {
      const d = eggData[roomId]?.[date]
      if (!d) return null
      if (period === '午前') return d.am || null
      if (period === '午後') return d.pm || null
      const t = d.am + d.pm; return t > 0 ? t : null
    }
    if (metric === '餌') {
      const d = feedData[roomId]?.[date]
      if (!d) return null
      if (period === '午前') return d.am > 0 ? d.am : null
      if (period === '午後') return d.pm > 0 ? d.pm : null
      const t = Math.round((d.am + d.pm)*10)/10; return t > 0 ? t : null
    }
    if (metric === '死鶏') {
      const v = deadData[roomId]?.[date]
      return v != null ? v : null
    }
    return null
  }

  // 餌/卵セルの値
  const getFeedPerEgg = (roomId: string, date: string): number | null => {
    const ed = eggData[roomId]?.[date]
    const fd = feedData[roomId]?.[date]
    if (!ed || !fd) return null
    const eggs = ed.am + ed.pm
    const feed = Math.round((fd.am + fd.pm)*10)/10
    return eggs > 0 && feed > 0 ? Math.round((feed * 1000) / eggs) : null
  }

  // 行合計
  const getRowTotal = (date: string): number | null => {
    if (metric === '餌/卵') {
      // 全体の合計餌 / 全体の合計採卵
      const totalEggs = rooms.reduce((s, r) => {
        const d = eggData[r.id]?.[date]; return s + (d ? d.am + d.pm : 0)
      }, 0)
      const totalFeed = rooms.reduce((s, r) => {
        const d = feedData[r.id]?.[date]; return s + (d ? Math.round((d.am + d.pm)*10)/10 : 0)
      }, 0)
      return totalEggs > 0 && totalFeed > 0 ? Math.round((totalFeed * 1000) / totalEggs) : null
    }
    const vals = rooms.map(r => getCellValue(r.id, date)).filter(v => v != null) as number[]
    if (vals.length === 0) return null
    if (metric === '餌') return Math.round(vals.reduce((a, b) => a + b, 0) * 10) / 10
    return vals.reduce((a, b) => a + b, 0)
  }

  const showPeriod = metric === '採卵' || metric === '餌'

  // 曜日スタイル
  const dayStyle = (dateStr: string) => {
    const day = new Date(dateStr + 'T00:00:00').getDay()
    if (day === 0) return 'text-red'
    if (day === 6) return 'text-blue'
    return 'text-text2'
  }

  const dateLabel = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00')
      .toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
  }

  return (
    <AppShell>
      <Header title="養鶏管理" />
      <div className="pt-[calc(52px+env(safe-area-inset-top))] px-3 py-4 space-y-3">

        {/* 指標選択 */}
        <div className="flex bg-surface2 rounded-xl p-1 border border-border">
          {(['採卵', '餌', '死鶏', '餌/卵'] as Metric[]).map((m) => (
            <button key={m} onClick={() => setMetric(m)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all
                ${metric === m ? 'bg-accent text-black' : 'text-text2'}`}
              style={{ touchAction: 'manipulation' }}>
              {m === '採卵' ? '🥚' : m === '餌' ? '🌾' : m === '死鶏' ? '💀' : '📈'} {m}
            </button>
          ))}
        </div>

        {/* 午前/午後/合計（採卵・餌のみ） */}
        {showPeriod && (
          <div className="flex bg-surface2 rounded-xl p-1 border border-border">
            {(['午前', '午後', '合計'] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all
                  ${period === p ? 'bg-surface border border-border text-text' : 'text-text2'}`}
                style={{ touchAction: 'manipulation' }}>
                {p === '午前' ? '☀️ 午前' : p === '午後' ? '🌙 午後' : '📊 合計'}
              </button>
            ))}
          </div>
        )}

        {/* 期間選択 */}
        <div className="flex gap-2">
          {([7, 14, 30] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all
                ${range === r ? 'bg-accent text-black border-accent' : 'bg-surface2 text-text2 border-border'}`}
              style={{ touchAction: 'manipulation' }}>
              直近{r}日
            </button>
          ))}
        </div>

        {/* マトリクステーブル */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          {loading ? (
            <p className="text-sm text-text2 text-center py-8">読み込み中...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
                <thead>
                  <tr className="border-b border-border bg-surface2">
                    {/* 日付列ヘッダー（固定） */}
                    <th className="sticky left-0 z-10 bg-surface2 text-left text-[10px] text-text2
                                   font-bold px-3 py-2 whitespace-nowrap border-r border-border">
                      日付
                    </th>
                    {rooms.map((room) => (
                      <th key={room.id}
                          className="text-center text-[10px] text-text2 font-bold px-2 py-2 whitespace-nowrap">
                        {room.name}
                      </th>
                    ))}
                    <th className="text-center text-[10px] text-text2 font-bold px-2 py-2 whitespace-nowrap
                                   border-l border-border">
                      合計
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map((date) => {
                    const rowTotal = getRowTotal(date)
                    const hasAnyData = rooms.some(r =>
                      metric === '餌/卵' ? getFeedPerEgg(r.id, date) != null : getCellValue(r.id, date) != null
                    )
                    return (
                      <tr key={date}
                          className={`border-b border-border/40 last:border-0
                            ${!hasAnyData ? 'opacity-35' : ''}`}>
                        {/* 日付列（固定） */}
                        <td className={`sticky left-0 z-10 bg-surface px-3 py-1.5 text-[11px]
                                       font-bold whitespace-nowrap border-r border-border ${dayStyle(date)}`}>
                          {dateLabel(date)}
                        </td>
                        {rooms.map((room) => {
                          if (metric === '餌/卵') {
                            const v = getFeedPerEgg(room.id, date)
                            return (
                              <td key={room.id}
                                  className="text-center text-[11px] font-bold px-2 py-1.5 whitespace-nowrap"
                                  style={feedPerEggStyle(v)}>
                                {v ?? '－'}
                              </td>
                            )
                          }
                          const v = getCellValue(room.id, date)
                          const color =
                            metric === '採卵' ? (v != null ? 'text-accent' : 'text-border') :
                            metric === '餌'   ? (v != null ? 'text-green'  : 'text-border') :
                            /* 死鶏 */          (v != null && v > 0 ? 'text-red' : v === 0 ? 'text-text2' : 'text-border')
                          return (
                            <td key={room.id}
                                className={`text-center text-[11px] font-bold px-2 py-1.5 whitespace-nowrap ${color}`}>
                              {v ?? '－'}
                            </td>
                          )
                        })}
                        {/* 行合計 */}
                        <td className="text-center text-[11px] font-black px-2 py-1.5 whitespace-nowrap
                                       border-l border-border"
                            style={metric === '餌/卵' ? feedPerEggStyle(rowTotal) : undefined}
                            >
                          {rowTotal != null ? (
                            <span className={
                              metric === '採卵' ? 'text-accent' :
                              metric === '餌'   ? 'text-green'  :
                              metric === '死鶏' ? (rowTotal > 0 ? 'text-red' : 'text-text2') : ''
                            }>
                              {rowTotal}
                            </span>
                          ) : '－'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-surface2">
                    <td className="sticky left-0 z-10 bg-surface2 px-3 py-2 text-[10px]
                                   font-black text-text2 whitespace-nowrap border-r border-border">
                      平均
                    </td>
                    {rooms.map((room) => {
                      let avg: number | null = null
                      if (metric === '餌/卵') {
                        const vals = dates.map(d => getFeedPerEgg(room.id, d)).filter(v => v != null) as number[]
                        avg = vals.length > 0 ? Math.round(vals.reduce((a,b) => a+b,0) / vals.length) : null
                      } else {
                        const vals = dates.map(d => getCellValue(room.id, d)).filter(v => v != null) as number[]
                        if (vals.length > 0) {
                          const sum = vals.reduce((a,b) => a+b, 0)
                          avg = metric === '餌'
                            ? Math.round(sum / vals.length * 10) / 10
                            : Math.round(sum / vals.length * 10) / 10
                        }
                      }
                      return (
                        <td key={room.id}
                            className="text-center text-[11px] font-black px-2 py-2 whitespace-nowrap"
                            style={metric === '餌/卵' ? feedPerEggStyle(avg) : undefined}>
                          <span className={
                            metric === '餌/卵' ? '' :
                            metric === '採卵'  ? (avg != null ? 'text-accent' : 'text-border') :
                            metric === '餌'    ? (avg != null ? 'text-green'  : 'text-border') :
                            avg != null && avg > 0 ? 'text-red' : avg === 0 ? 'text-text2' : 'text-border'
                          }>
                            {avg ?? '－'}
                          </span>
                        </td>
                      )
                    })}
                    {/* 合計列の平均 */}
                    {(() => {
                      let avg: number | null = null
                      if (metric === '餌/卵') {
                        // 全期間の総餌 / 総採卵
                        const totalEggs = dates.reduce((s, d) =>
                          s + rooms.reduce((rs, r) => { const ed = eggData[r.id]?.[d]; return rs + (ed ? ed.am+ed.pm : 0) }, 0), 0)
                        const totalFeed = dates.reduce((s, d) =>
                          s + rooms.reduce((rs, r) => { const fd = feedData[r.id]?.[d]; return rs + (fd ? Math.round((fd.am+fd.pm)*10)/10 : 0) }, 0), 0)
                        avg = totalEggs > 0 && totalFeed > 0 ? Math.round((totalFeed*1000)/totalEggs) : null
                      } else {
                        const vals = dates.map(d => getRowTotal(d)).filter(v => v != null) as number[]
                        if (vals.length > 0) {
                          const sum = vals.reduce((a,b) => a+b, 0)
                          avg = metric === '餌'
                            ? Math.round(sum / vals.length * 10) / 10
                            : Math.round(sum / vals.length * 10) / 10
                        }
                      }
                      return (
                        <td className="text-center text-[11px] font-black px-2 py-2 whitespace-nowrap
                                       border-l border-border"
                            style={metric === '餌/卵' ? feedPerEggStyle(avg) : undefined}>
                          <span className={
                            metric === '餌/卵' ? '' :
                            metric === '採卵'  ? (avg != null ? 'text-accent' : 'text-border') :
                            metric === '餌'    ? (avg != null ? 'text-green'  : 'text-border') :
                            avg != null && avg > 0 ? 'text-red' : avg === 0 ? 'text-text2' : 'text-border'
                          }>
                            {avg ?? '－'}
                          </span>
                        </td>
                      )
                    })()}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* 期間合計バー */}
        {!loading && (
          <div className="bg-surface rounded-2xl border border-border px-4 py-3">
            <div className="text-[10px] text-text2 font-bold mb-2">
              直近{range}日 合計
            </div>
            <div className="flex gap-4">
              {metric !== '餌/卵' && (() => {
                const total = dates.reduce((s, date) => {
                  const v = getRowTotal(date); return s + (v ?? 0)
                }, 0)
                const unit = metric === '採卵' ? '個' : metric === '餌' ? 'kg' : '羽'
                const color = metric === '採卵' ? 'text-accent' : metric === '餌' ? 'text-green'
                  : total > 0 ? 'text-red' : 'text-text2'
                return (
                  <div>
                    <span className={`text-xl font-black ${color}`}>
                      {metric === '餌'
                        ? Math.round(total * 10) / 10
                        : total}
                    </span>
                    <span className="text-xs text-text2 ml-1">{unit}</span>
                  </div>
                )
              })()}
              {metric === '餌/卵' && (() => {
                const totalEggs = dates.reduce((s, date) =>
                  s + rooms.reduce((rs, r) => {
                    const d = eggData[r.id]?.[date]; return rs + (d ? d.am + d.pm : 0)
                  }, 0), 0)
                const totalFeed = dates.reduce((s, date) =>
                  s + rooms.reduce((rs, r) => {
                    const d = feedData[r.id]?.[date]; return rs + (d ? Math.round((d.am + d.pm)*10)/10 : 0)
                  }, 0), 0)
                const avg = totalEggs > 0 && totalFeed > 0
                  ? Math.round((totalFeed * 1000) / totalEggs) : null
                return (
                  <div>
                    <span className="text-xl font-black" style={feedPerEggStyle(avg)}>
                      {avg ?? '－'}
                    </span>
                    {avg != null && <span className="text-xs text-text2 ml-1">g/卵</span>}
                  </div>
                )
              })()}
            </div>
          </div>
        )}

      </div>
    </AppShell>
  )
}
