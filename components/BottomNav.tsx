'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/home',     icon: '🏠', label: 'ホーム'  },
  { href: '/eggs',     icon: '🥚', label: '採卵'    },
  { href: '/feed',     icon: '🌾', label: '餌'      },
  { href: '/dead',     icon: '💀', label: '死鶏'    },
  { href: '/special',  icon: '📋', label: '特記'    },
  { href: '/summary',  icon: '📊', label: '集計'    },
  { href: '/settings', icon: '⚙️', label: '設定'    },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border
                    flex pb-[env(safe-area-inset-bottom)]"
         style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}>
      {TABS.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{ touchAction: 'manipulation' }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2
                        text-[10px] font-bold relative transition-colors
                        ${active ? 'text-accent' : 'text-text2'}`}
          >
            {active && (
              <span className="absolute top-0 left-[20%] right-[20%] h-0.5
                               bg-accent rounded-b" />
            )}
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
