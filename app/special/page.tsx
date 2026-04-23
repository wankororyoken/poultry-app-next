'use client'
import AppShell from '@/components/AppShell'
import Header from '@/components/Header'

export default function Page() {
  return (
    <AppShell>
      <Header title="養鶏管理" />
      <div className="pt-[calc(52px+env(safe-area-inset-top))] px-3 py-4">
        <p className="text-text2 text-sm">準備中...</p>
      </div>
    </AppShell>
  )
}
