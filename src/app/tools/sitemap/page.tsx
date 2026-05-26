'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Map, Loader2, ExternalLink, FileText, FolderOpen, CheckCircle2, AlertTriangle } from 'lucide-react'

interface SitemapResult {
  type: 'index' | 'urlset'
  count: number
  sitemaps?: string[]
  lastmods?: string[]
  sample?: string[]
  changefreqs?: string[]
  priorities?: string[]
  hasImages?: boolean
  hasVideo?: boolean
  hasNews?: boolean
  error?: string
}

const FREQ_ORDER = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']

export default function SitemapPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SitemapResult | null>(null)
  const [error, setError] = useState('')
  const [subUrl, setSubUrl] = useState('')
  const [subResult, setSubResult] = useState<SitemapResult | null>(null)
  const [subLoading, setSubLoading] = useState(false)

  async function fetchSitemap(sitemapUrl: string, setSub = false) {
    const setter = setSub ? setSubResult : setResult
    const loader = setSub ? setSubLoading : setLoading
    if (!setSub) { setError(''); setResult(null); setSubResult(null) }
    loader(true)
    try {
      const res = await fetch('/api/tools/sitemap', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sitemapUrl.startsWith('http') ? sitemapUrl : 'https://' + sitemapUrl }),
      })
      const d = await res.json()
      if (d.error) { if (!setSub) setError(d.error); return }
      setter(d)
    } catch (e) { if (!setSub) setError('Lỗi: ' + String(e)) }
    finally { loader(false) }
  }

  const freqStats = result?.changefreqs?.reduce<Record<string, number>>((acc, f) => {
    acc[f] = (acc[f] || 0) + 1; return acc
  }, {}) ?? {}

  const priorityAvg = result?.priorities?.length
    ? (result.priorities.reduce((s, p) => s + parseFloat(p || '0'), 0) / result.priorities.length).toFixed(2)
    : null

  return (
    <div className="p-6 md:p-8 pb-16 min-h-screen" style={{ background: '#f8f9fb' }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Map size={20} className="text-indigo-500" />Sitemap Checker
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Validate XML sitemap — đếm URL, kiểm tra format, lastmod, priority</p>
      </div>

      <div className="max-w-2xl mb-6 flex gap-2">
        <Input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchSitemap(url)}
          placeholder="https://example.com/sitemap.xml" className="bg-white" />
        <Button onClick={() => fetchSitemap(url)} disabled={loading || !url.trim()} className="shrink-0 gap-2 bg-indigo-600 hover:bg-indigo-700">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Map size={14} />}
          {loading ? 'Đang đọc...' : 'Kiểm tra'}
        </Button>
      </div>

      {error && <p className="max-w-2xl text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">{error}</p>}

      {result && (
        <div className="max-w-3xl space-y-4">
          {/* Type badge */}
          <div className="flex items-center gap-3">
            {result.type === 'index'
              ? <span className="flex items-center gap-1.5 bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-full">
                  <FolderOpen size={13} />Sitemap Index — {result.count} sitemaps con
                </span>
              : <span className="flex items-center gap-1.5 bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full">
                  <FileText size={13} />URL Set — {result.count.toLocaleString()} URLs
                </span>}
            {result.hasImages && <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">🖼 Image sitemap</span>}
            {result.hasVideo && <span className="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full">🎬 Video sitemap</span>}
            {result.hasNews && <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2.5 py-1 rounded-full">📰 News sitemap</span>}
          </div>

          {/* Sitemap index: list sub-sitemaps */}
          {result.type === 'index' && result.sitemaps && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Danh sách sitemaps con</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {result.sitemaps.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <a href={s} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 break-all min-w-0">
                      <ExternalLink size={10} className="shrink-0" />{s}
                    </a>
                    <button onClick={() => { setSubUrl(s); fetchSitemap(s, true) }}
                      className="shrink-0 text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold px-2.5 py-1 rounded-lg transition-colors">
                      Xem
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-sitemap result */}
          {subResult && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-indigo-700 mb-2">{subUrl} — {subResult.count.toLocaleString()} URLs</p>
              {subResult.sample?.slice(0, 5).map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noopener noreferrer"
                  className="block text-xs text-blue-600 hover:underline truncate">{u}</a>
              ))}
              {subLoading && <Loader2 size={14} className="animate-spin text-indigo-500 mt-2" />}
            </div>
          )}

          {/* URL stats for urlset */}
          {result.type === 'urlset' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-3xl font-bold text-indigo-600">{result.count.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Tổng URL</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Changefreq</p>
                {Object.keys(freqStats).length === 0
                  ? <p className="text-xs text-gray-400">Không có</p>
                  : FREQ_ORDER.filter(f => freqStats[f]).map(f => (
                    <div key={f} className="flex justify-between text-xs text-gray-600">
                      <span>{f}</span><span className="font-semibold">{freqStats[f]}</span>
                    </div>
                  ))}
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Priority</p>
                {priorityAvg
                  ? <>
                      <p className="text-2xl font-bold text-indigo-600">{priorityAvg}</p>
                      <p className="text-xs text-gray-500">trung bình</p>
                    </>
                  : <p className="text-xs text-gray-400">Không có</p>}
                {result.lastmods && result.lastmods.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-gray-400">Lastmod gần nhất</p>
                    <p className="text-xs text-gray-700 font-medium">{result.lastmods[0]}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sample URLs */}
          {result.type === 'urlset' && result.sample && result.sample.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Mẫu URL (hiển thị {Math.min(result.sample.length, 20)}/{result.count.toLocaleString()})
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {result.sample.map((u, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-green-400 shrink-0" />
                    <a href={u} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline truncate">{u}</a>
                  </div>
                ))}
              </div>
              {result.count > 20 && (
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                  <AlertTriangle size={11} />Còn {(result.count - 20).toLocaleString()} URL khác không hiển thị
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
