'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import AppShell from '@/components/AppShell'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabase'

type DashboardData = {
  todayEggs: Record<string, number>
  todayFeed: Record<string, number>
  todayDead: Record<string, number>
  currentFlock: Record<string, number>
  announcements: { id: string; text: string; worker_name: string; created_at: string }[]
}

export default function HomePage() {
  const { currentDate, rooms } = useApp()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!currentDate) return
    setLoading(true)

    const [
      { data: eggs },
      { data: feed },
      { data: dead },
      { data: flockSettings },
      { data: announcements },
    ] = await Promise.all([
      supabase.from('egg_records').select('room_id, count').eq('record_date', currentDate),
      supabase.from('feed_records').select('room_id, amount_kg').eq('record_date', currentDate),
      supabase.from('dead_records').select('room_id, count').eq('record_date', currentDate),
      supabase.from('flock_settings').select('room_id, start_date, initial_count'),
      supabase.from('announcements')
        .select('id, text, created_at, workers(name)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const todayEggs: Record<string, number> = {}
    eggs?.forEach((r) => { todayEggs[r.room_id] = (todayEggs[r.room_id] || 0) + r.count })

    const todayFeed: Record<string, number> = {}
    feed?.forEach((r) => {
      todayFeed[r.room_id] = Math.round(((todayFeed[r.room_id] || 0) + r.amount_kg) * 10) / 10
    })

    const todayDead: Record<string, number> = {}
    dead?.forEach((r) => { todayDead[r.room_id] = (todayDead[r.room_id] || 0) + r.count })

    const currentFlock: Record<string, number> = {}
    if (flockSettings && flockSettings.length > 0) {
      const { data: deadAll } = await supabase
        .from('dead_records')
        .select('room_id, count, record_date')
        .lte('record_date', currentDate)

      flockSettings.forEach((fs) => {
        const totalDead = (deadAll || [])
          .filter((d) => d.room_id === fs.room_id && d.record_date >= fs.start_date)
          .reduce((s, d) => s + d.count, 0)
        currentFlock[fs.room_id] = fs.initial_count - totalDead
      })
    }

    setData({
      todayEggs,
      todayFeed,
      todayDead,
      currentFlock,
      announcements: (announcements || []).map((a: any) => ({
        id: a.id,
        text: a.text,
        worker_name: a.workers?.name || '',
        created_at: a.created_at,
      })),
    })
    setLoading(false)
  }, [currentDate])

  useEffect(() => { load() }, [load])

  const hasFlock = data ? Object.keys(data.currentFlock).length > 0 : false

  const totalEggs = rooms.reduce((s, r) => s + (data?.todayEggs[r.id] || 0), 0)
  const totalFeed = Math.round(rooms.reduce((s, r) => s + (data?.todayFeed[r.id] || 0), 0) * 10) / 10
  const totalDead = rooms.reduce((s, r) => s + (data?.todayDead[r.id] || 0), 0)
  const totalFlock = hasFlock ? rooms.reduce((s, r) => s + (data?.currentFlock[r.id] || 0), 0) : null

  // 指標計算
  // 卵1個あたりの餌量 (g)
  const feedPerEgg = totalEggs > 0 && totalFeed > 0
    ? Math.round((totalFeed * 1000) / totalEggs)
    : null
  // 産卵率 = 卵数 / 総羽数 × 100
  const layingRate = totalFlock && totalFlock > 0 && totalEggs > 0
    ? Math.round((totalEggs / totalFlock) * 1000) / 10
    : null

  return (
    <AppShell>
      <Header title="養鶏管理" />
      <div className="pt-[calc(52px+env(safe-area-inset-top))] px-3 py-4 space-y-4">

        {/* お知らせ */}
        {data && data.announcements.length > 0 && (
          <section className="bg-surface rounded-2xl border border-border p-4">
            <h2 className="text-xs font-black text-text2 tracking-widest uppercase mb-3">
              📢 お知らせ
            </h2>
            <div className="space-y-2">
              {data.announcements.map((a) => (
                <div key={a.id} className="bg-surface2 rounded-xl p-3 border border-border">
                  <p className="text-sm font-medium whitespace-pre-wrap">{a.text}</p>
                  <p className="text-xs text-text2 mt-1">
                    {new Date(a.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}　{a.worker_name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 今日の状況 */}
        <section className="bg-surface rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black text-text2 tracking-widest uppercase">
              📅 今日の状況
            </h2>
            <button
              onClick={load}
              className="text-xs text-text2 bg-surface2 border border-border
                         rounded-lg px-2 py-1 font-bold"
              style={{ touchAction: 'manipulation' }}
            >
              ↺ 更新
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-text2 text-center py-4">読み込み中...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-text2 font-bold pb-2">鶏舎</th>
                  <th className="text-center text-xs text-text2 font-bold pb-2">🥚採卵</th>
                  <th className="text-center text-xs text-text2 font-bold pb-2">🌾餌</th>
                  <th className="text-center text-xs text-text2 font-bold pb-2">💀死鶏</th>
                  {hasFlock && <th className="text-center text-xs text-text2 font-bold pb-2">🐔羽数</th>}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => {
                  const eggs = data?.todayEggs[room.id]
                  const fd = data?.todayFeed[room.id]
                  const dd = data?.todayDead[room.id]
                  const flock = data?.currentFlock[room.id]
                  return (
                    <tr key={room.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 text-xs font-bold text-text2">{room.name}</td>
                      <td className={`py-2 text-center text-xs font-bold ${eggs != null ? 'text-accent' : 'text-border'}`}>
                        {eggs != null ? `${eggs}個` : '－'}
                      </td>
                      <td className={`py-2 text-center text-xs font-bold ${fd != null ? 'text-green' : 'text-border'}`}>
                        {fd != null ? `${fd}kg` : '－'}
                      </td>
                      <td className={`py-2 text-center text-xs font-bold
                        ${dd != null && dd > 0 ? 'text-red' : dd === 0 ? 'text-text2' : 'text-border'}`}>
                        {dd != null ? `${dd}羽` : '－'}
                      </td>
                      {hasFlock && (
                        <td className={`py-2 text-center text-xs font-bold ${flock != null ? 'text-blue' : 'text-border'}`}>
                          {flock != null ? `${flock}羽` : '－'}
                        </td>
                      )}
                    </tr>
                  )
                })}
                {/* 合計行 */}
                <tr className="border-t-2 border-border font-black">
                  <td className="pt-2.5 text-xs">合計</td>
                  <td className="pt-2.5 text-center text-xs text-accent">{totalEggs}個</td>
                  <td className="pt-2.5 text-center text-xs text-green">{totalFeed}kg</td>
                  <td className={`pt-2.5 text-center text-xs font-black ${totalDead > 0 ? 'text-red' : 'text-text2'}`}>
                    {totalDead}羽
                  </td>
                  {hasFlock && <td className="pt-2.5 text-center text-xs text-blue">{totalFlock}羽</td>}
                </tr>
              </tbody>
            </table>
          )}
        </section>

        {/* 指標 */}
        {!loading && (feedPerEgg !== null || layingRate !== null) && (
          <section className="bg-surface rounded-2xl border border-border p-4">
            <h2 className="text-xs font-black text-text2 tracking-widest uppercase mb-3">
              📈 本日の指標
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {feedPerEgg !== null && (
                <div className="bg-surface2 rounded-xl border border-border p-3">
                  <div className="text-[10px] text-text2 font-bold mb-1">🥚 卵1個あたりの餌</div>
                  <div className="text-2xl font-black text-accent">
                    {feedPerEgg}
                    <span className="text-sm font-bold ml-1">g</span>
                  </div>
                  <div className="text-[10px] text-text2 mt-1">
                    ({totalFeed}kg ÷ {totalEggs}個)
                  </div>
                </div>
              )}
              {layingRate !== null && (
                <div className="bg-surface2 rounded-xl border border-border p-3">
                  <div className="text-[10px] text-text2 font-bold mb-1">🐔 産卵率</div>
                  <div className={`text-2xl font-black ${layingRate >= 90 ? 'text-green' : layingRate >= 75 ? 'text-accent' : 'text-red'}`}>
                    {layingRate}
                    <span className="text-sm font-bold ml-0.5">%</span>
                  </div>
                  <div className="text-[10px] text-text2 mt-1">
                    ({totalEggs}個 ÷ {totalFlock}羽)
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    </AppShell>
  )
}
