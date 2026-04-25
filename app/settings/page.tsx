'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import AppShell from '@/components/AppShell'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabase'

type Section = 'お知らせ' | '羽数管理' | '規定量'

export default function SettingsPage() {
  const { rooms, workers, currentWorker } = useApp()
  const [section, setSection] = useState<Section>('お知らせ')

  // お知らせ
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [newText, setNewText] = useState('')
  const [saving, setSaving] = useState(false)

  // 羽数管理
  const [flockMap, setFlockMap] = useState<Record<string, { start_date: string; initial_count: string }>>({})

  // 規定量
  const [defaultMap, setDefaultMap] = useState<Record<string, string>>({})

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 2500)
  }

  const load = useCallback(async () => {
    const [{ data: ann }, { data: flock }, { data: defs }] = await Promise.all([
      supabase.from('announcements').select('*, workers(name)').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('flock_settings').select('*'),
      supabase.from('feed_defaults').select('*'),
    ])
    setAnnouncements(ann || [])

    const fm: Record<string, { start_date: string; initial_count: string }> = {}
    flock?.forEach((f) => { fm[f.room_id] = { start_date: f.start_date, initial_count: String(f.initial_count) } })
    setFlockMap(fm)

    const dm: Record<string, string> = {}
    defs?.forEach((d) => { dm[d.room_id] = String(d.default_kg) })
    setDefaultMap(dm)
  }, [])

  useEffect(() => { load() }, [load])

  // ---- お知らせ ----
  const addAnnouncement = async () => {
    if (!newText.trim() || !currentWorker) return
    setSaving(true)
    const { error } = await supabase.from('announcements').insert({
      text: newText.trim(), worker_id: currentWorker.id, is_active: true,
    })
    setSaving(false)
    if (!error) { setNewText(''); load(); showToast('✅ 追加しました', true) }
    else showToast('❌ 失敗しました', false)
  }

  const deactivateAnnouncement = async (id: string) => {
    await supabase.from('announcements').update({ is_active: false }).eq('id', id)
    load()
  }

  // ---- 羽数管理 ----
  const saveFlock = async (roomId: string) => {
    const f = flockMap[roomId]
    if (!f?.start_date || !f?.initial_count) { showToast('入雛日と初期羽数を入力してください', false); return }
    setSaving(true)
    const { error } = await supabase.from('flock_settings').upsert(
      { room_id: roomId, start_date: f.start_date, initial_count: Number(f.initial_count) },
      { onConflict: 'room_id' }
    )
    setSaving(false)
    error ? showToast('❌ 保存失敗', false) : showToast('✅ 保存しました', true)
  }

  const deleteFlock = async (roomId: string) => {
    await supabase.from('flock_settings').delete().eq('room_id', roomId)
    const next = { ...flockMap }; delete next[roomId]; setFlockMap(next)
    showToast('削除しました', true)
  }

  // ---- 規定量 ----
  const saveDefaults = async () => {
    setSaving(true)
    const records = Object.entries(defaultMap)
      .filter(([, v]) => v !== '')
      .map(([room_id, default_kg]) => ({ room_id, default_kg: Number(default_kg) }))
    if (!records.length) { setSaving(false); showToast('入力データがありません', false); return }
    const { error } = await supabase.from('feed_defaults')
      .upsert(records, { onConflict: 'room_id' })
    setSaving(false)
    error ? showToast('❌ 保存失敗', false) : showToast('✅ 保存しました', true)
  }

  return (
    <AppShell>
      <Header title="養鶏管理" />
      <div className="pt-[calc(52px+env(safe-area-inset-top))] px-3 py-4 space-y-4">

        {/* セクション選択 */}
        <div className="flex bg-surface2 rounded-xl p-1 border border-border">
          {(['お知らせ', '羽数管理', '規定量'] as Section[]).map((s) => (
            <button key={s} onClick={() => setSection(s)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all
                ${section === s ? 'bg-accent text-black' : 'text-text2'}`}>
              {s === 'お知らせ' ? '📢' : s === '羽数管理' ? '🐔' : '🌾'} {s}
            </button>
          ))}
        </div>

        {/* ===== お知らせ ===== */}
        {section === 'お知らせ' && (
          <div className="space-y-3">
            <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
              <div className="text-xs font-black text-text2">新しいお知らせ</div>
              <textarea value={newText} onChange={(e) => setNewText(e.target.value)}
                placeholder="お知らせ内容を入力..."
                rows={3}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text
                           focus:outline-none focus:border-accent placeholder:text-border resize-none" />
              <button onClick={addAnnouncement} disabled={saving || !newText.trim()}
                className="w-full py-3 rounded-xl text-sm font-black text-black disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #f5a623, #e8743b)' }}>
                ＋ 投稿する
              </button>
            </div>

            {announcements.length > 0 && (
              <div className="bg-surface rounded-2xl border border-border p-4">
                <div className="text-xs font-black text-text2 mb-3">公開中のお知らせ</div>
                <div className="space-y-2">
                  {announcements.map((a) => (
                    <div key={a.id} className="bg-surface2 rounded-xl border border-border p-3">
                      <p className="text-sm whitespace-pre-wrap mb-2">{a.text}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text2">
                          {new Date(a.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}　{a.workers?.name}
                        </span>
                        <button onClick={() => deactivateAnnouncement(a.id)}
                          className="text-[10px] text-red font-bold px-2 py-1 rounded-lg bg-red/10">
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== 羽数管理 ===== */}
        {section === '羽数管理' && (
          <div className="space-y-2">
            <p className="text-[11px] text-text2 px-1">
              入雛日と初期羽数を設定すると、ホーム画面の現在羽数と産卵率が表示されます。
            </p>
            {rooms.map((room) => {
              const f = flockMap[room.id] || { start_date: '', initial_count: '' }
              const hasData = !!flockMap[room.id]
              return (
                <div key={room.id} className="bg-surface rounded-xl border border-border p-4">
                  <div className="text-xs font-black text-text mb-3">{room.name}</div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="text-[10px] text-text2 font-bold block mb-1">入雛日</label>
                      <input type="date" value={f.start_date}
                        onChange={(e) => setFlockMap(prev => ({
                          ...prev, [room.id]: { ...f, start_date: e.target.value }
                        }))}
                        className="w-full bg-bg border border-border rounded-lg px-2 py-1.5
                                   text-xs text-text focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-[10px] text-text2 font-bold block mb-1">初期羽数</label>
                      <div className="flex items-center gap-1">
                        <input type="number" inputMode="numeric" value={f.initial_count}
                          onChange={(e) => setFlockMap(prev => ({
                            ...prev, [room.id]: { ...f, initial_count: e.target.value }
                          }))}
                          placeholder="0"
                          className="w-0 flex-1 bg-bg border border-border rounded-lg px-2 py-1.5
                                     text-xs text-text focus:outline-none focus:border-accent
                                     placeholder:text-border" />
                        <span className="text-[10px] text-text2">羽</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveFlock(room.id)} disabled={saving}
                      className="flex-1 py-2 rounded-lg text-xs font-black text-black disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, #f5a623, #e8743b)' }}>
                      保存
                    </button>
                    {hasData && (
                      <button onClick={() => deleteFlock(room.id)}
                        className="px-4 py-2 rounded-lg text-xs font-bold text-red bg-red/10">
                        削除
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ===== 規定量 ===== */}
        {section === '規定量' && (
          <div className="space-y-3">
            <p className="text-[11px] text-text2 px-1">
              餌ページの「規定量を入力」ボタンで自動入力される1回あたりの量です。
            </p>
            <div className="grid grid-cols-2 gap-2">
              {rooms.map((room) => {
                const val = defaultMap[room.id] ?? ''
                return (
                  <div key={room.id} className={`bg-surface rounded-xl border p-3 transition-all
                    ${val !== '' ? 'border-green/60' : 'border-border'}`}>
                    <div className="text-xs font-bold text-text2 mb-2">{room.name}</div>
                    <div className="flex items-center gap-1.5">
                      <input type="number" inputMode="decimal" value={val}
                        onChange={(e) => setDefaultMap(prev => ({ ...prev, [room.id]: e.target.value }))}
                        onFocus={(e) => e.target.select()} placeholder="－"
                        className={`w-0 flex-1 bg-bg border rounded-lg px-2 py-2 text-center
                                   text-sm font-bold focus:outline-none focus:border-green
                                   placeholder:text-border placeholder:font-normal
                                   ${val !== '' ? 'border-green/60 text-green' : 'border-border text-text'}`} />
                      <span className="text-xs text-text2">kg</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <button onClick={saveDefaults} disabled={saving}
              className="w-full py-4 rounded-xl text-base font-black text-black disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #f5a623, #e8743b)' }}>
              {saving ? '保存中...' : '💾 保存する'}
            </button>
          </div>
        )}

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
