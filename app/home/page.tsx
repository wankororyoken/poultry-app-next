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

  const totalFeedPerEgg = totalEggs > 0 && totalFeed > 0
    ? Math.round((totalFeed * 1000) / totalEggs) : null
  const totalLayingRate = totalFlock && totalFlock > 0 && totalEggs > 0
    ? Math.round((totalEggs / totalFlock) * 1000) / 10 : null

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
                    {new Date(a.created_at).toLocaleDateString('ja-JP', {
                      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}　{a.worker_name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 今日の状況 — 部屋ごとカード */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-black text-text2 tracking-widest uppercase">
              📅 今日の状況
            </h2>
            <button
              onClick={load}
              className="text-xs text-text2 bg-surface2 border border-border
                         rounded-lg px-2 py-1 font-bold"
              style={{ touchAction: 'manipulation' }}
            >↺ 更新</button>
          </div>

          {loading ? (
            <div className="text-sm text-text2 text-center py-8">読み込み中...</div>
          ) : (
            <>
              {/* 部屋ごとカード 2列 */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {rooms.map((room) => {
                  const eggs = data?.todayEggs[room.id]
                  const feed = data?.todayFeed[room.id]
                  const dead = data?.todayDead[room.id]
                  const flock = data?.currentFlock[room.id]

                  const feedPerEgg = (eggs != null && eggs > 0 && feed != null && feed > 0)
                    ? Math.round((feed * 1000) / eggs) : null
                  const layingRate = (flock != null && flock > 0 && eggs != null && eggs > 0)
                    ? Math.round((eggs / flock) * 1000) / 10 : null

                  return (
                    <div key={room.id}
                      className="bg-surface rounded-xl border border-border p-3 space-y-1.5">
                      <div className="text-xs font-black text-text border-b border-border/50 pb-1.5">
                        {room.name}
                      </div>

                      {/* 採卵 */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text2">🥚 採卵</span>
                        <span className={`text-xs font-bold ${eggs != null ? 'text-accent' : 'text-border'}`}>
                          {eggs != null ? `${eggs}個` : '－'}
                        </span>
                      </div>

                      {/* 餌 */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text2">🌾 餌</span>
                        <span className={`text-xs font-bold ${feed != null ? 'text-green' : 'text-border'}`}>
                          {feed != null ? `${feed}kg` : '－'}
                        </span>
                      </div>

                      {/* 指標: 餌/卵 */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text2">📈 餌/卵</span>
                        <span className={`text-xs font-bold ${feedPerEgg != null ? 'text-blue' : 'text-border'}`}>
                          {feedPerEgg != null ? `${feedPerEgg}g` : '－'}
                        </span>
                      </div>

                      {/* 指標: 産卵率（羽数設定がある部屋のみ） */}
                      {hasFlock && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-text2">🐔 産卵率</span>
                          <span className={`text-xs font-bold ${
                            layingRate == null ? 'text-border'
                            : layingRate >= 90 ? 'text-green'
                            : layingRate >= 75 ? 'text-accent'
                            : 'text-red'
                          }`}>
                            {layingRate != null ? `${layingRate}%` : '－'}
                          </span>
                        </div>
                      )}

                      {/* 死鶏 */}
                      <div className="flex items-center justify-between border-t border-border/50 pt-1.5">
                        <span className="text-[10px] text-text2">💀 死鶏</span>
                        <span className={`text-xs font-bold ${
                          dead == null ? 'text-border'
                          : dead > 0 ? 'text-red'
                          : 'text-text2'
                        }`}>
                          {dead != null ? `${dead}羽` : '－'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 合計バー */}
              <div className="bg-surface rounded-xl border border-border px-4 py-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-text2 mb-0.5">🥚 採卵</div>
                    <div className="text-sm font-black text-accent">{totalEggs}<span className="text-[10px] ml-0.5">個</span></div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text2 mb-0.5">🌾 餌</div>
                    <div className="text-sm font-black text-green">{totalFeed}<span className="text-[10px] ml-0.5">kg</span></div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text2 mb-0.5">📈 餌/卵</div>
                    <div className={`text-sm font-black ${totalFeedPerEgg != null ? 'text-blue' : 'text-border'}`}>
                      {totalFeedPerEgg != null ? <>{totalFeedPerEgg}<span className="text-[10px] ml-0.5">g</span></> : '－'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text2 mb-0.5">💀 死鶏</div>
                    <div className={`text-sm font-black ${totalDead > 0 ? 'text-red' : 'text-text2'}`}>
                      {totalDead}<span className="text-[10px] ml-0.5">羽</span>
                    </div>
                  </div>
                </div>
                {totalLayingRate != null && (
                  <div className="mt-2 pt-2 border-t border-border/50 text-center">
                    <span className="text-[10px] text-text2">🐔 全体産卵率　</span>
                    <span className={`text-sm font-black ${
                      totalLayingRate >= 90 ? 'text-green'
                      : totalLayingRate >= 75 ? 'text-accent'
                      : 'text-red'
                    }`}>{totalLayingRate}%</span>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

      </div>
    </AppShell>
  )
}
