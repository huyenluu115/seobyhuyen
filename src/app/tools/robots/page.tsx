'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Shield, Loader2, CheckCircle2, XCircle, AlertTriangle, ExternalLink } from 'lucide-react'

interface RobotRule { path: string; type: 'allow' | 'disallow' }
interface RobotAgent { agent: string; rules: RobotRule[]; crawlDelay?: string }
interface ParsedRobots { agents: RobotAgent[]; sitemaps: string[]; raw: string; url: string }

function parseRobots(text: string, url: string): ParsedRobots {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  const agents: RobotAgent[] = []
  const sitemaps: string[] = []
  let current: RobotAgent | null = null

  for (const line of lines) {
    const [key, ...rest] = line.split(':')
    const val = rest.join(':').trim()
    const k = key.trim().toLowerCase()
    if (k === 'user-agent') {
      if (!current || current.rules.length > 0) { current = { agent: val, rules: [] }; agents.push(current) }
      else current.agent = val
    } else if (k === 'disallow' && current) {
      current.rules.push({ path: val || '(trống — cho phép tất cả)', type: 'disallow' })
    } else if (k === 'allow' && current) {
      current.rules.push({ path: val, type: 'allow' })
    } else if (k === 'crawl-delay' && current) {
      current.crawlDelay = val
    } else if (k === 'sitemap') {
      sitemaps.push(val)
    }
  }
  return { agents, sitemaps, raw: text, url }
}

function isDangerous(rule: RobotRule): boolean {
  if (rule.type !== 'disallow') return false
  if (rule.path === '/') return true
  if (/\.(css|js)/.test(rule.path)) return true
  return false
}

function isGooglebotAffected(agent: RobotAgent): boolean {
  return agent.agent === '*' || agent.agent.toLowerCase().includes('google')
}

export default function RobotsPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ParsedRobots | null>(null)
  const [error, setError] = useState('')
  const [showRaw, setShowRaw] = useState(false)

  async function handleCheck() {
    const u = url.trim()
    if (!u) return
    setLoading(true); setError(''); setData(null)
    try {
      const res = await fetch('/api/tools/robots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      })
      const d = await res.json()
      if (d.error) { setError(d.error); return }
      setData(parseRobots(d.text, d.url))
    } catch (e) { setError('Lỗi: ' + String(e)) }
    finally { setLoading(false) }
  }

  const googleAgents = data?.agents.filter(isGooglebotAffected) ?? []
  const dangerousRules = googleAgents.flatMap(a => a.rules.filter(isDangerous))
  const blocksAll = dangerousRules.some(r => r.path === '/')

  return (
    <div className="p-6 md:p-8 pb-16 min-h-screen" style={{ background: '#f8f9fb' }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Shield size={20} className="text-emerald-500" />Robots.txt Analyzer
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Phân tích robots.txt — kiểm tra rule block/allow, sitemap, crawl delay</p>
      </div>

      <div className="max-w-2xl mb-6 flex gap-2">
        <Input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCheck()}
          placeholder="https://example.com hoặc example.com" className="bg-white" />
        <Button onClick={handleCheck} disabled={loading || !url.trim()} className="shrink-0 gap-2 bg-emerald-600 hover:bg-emerald-700">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
          {loading ? 'Đang phân tích...' : 'Phân tích'}
        </Button>
      </div>

      {error && <p className="max-w-2xl text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">{error}</p>}

      {data && (
        <div className="max-w-3xl space-y-4">
          {/* Status banner */}
          {blocksAll ? (
            <div className="bg-red-50 border border-red-300 rounded-2xl p-4 flex items-start gap-3">
              <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700 text-sm">⚠️ Đang block TOÀN BỘ website với Googlebot!</p>
                <p className="text-xs text-red-600 mt-1">Disallow: / đang chặn Google crawl. Kiểm tra lại ngay nếu đây không phải intentional.</p>
              </div>
            </div>
          ) : dangerousRules.length > 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-700 text-sm">Phát hiện {dangerousRules.length} rule có thể ảnh hưởng SEO</p>
                <p className="text-xs text-yellow-700 mt-0.5">{dangerousRules.map(r => r.path).join(', ')}</p>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-green-500 shrink-0" />
              <p className="font-semibold text-green-700 text-sm">Không phát hiện rule nguy hiểm với Googlebot</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Agents */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Rules ({data.agents.length} user-agent)
              </p>
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {data.agents.map((agent, i) => {
                  const isGoogle = isGooglebotAffected(agent)
                  return (
                    <div key={i} className={cn('rounded-xl p-3', isGoogle ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50')}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',
                          isGoogle ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600')}>
                          User-agent: {agent.agent}
                        </span>
                        {isGoogle && <span className="text-[10px] text-blue-500 font-medium">Googlebot</span>}
                      </div>
                      {agent.rules.length === 0
                        ? <p className="text-xs text-gray-400 italic">Không có rule</p>
                        : agent.rules.map((r, j) => (
                          <div key={j} className="flex items-center gap-2 text-xs py-0.5">
                            {r.type === 'disallow'
                              ? isDangerous(r)
                                ? <XCircle size={12} className="text-red-500 shrink-0" />
                                : <XCircle size={12} className="text-gray-400 shrink-0" />
                              : <CheckCircle2 size={12} className="text-green-500 shrink-0" />}
                            <span className={cn('font-mono', r.type === 'disallow' && isDangerous(r) ? 'text-red-700 font-semibold' : 'text-gray-700')}>
                              {r.type === 'disallow' ? 'Disallow' : 'Allow'}: {r.path}
                            </span>
                          </div>
                        ))}
                      {agent.crawlDelay && <p className="text-xs text-gray-500 mt-1">Crawl-delay: {agent.crawlDelay}s</p>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Sitemaps + info */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Sitemap khai báo</p>
                {data.sitemaps.length === 0
                  ? <div className="flex items-center gap-2 text-sm text-yellow-700">
                      <AlertTriangle size={14} className="text-yellow-500" />
                      Không có Sitemap trong robots.txt
                    </div>
                  : <div className="space-y-2">
                      {data.sitemaps.map((s, i) => (
                        <a key={i} href={s} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline break-all">
                          <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                          {s} <ExternalLink size={10} className="shrink-0" />
                        </a>
                      ))}
                    </div>}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Raw content</p>
                  <button onClick={() => setShowRaw(v => !v)} className="text-xs text-blue-600 hover:underline">
                    {showRaw ? 'Ẩn' : 'Xem'}
                  </button>
                </div>
                <a href={data.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-2 break-all">
                  {data.url} <ExternalLink size={10} />
                </a>
                {showRaw && (
                  <pre className="text-xs text-gray-700 bg-gray-50 rounded-xl p-3 overflow-x-auto max-h-48 font-mono leading-relaxed whitespace-pre-wrap">
                    {data.raw}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
