'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import AppShell from '@/components/AppShell'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabase'

type RoomValues = Record<string, string>

export default function DeadPage() {
  const { currentDate, currentWorker, rooms } = useApp()
  const [values, setValues] = useState<RoomValues>({})
  const [monthly, setMonthly] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  const loadData = useCallback(async () => {
    if (!currentDate) return
    const { data } = await supabase
      .from('dead_records').select('room_id, count').eq('record_date', currentDate)
    const newValues: RoomValues = {}
    data?.forEach((r) => { newValues[r.room_id] = String(r.count) })
    setValues(newValues)

    // 直近30日累計
    const d30 = new Date(currentDate + 'T00:00:00')
    d30.setDate(d30.getDate() - 29)
    const { data: mData } = await supabase
      .from('dead_records').select('room_id, count')
      .gte('record_date', d30.toISOString().split('T')[0])
      .lte('record_date', currentDate)
    const m: Record<string, number> = {}
    mData?.forEach((r) => { m[r.room_id] = (m[r.room_id] || 0) + r.count })
    setMonthly(m)
  }, [currentDate])

  useEffect(() => { loadData() }, [loadData])

  const handleInput = (roomId: string, val: string) => {
    setValues(prev => ({ ...prev, [roomId]: val }))
  }

  const handleSave = async () => {
    if (!currentDate || !currentWorker) return
    setSaving(true)
    const records: any[] = []
    for (const room of rooms) {
      const v = values[room.id]
      if (v !== undefined && v !== '')
        records.push({ record_date: currentDate, room_id: room.id,
                       count: Number(v), worker_id: currentWorker.id })
    }
    if (records.length === 0) { setSaving(false); showToast('入力データがありません', false); return }
    const { error } = await supabase.from('dead_records')
      .upsert(records, { onConflict: 'record_date,room_id' })
    setSaving(false)
    if (!error) { showToast('✅ 保存しました！', true); loadData() }
    else showToast('❌ 保存失敗', false)
  }

  const total = rooms.reduce((s, r) => s + Number(values[r.id] || 0), 0)
  const monthlyTotal = rooms.reduce((s, r) => s + (monthly[r.id] || 0), 0)

  return (
    <AppShell>
      <Header title="養鶏管理" />
      <div className="pt-[calc(52px+env(safe-area-inset-top))] px-3 py-4">
        <div className="grid grid-cols-2 gap-2 mb-4">
          {rooms.map((room) => {
            return (
              <div key={room.id}
                className={`bg-surface rounded-xl border p-3 transition-all min-w-0
                  ${hasValue && Number(val) > 0 ? 'border-red/60' : 'border-border'}`}>
                <div className="text-xs font-bold text-text2 mb-1">{room.name}</div>
                {m > 0 && <div className="text-[10px] text-text2 mb-1.5">30日累計 {m}羽</div>}
                <div className="flex items-center gap-1.5 min-w-0">
                  <input type="number" inputMode="numeric" pattern="[0-9]*"
                    value={val} onChange={(e) => handleInput(room.id, e.target.value)}
                    onFocus={(e) => e.target.select()} placeholder="－"
                    className={`w-0 flex-1 bg-bg border rounded-lg px-2 py-2 text-center
                               text-base font-bold focus:outline-none focus:border-red
                               placeholder:text-border placeholder:font-normal
                               ${hasValue && Number(val) > 0 ? 'border-red/60 text-red' : 'border-border text-text'}`}
                  />
                  <span className="text-xs text-text2 flex-shrink-0">羽</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* 本日合計 */}
        <div className="bg-surface rounded-xl border border-border p-3 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-text2">本日合計</span>
            <span className={`text-xl font-black ${total > 0 ? 'text-red' : 'text-text2'}`}>
              {total}<span className="text-sm ml-1 font-bold">羽</span>
            </span>
          </div>
        </div>

        {/* 30日累計 */}
        {monthlyTotal > 0 && (
          <div className="bg-surface rounded-xl border border-border p-3 mb-4">
            <div className="text-xs font-bold text-text2 mb-2">📅 直近30日の累計</div>
            <div className="grid grid-cols-2 gap-1.5">
              {rooms.filter(r => monthly[r.id] > 0).map((room) => (
                <div key={room.id} className="flex justify-between text-xs px-2 py-1
                                              bg-surface2 rounded-lg">
                  <span className="text-text2">{room.name}</span>
                  <span className="text-red font-bold">{monthly[room.id]}羽</span>
                </div>
              ))}
            </div>
            <div className="text-right text-xs font-bold text-text2 mt-2">
              30日合計：<span className="text-red">{monthlyTotal}羽</span>
            </div>
          </div>
        )}

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
