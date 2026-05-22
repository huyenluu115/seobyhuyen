'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, Search, TrendingUp, CheckSquare, BookOpen, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/audit', label: 'Campaign Audit', icon: BarChart2 },
  { href: '/search-terms', label: 'Search Terms', icon: Search },
  { href: '/quality-score', label: 'Quality Score', icon: TrendingUp },
  { href: '/keyword-planner', label: 'Keyword Planner', icon: BookOpen },
  { href: '/ad-writer', label: 'Ad Copy Writer', icon: Sparkles },
  { href: '/checklist', label: 'Audit Checklist', icon: CheckSquare },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen sticky top-0" style={{ background: '#1a1a2e' }}>
      <div className="px-5 py-5 border-b border-white/10">
        <span className="text-white font-bold text-base tracking-tight">Google Ads Toolkit</span>
        <p className="text-white/40 text-xs mt-0.5">Audit & Optimize</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
              )}>
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-5 py-4 border-t border-white/10 space-y-0.5">
        <p className="text-white/40 text-xs">Google Ads Toolkit v1.0</p>
        <p className="text-white/25 text-[11px]">© Lưu Thanh Huyền</p>
      </div>
    </aside>
  )
}
