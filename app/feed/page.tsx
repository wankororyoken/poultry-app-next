'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import AppShell from '@/components/AppShell'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabase'

type Period = '午前' | '午後'
type RoomValues = Record<string, string>

// yyyy-mm-dd を Date から生成（タイムゾーン安全）
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function FeedPage() {
  const { currentDate, currentWorker, rooms } = useApp()
  const [period, setPeriod] = useState<Period>('午前')
  const [values, setValues] = useState<Record<Period, RoomValues>>({ '午前': {}, '午後': {} })
  const [defaults, setDefaults] = useState<Record<string, number>>({})
  // 週平均: period → roomId → kg
  const [weekAvg, setWeekAvg] = useState<Record<Period, Record<string, number>>>({ '午前': {}, '午後': {} })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  const loadData = useCallback(async () => {
    if (!currentDate) return
    const [y, m, d] = currentDate.split('-').map(Number)

    // 過去7日（今日を除く）
    const from7 = toDateStr(new Date(y, m - 1, d - 7))
    const to7   = toDateStr(new Date(y, m - 1, d - 1))

    const [{ data }, { data: defs }, { data: weekData }] = await Promise.all([
      supabase.from('feed_records').select('room_id, period, amount_kg').eq('record_date', currentDate),
      supabase.from('feed_defaults').select('room_id, default_kg'),
      supabase.from('feed_records')
        .select('record_date, room_id, period, amount_kg')
        .gte('record_date', from7)
        .lte('record_date', to7),
    ])

    // 当日の値
    const newValues: Record<Period, RoomValues> = { '午前': {}, '午後': {} }
    data?.forEach((r) => {
      if (r.period === '午前' || r.period === '午後')
        newValues[r.period as Period][r.room_id] = String(r.amount_kg)
    })
    setValues(newValues)

    // 規定量
    const defMap: Record<string, number> = {}
    defs?.forEach((d) => { defMap[d.room_id] = d.default_kg })
    setDefaults(defMap)

    // 週平均: room+period ごとに「データがある日のみ」で平均
    const sumMap: Record<string, Record<string, number>> = { '午前': {}, '午後': {} }
    const cntMap: Record<string, Record<string, Set<string>>> = { '午前': {}, '午後': {} }
    for (const p of ['午前', '午後'] as Period[]) {
      cntMap[p] = {}
      rooms.forEach((r) => { cntMap[p][r.id] = new Set() })
    }
    weekData?.forEach((r) => {
      const p = r.period as Period
      if (p !== '午前' && p !== '午後') return
      sumMap[p][r.room_id] = (sumMap[p][r.room_id] || 0) + r.amount_kg
      cntMap[p][r.room_id]?.add(r.record_date)
    })
    const avg: Record<Period, Record<string, number>> = { '午前': {}, '午後': {} }
    for (const p of ['午前', '午後'] as Period[]) {
      rooms.forEach((r) => {
        const cnt = cntMap[p][r.id]?.size || 0
        if (cnt > 0) avg[p][r.id] = Math.round((sumMap[p][r.id] / cnt) * 10) / 10
      })
    }
    setWeekAvg(avg)
  }, [currentDate, rooms])

  useEffect(() => { loadData() }, [loadData])

  const handleInput = (roomId: string, val: string) => {
    setValues(prev => ({ ...prev, [period]: { ...prev[period], [roomId]: val } }))
  }

  const applyDefaults = () => {
    const newPeriod: RoomValues = {}
    rooms.forEach((r) => { if (defaults[r.id]) newPeriod[r.id] = String(defaults[r.id]) })
    setValues(prev => ({ ...prev, [period]: newPeriod }))
  }

  const handleSave = async () => {
    if (!currentDate || !currentWorker) return
    setSaving(true)
    const records: any[] = []
    for (const p of ['午前', '午後'] as Period[]) {
      for (const room of rooms) {
        const v = values[p][room.id]
        if (v !== undefined && v !== '')
          records.push({ record_date: currentDate, period: p, room_id: room.id,
                         amount_kg: Number(v), worker_id: currentWorker.id })
      }
    }
    if (records.length === 0) { setSaving(false); showToast('入力データがありません', false); return }
    const { error } = await supabase.from('feed_records')
      .upsert(records, { onConflict: 'record_date,period,room_id' })
    setSaving(false)
    error ? showToast('❌ 保存失敗', false) : showToast('✅ 保存しました！', true)
  }

  const total = Math.round(rooms.reduce((s, r) => s + Number(values[period][r.id] || 0), 0) * 10) / 10
  const totalAM = Math.round(rooms.reduce((s, r) => s + Number(values['午前'][r.id] || 0), 0) * 10) / 10
  const totalPM = Math.round(rooms.reduce((s, r) => s + Number(values['午後'][r.id] || 0), 0) * 10) / 10

  return (
    <AppShell>
      <Header title="養鶏管理" />
      <div className="pt-[calc(52px+env(safe-area-inset-top))] px-3 py-4">
        <div className="flex bg-surface2 rounded-xl p-1 mb-3 border border-border">
          {(['午前', '午後'] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all
                ${period === p ? 'bg-accent text-black' : 'text-text2'}`}>
              {p === '午前' ? '☀️ 午前' : '🌙 午後'}
            </button>
          ))}
        </div>
        {Object.keys(defaults).length > 0 && (
          <button onClick={applyDefaults}
            className="w-full mb-3 py-2.5 rounded-xl bg-surface2 border border-border
                       text-sm font-bold text-text2">
            📋 規定量を入力
          </button>
        )}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {rooms.map((room) => {
            const avg = weekAvg[period][room.id]
            const def = defaults[room.id]
            const val = values[period][room.id] ?? ''
            const hasValue = val !== ''

            return (
              <div key={room.id}
                className={`bg-surface rounded-xl border p-3 transition-all min-w-0
                  ${hasValue ? 'border-green/60' : 'border-border'}`}>
                <div className="text-xs font-bold text-text2 mb-1.5">{room.name}</div>
                <div className="flex items-center gap-1.5 min-w-0 mb-2">
                  <input type="number" inputMode="decimal"
                    value={val} onChange={(e) => handleInput(room.id, e.target.value)}
                    onFocus={(e) => e.target.select()} placeholder="－"
                    className={`w-0 flex-1 bg-bg border rounded-lg px-2 py-2 text-center
                               text-base font-bold focus:outline-none focus:border-green
                               placeholder:text-border placeholder:font-normal
                               ${hasValue ? 'border-green/60 text-green' : 'border-border text-text'}`}
                  />
                  <span className="text-xs text-text2 flex-shrink-0">kg</span>
                </div>
                {(avg != null || def != null) && (
                  <div className="grid gap-x-2 gap-y-0.5 text-[10px]"
                       style={{ gridTemplateColumns: 'auto auto' }}>
                    {avg != null && <>
                      <span className="text-text2">週平均</span>
                      <span className="font-bold text-green">{avg}kg</span>
                    </>}
                    {def != null && <>
                      <span className="text-text2">規定量</span>
                      <span className="font-bold text-text2">{def}kg</span>
                    </>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="bg-surface rounded-xl border border-border p-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-text2">{period}合計</span>
            <span className="text-xl font-black text-green">{total}<span className="text-sm ml-1 font-bold">kg</span></span>
          </div>
          {(totalAM > 0 || totalPM > 0) && (
            <div className="text-xs text-text2 mt-1 text-right">
              午前 {totalAM} / 午後 {totalPM} = 計 {Math.round((totalAM + totalPM) * 10) / 10}kg
            </div>
          )}
        </div>
        <button onClick={handleSave} disabled={saving}
          className="w-full py-4 rounded-xl text-base font-black text-black disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #f5a623, #e8743b)' }}>
          {saving ? '保存中...' : '💾 保存する'}
        </button>
      </div>
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full
                        text-sm font-bold shadow-lg z-50 whitespace-nowrap
                        ${toast.ok ? 'bg-green text-black' : 'bg-red text-white'}`}>
          {toast.msg}
        </div>
      )}
    </AppShell>
  )
}
