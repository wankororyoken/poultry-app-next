'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import AppShell from '@/components/AppShell'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabase'

type Period = '午前' | '午後'
type RoomValues = Record<string, string>

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function EggsPage() {
  const { currentDate, currentWorker, rooms } = useApp()
  const [period, setPeriod] = useState<Period>('午前')
  const [values, setValues] = useState<Record<Period, RoomValues>>({ '午前': {}, '午後': {} })
  const [yesterday, setYesterday] = useState<Record<Period, RoomValues>>({ '午前': {}, '午後': {} })
  // 週平均: period → roomId → count
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
    const yDateStr = toDateStr(new Date(y, m - 1, d - 1))
    const from7    = toDateStr(new Date(y, m - 1, d - 7))
    const to7      = toDateStr(new Date(y, m - 1, d - 1))

    const [{ data }, { data: yData }, { data: weekData }] = await Promise.all([
      supabase.from('egg_records').select('room_id, period, count').eq('record_date', currentDate),
      supabase.from('egg_records').select('room_id, period, count').eq('record_date', yDateStr),
      supabase.from('egg_records')
        .select('record_date, room_id, period, count')
        .gte('record_date', from7)
        .lte('record_date', to7),
    ])

    // 当日の値
    const newValues: Record<Period, RoomValues> = { '午前': {}, '午後': {} }
    data?.forEach((r) => {
      if (r.period === '午前' || r.period === '午後')
        newValues[r.period as Period][r.room_id] = String(r.count)
    })
    setValues(newValues)

    // 前日の値
    const yValues: Record<Period, RoomValues> = { '午前': {}, '午後': {} }
    yData?.forEach((r) => {
      if (r.period === '午前' || r.period === '午後')
        yValues[r.period as Period][r.room_id] = String(r.count)
    })
    setYesterday(yValues)

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
      sumMap[p][r.room_id] = (sumMap[p][r.room_id] || 0) + r.count
      cntMap[p][r.room_id]?.add(r.record_date)
    })
    const avg: Record<Period, Record<string, number>> = { '午前': {}, '午後': {} }
    for (const p of ['午前', '午後'] as Period[]) {
      rooms.forEach((r) => {
        const cnt = cntMap[p][r.id]?.size || 0
        if (cnt > 0) avg[p][r.id] = Math.round(sumMap[p][r.id] / cnt)
      })
    }
    setWeekAvg(avg)
  }, [currentDate, rooms])

  useEffect(() => { loadData() }, [loadData])

  const handleInput = (roomId: string, val: string) => {
    setValues(prev => ({ ...prev, [period]: { ...prev[period], [roomId]: val } }))
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
                         count: Number(v), worker_id: currentWorker.id })
      }
    }
    if (records.length === 0) { setSaving(false); showToast('入力データがありません', false); return }
    const { error } = await supabase.from('egg_records')
      .upsert(records, { onConflict: 'record_date,period,room_id' })
    setSaving(false)
    error ? showToast('❌ 保存失敗', false) : showToast('✅ 保存しました！', true)
  }

  const total = rooms.reduce((s, r) => s + Number(values[period][r.id] || 0), 0)
  const totalAM = rooms.reduce((s, r) => s + Number(values['午前'][r.id] || 0), 0)
  const totalPM = rooms.reduce((s, r) => s + Number(values['午後'][r.id] || 0), 0)

  return (
    <AppShell>
      <Header title="養鶏管理" />
      <div className="pt-[calc(52px+env(safe-area-inset-top))] px-3 py-4">
        <div className="flex bg-surface2 rounded-xl p-1 mb-4 border border-border">
          {(['午前', '午後'] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all
                ${period === p ? 'bg-accent text-black' : 'text-text2'}`}>
              {p === '午前' ? '☀️ 午前' : '🌙 午後'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {rooms.map((room) => {
            const yVal = yesterday[period][room.id]
            const avg  = weekAvg[period][room.id]
            const val  = values[period][room.id] ?? ''
            const hasValue = val !== ''

            // 前日 / 週平均 ヒント
            let hint: React.ReactNode = null
            if (yVal != null && avg != null) {
              hint = (
                <>
                  <span className="text-text2">前日</span>
                  <span className="text-accent font-bold mx-0.5">{yVal}</span>
                  <span className="text-text2/60 mx-0.5">/</span>
                  <span className="text-text2">週平</span>
                  <span className="text-blue font-bold ml-0.5">{avg}</span>
                  <span className="text-text2 ml-0.5">個</span>
                </>
              )
            } else if (yVal != null) {
              hint = <><span className="text-text2">前日 </span><span className="text-accent font-bold">{yVal}</span><span className="text-text2">個</span></>
            } else if (avg != null) {
              hint = <><span className="text-text2">週平 </span><span className="text-blue font-bold">{avg}</span><span className="text-text2">個</span></>
            }

            return (
              <div key={room.id}
                className={`bg-surface rounded-xl border p-3 transition-all min-w-0
                  ${hasValue ? 'border-accent/60' : 'border-border'}`}>
                <div className="text-xs font-bold text-text2 mb-1">{room.name}</div>
                {hint && (
                  <div className="text-[10px] mb-1.5 flex items-baseline flex-wrap gap-x-0.5">
                    {hint}
                  </div>
                )}
                <div className="flex items-center gap-1.5 min-w-0">
                  <input type="number" inputMode="numeric" pattern="[0-9]*"
                    value={val} onChange={(e) => handleInput(room.id, e.target.value)}
                    onFocus={(e) => e.target.select()} placeholder="－"
                    className={`w-0 flex-1 bg-bg border rounded-lg px-2 py-2 text-center
                               text-base font-bold focus:outline-none focus:border-accent
                               placeholder:text-border placeholder:font-normal
                               ${hasValue ? 'border-accent/60 text-accent' : 'border-border text-text'}`}
                  />
                  <span className="text-xs text-text2 flex-shrink-0">個</span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="bg-surface rounded-xl border border-border p-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-text2">{period}合計</span>
            <span className="text-xl font-black text-accent">{total}<span className="text-sm ml-1 font-bold">個</span></span>
          </div>
          {(totalAM > 0 || totalPM > 0) && (
            <div className="text-xs text-text2 mt-1 text-right">
              午前 {totalAM} / 午後 {totalPM} = 計 {totalAM + totalPM}個
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
