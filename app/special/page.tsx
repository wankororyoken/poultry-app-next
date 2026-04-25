'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import AppShell from '@/components/AppShell'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabase'

type Tab = '破卵' | '不明卵' | 'メモ'
type Period = '午前' | '午後'

export default function SpecialPage() {
  const { currentDate, currentWorker, rooms } = useApp()
  const [tab, setTab] = useState<Tab>('破卵')

  // 破卵
  const [brokenAM, setBrokenAM] = useState('')
  const [brokenPM, setBrokenPM] = useState('')

  // 不明卵
  const [unknownRoomId, setUnknownRoomId] = useState('')
  const [unknownLocation, setUnknownLocation] = useState('')
  const [unknownDetail, setUnknownDetail] = useState('')
  const [unknownList, setUnknownList] = useState<any[]>([])

  // メモ
  const [memoRoomId, setMemoRoomId] = useState('')
  const [memoText, setMemoText] = useState('')
  const [memoList, setMemoList] = useState<any[]>([])

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  const load = useCallback(async () => {
    if (!currentDate) return
    const [{ data: broken }, { data: unknown }, { data: memos }] = await Promise.all([
      supabase.from('broken_egg_records').select('period, count').eq('record_date', currentDate),
      supabase.from('unknown_egg_records').select('*').eq('record_date', currentDate).order('created_at'),
      supabase.from('memos').select('*, rooms(name)').eq('record_date', currentDate).order('created_at'),
    ])
    setBrokenAM(String(broken?.find(r => r.period === '午前')?.count ?? ''))
    setBrokenPM(String(broken?.find(r => r.period === '午後')?.count ?? ''))
    setUnknownList(unknown || [])
    setMemoList(memos || [])
  }, [currentDate])

  useEffect(() => { load() }, [load])

  // ---- 破卵保存 ----
  const saveBroken = async () => {
    if (!currentDate || !currentWorker) return
    setSaving(true)
    const records: any[] = []
    if (brokenAM !== '') records.push({ record_date: currentDate, period: '午前', count: Number(brokenAM), worker_id: currentWorker.id })
    if (brokenPM !== '') records.push({ record_date: currentDate, period: '午後', count: Number(brokenPM), worker_id: currentWorker.id })
    if (!records.length) { setSaving(false); showToast('入力データがありません', false); return }
    const { error } = await supabase.from('broken_egg_records')
      .upsert(records, { onConflict: 'record_date,period' })
    setSaving(false)
    error ? showToast('❌ 保存失敗', false) : showToast('✅ 保存しました！', true)
  }

  // ---- 不明卵追加 ----
  const addUnknown = async () => {
    if (!currentDate || !currentWorker || !unknownLocation.trim()) return
    setSaving(true)
    const { error } = await supabase.from('unknown_egg_records').insert({
      record_date: currentDate,
      room_id: unknownRoomId || null,
      location: unknownLocation.trim(),
      location_detail: unknownDetail.trim() || null,
      worker_id: currentWorker.id,
    })
    setSaving(false)
    if (!error) {
      setUnknownLocation(''); setUnknownDetail(''); setUnknownRoomId('')
      load(); showToast('✅ 追加しました', true)
    } else showToast('❌ 追加失敗', false)
  }

  const deleteUnknown = async (id: string) => {
    await supabase.from('unknown_egg_records').delete().eq('id', id)
    load()
  }

  // ---- メモ追加 ----
  const addMemo = async () => {
    if (!currentDate || !currentWorker || !memoText.trim()) return
    setSaving(true)
    const { error } = await supabase.from('memos').insert({
      record_date: currentDate,
      room_id: memoRoomId || null,
      tab: 'special',
      text: memoText.trim(),
      worker_id: currentWorker.id,
    })
    setSaving(false)
    if (!error) {
      setMemoText(''); setMemoRoomId('')
      load(); showToast('✅ 追加しました', true)
    } else showToast('❌ 追加失敗', false)
  }

  const deleteMemo = async (id: string) => {
    await supabase.from('memos').delete().eq('id', id)
    load()
  }

  const brokenTotal = Number(brokenAM || 0) + Number(brokenPM || 0)

  return (
    <AppShell>
      <Header title="養鶏管理" />
      <div className="pt-[calc(52px+env(safe-area-inset-top))] px-3 py-4">

        {/* タブ */}
        <div className="flex bg-surface2 rounded-xl p-1 mb-4 border border-border">
          {(['破卵', '不明卵', 'メモ'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all
                ${tab === t ? 'bg-accent text-black' : 'text-text2'}`}>
              {t === '破卵' ? '🥚 破卵' : t === '不明卵' ? '❓ 不明卵' : '📝 メモ'}
            </button>
          ))}
        </div>

        {/* ===== 破卵タブ ===== */}
        {tab === '破卵' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {(['午前', '午後'] as Period[]).map((p) => {
                const val = p === '午前' ? brokenAM : brokenPM
                const set = p === '午前' ? setBrokenAM : setBrokenPM
                return (
                  <div key={p} className={`bg-surface rounded-xl border p-3 transition-all
                    ${val !== '' ? 'border-accent/60' : 'border-border'}`}>
                    <div className="text-xs font-bold text-text2 mb-2">
                      {p === '午前' ? '☀️ 午前' : '🌙 午後'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input type="number" inputMode="numeric"
                        value={val} onChange={(e) => set(e.target.value)}
                        onFocus={(e) => e.target.select()} placeholder="－"
                        className={`w-0 flex-1 bg-bg border rounded-lg px-2 py-2 text-center
                                   text-base font-bold focus:outline-none focus:border-accent
                                   placeholder:text-border placeholder:font-normal
                                   ${val !== '' ? 'border-accent/60 text-accent' : 'border-border text-text'}`} />
                      <span className="text-xs text-text2">個</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="bg-surface rounded-xl border border-border p-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-text2">本日合計</span>
                <span className="text-xl font-black text-accent">
                  {brokenTotal}<span className="text-sm ml-1 font-bold">個</span>
                </span>
              </div>
            </div>

            <button onClick={saveBroken} disabled={saving}
              className="w-full py-4 rounded-xl text-base font-black text-black disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #f5a623, #e8743b)' }}>
              {saving ? '保存中...' : '💾 保存する'}
            </button>
          </div>
        )}

        {/* ===== 不明卵タブ ===== */}
        {tab === '不明卵' && (
          <div className="space-y-3">
            <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
              <div className="text-xs font-bold text-text2">不明卵を記録</div>

              <div>
                <label className="text-[10px] text-text2 font-bold block mb-1">鶏舎（任意）</label>
                <select value={unknownRoomId} onChange={(e) => setUnknownRoomId(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none">
                  <option value="">－</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-text2 font-bold block mb-1">発見場所 *</label>
                <input type="text" value={unknownLocation} onChange={(e) => setUnknownLocation(e.target.value)}
                  placeholder="例: 通路、ケージ外"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                             focus:outline-none focus:border-accent placeholder:text-border" />
              </div>

              <div>
                <label className="text-[10px] text-text2 font-bold block mb-1">詳細（任意）</label>
                <input type="text" value={unknownDetail} onChange={(e) => setUnknownDetail(e.target.value)}
                  placeholder="例: 床に落ちていた"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                             focus:outline-none focus:border-accent placeholder:text-border" />
              </div>

              <button onClick={addUnknown} disabled={saving || !unknownLocation.trim()}
                className="w-full py-3 rounded-xl text-sm font-black text-black disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #f5a623, #e8743b)' }}>
                ＋ 追加する
              </button>
            </div>

            {unknownList.length > 0 && (
              <div className="bg-surface rounded-xl border border-border p-4">
                <div className="text-xs font-bold text-text2 mb-3">本日の不明卵 ({unknownList.length}件)</div>
                <div className="space-y-2">
                  {unknownList.map((u) => (
                    <div key={u.id} className="bg-surface2 rounded-lg p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-accent">{u.location}</span>
                        {u.room_id && (
                          <span className="text-xs text-text2 ml-2">
                            {rooms.find((r) => r.id === u.room_id)?.name}
                          </span>
                        )}
                        {u.location_detail && (
                          <div className="text-xs text-text2 mt-0.5">{u.location_detail}</div>
                        )}
                      </div>
                      <button onClick={() => deleteUnknown(u.id)}
                        className="text-text2 text-xs shrink-0 px-2 py-1 rounded-lg bg-border/40">
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== メモタブ ===== */}
        {tab === 'メモ' && (
          <div className="space-y-3">
            <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
              <div className="text-xs font-bold text-text2">メモを追加</div>

              <div>
                <label className="text-[10px] text-text2 font-bold block mb-1">鶏舎（任意）</label>
                <select value={memoRoomId} onChange={(e) => setMemoRoomId(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none">
                  <option value="">全体</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-text2 font-bold block mb-1">内容 *</label>
                <textarea value={memoText} onChange={(e) => setMemoText(e.target.value)}
                  placeholder="メモを入力..."
                  rows={3}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text
                             focus:outline-none focus:border-accent placeholder:text-border resize-none" />
              </div>

              <button onClick={addMemo} disabled={saving || !memoText.trim()}
                className="w-full py-3 rounded-xl text-sm font-black text-black disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #f5a623, #e8743b)' }}>
                ＋ 追加する
              </button>
            </div>

            {memoList.length > 0 && (
              <div className="bg-surface rounded-xl border border-border p-4">
                <div className="text-xs font-bold text-text2 mb-3">本日のメモ ({memoList.length}件)</div>
                <div className="space-y-2">
                  {memoList.map((m) => (
                    <div key={m.id} className="bg-surface2 rounded-lg p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {m.rooms?.name && (
                          <div className="text-[10px] text-accent font-bold mb-1">{m.rooms.name}</div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                      </div>
                      <button onClick={() => deleteMemo(m.id)}
                        className="text-text2 text-xs shrink-0 px-2 py-1 rounded-lg bg-border/40">
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
