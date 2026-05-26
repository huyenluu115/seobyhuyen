'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, Search, TrendingUp, CheckSquare, BookOpen, FileSearch, Code2, ImageIcon, Eye, ShieldCheck, Share2, Shield, Map, Activity, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

const adsItems = [
  { href: '/audit', label: 'Campaign Audit', icon: BarChart2 },
  { href: '/search-terms', label: 'Search Terms', icon: Search },
  { href: '/quality-score', label: 'Quality Score', icon: TrendingUp },
  { href: '/keyword-planner', label: 'Keyword Planner', icon: BookOpen },
  { href: '/checklist', label: 'Audit Checklist', icon: CheckSquare },
]

const seoItems = [
  { href: '/seo/content', label: 'Content Optimizer', icon: FileSearch },
  { href: '/seo/schema', label: 'Schema Generator', icon: Code2 },
]

const toolItems = [
  { href: '/tools/frame-composer', label: 'Frame Composer', icon: Layers },
  { href: '/tools/social-preview', label: 'Social Preview', icon: Share2 },
  { href: '/tools/robots', label: 'Robots.txt', icon: Shield },
  { href: '/tools/sitemap', label: 'Sitemap Checker', icon: Map },
  { href: '/tools/bulk-status', label: 'Bulk URL Checker', icon: Activity },
  { href: '/tools/title-preview', label: 'Title Previewer', icon: Eye },
  { href: '/tools/canonical', label: 'Canonical Checker', icon: ShieldCheck },
  { href: '/tools/image', label: 'Image Compressor', icon: ImageIcon },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto" style={{ background: '#1a1a2e' }}>
      <div className="px-5 py-5 border-b border-white/10">
        <span className="text-white font-bold text-base tracking-tight">Ads & SEO Toolkit</span>
        <p className="text-white/40 text-xs mt-0.5">Audit & Optimize</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-4">
        <div>
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Google Ads</p>
          <div className="space-y-0.5">
            {adsItems.map(({ href, label, icon: Icon }) => {
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
          </div>
        </div>
        <div>
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">SEO Tools</p>
          <div className="space-y-0.5">
            {seoItems.map(({ href, label, icon: Icon }) => {
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
          </div>
        </div>
        <div>
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Tiện ích</p>
          <div className="space-y-0.5">
            {toolItems.map(({ href, label, icon: Icon }) => {
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
          </div>
        </div>
      </nav>
      <div className="px-5 py-4 border-t border-white/10 space-y-0.5">
        <p className="text-white/40 text-xs">Ads & SEO Toolkit v2.0</p>
        <p className="text-white/25 text-[11px]">© Lưu Thanh Huyền</p>
      </div>
    </aside>
  )
}
