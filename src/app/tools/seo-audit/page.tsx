'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Search, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ExternalLink, ChevronDown, ChevronUp, Gauge,
  FileCode2, BookOpen, BarChart3, Tag, Link2, Image
} from 'lucide-react'

interface AuditData {
  url: string; finalUrl: string
  title: string; titleLen: number
  desc: string; descLen: number
  canonical: string; canonicalOk: boolean
  viewport: boolean; metaRobots: string
  ogTitle: string; ogDesc: string; ogImage: string; ogType: string; twitterCard: string
  headings: { level: number; text: string }[]
  schemas: { type: string; raw: object }[]
  links: { internal: number; external: number; dofollow: number; nofollow: number; ugc: number; sponsored: number }
  images: { total: number; missingAlt: number }
  wordCount: number; sentenceCount: number; avgWPS: number; fleschScore: number; readLabel: string
  topUni: { text: string; count: number; density: string }[]
  topBi: { text: string; count: number; density: string }[]
  topTri: { text: string; count: number; density: string }[]
}

interface Vitals {
  ttfb: number; fcp: number; lcp: number; cls: number; tbt: number; score: number
}

const VITAL_CFG = [
  { key: 'ttfb' as const, label: 'TTFB', good: 800, poor: 1800, fmt: (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}s` : `${v}ms` },
  { key: 'fcp' as const, label: 'FCP', good: 1800, poor: 3000, fmt: (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}s` : `${v}ms` },
  { key: 'lcp' as const, label: 'LCP', good: 2500, poor: 4000, fmt: (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}s` : `${v}ms` },
  { key: 'cls' as const, label: 'CLS', good: 0.1, poor: 0.25, fmt: (v: number) => v.toFixed(3) },
  { key: 'tbt' as const, label: 'TBT', good: 200, poor: 600, fmt: (v: number) => `${v}ms` },
]

function vStatus(val: number, good: number, poor: number) {
  return val <= good ? 'good' : val <= poor ? 'warn' : 'bad'
}

function Row({ ok, warn, children }: { ok: boolean; warn?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="mt-0.5 shrink-0">
        {ok ? <CheckCircle2 size={14} className="text-green-500" />
          : warn ? <AlertTriangle size={14} className="text-amber-500" />
          : <XCircle size={14} className="text-red-500" />}
      </span>
      <span className="text-xs leading-relaxed text-gray-700">{children}</span>
    </div>
  )
}

function Pill({ label, color }: { label: string; color: 'green' | 'red' | 'amber' | 'gray' }) {
  const map = {
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return <span className={cn('inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full', map[color])}>{label}</span>
}

export default function SeoAuditPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [vitalsLoading, setVitalsLoading] = useState(false)
  const [data, setData] = useState<AuditData | null>(null)
  const [vitals, setVitals] = useState<Vitals | null>(null)
  const [vitalsError, setVitalsError] = useState('')
  const [error, setError] = useState('')
  const [kwTab, setKwTab] = useState<'uni' | 'bi' | 'tri'>('uni')
  const [expandedSchema, setExpandedSchema] = useState<number | null>(null)

  async function handleAudit() {
    const u = url.trim()
    if (!u) return
    const fullUrl = u.startsWith('http') ? u : 'https://' + u
    setLoading(true); setError(''); setData(null); setVitals(null); setVitalsError('')
    try {
      const res = await fetch('/api/tools/seo-audit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fullUrl }),
      })
      const d = await res.json()
      if (d.error) { setError(d.error); return }
      setData(d)
      fetchVitals(fullUrl)
    } catch (e) { setError('Lỗi: ' + String(e)) }
    finally { setLoading(false) }
  }

  async function fetchVitals(targetUrl: string) {
    setVitalsLoading(true); setVitalsError('')
    try {
      const res = await fetch(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&strategy=mobile&category=performance`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      const au = d.lighthouseResult?.audits
      if (!au) throw new Error('Không có dữ liệu')
      setVitals({
        ttfb: Math.round(au['server-response-time']?.numericValue || 0),
        fcp: Math.round(au['first-contentful-paint']?.numericValue || 0),
        lcp: Math.round(au['largest-contentful-paint']?.numericValue || 0),
        cls: parseFloat((au['cumulative-layout-shift']?.numericValue || 0).toFixed(3)),
        tbt: Math.round(au['total-blocking-time']?.numericValue || 0),
        score: Math.round((d.lighthouseResult?.categories?.performance?.score || 0) * 100),
      })
    } catch (e) { setVitalsError(String(e)) }
    finally { setVitalsLoading(false) }
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  const scoreRing = (s: number) =>
    s >= 90 ? { ring: 'stroke-green-500', text: 'text-green-600', label: 'Tốt' }
    : s >= 50 ? { ring: 'stroke-amber-500', text: 'text-amber-600', label: 'Trung bình' }
    : { ring: 'stroke-red-500', text: 'text-red-600', label: 'Kém' }

  const circumference = 2 * Math.PI * 30

  return (
    <div className="p-6 md:p-8 pb-16 min-h-screen" style={{ background: '#f8f9fb' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Search size={20} className="text-blue-600" />Full SEO Audit
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Kiểm tra H1–H6 · Meta · Core Web Vitals · N-gram · Schema · Nofollow · Readability
        </p>
      </div>

      {/* Search bar */}
      <div className="max-w-2xl mb-6 flex gap-2">
        <Input value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAudit()}
          placeholder="https://example.com/bai-viet" className="bg-white h-10" />
        <Button onClick={handleAudit} disabled={loading || !url.trim()}
          className="shrink-0 gap-2 bg-blue-600 hover:bg-blue-700 h-10 px-5">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? 'Đang audit...' : 'Audit'}
        </Button>
      </div>

      {error && (
        <div className="max-w-2xl text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
          <XCircle size={15} className="shrink-0" />{error}
        </div>
      )}

      {data && (
        <div className="max-w-5xl space-y-4">

          {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">URL đang audit</p>
                <a href={data.finalUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate font-medium">
                  {data.finalUrl}<ExternalLink size={11} className="shrink-0" />
                </a>
              </div>
            </div>
            {/* Quick stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Meta tags',
                  ok: [!!data.title, !!data.desc, !!data.canonical, !!data.ogImage, data.viewport].filter(Boolean).length,
                  total: 5,
                  color: 'blue',
                },
                {
                  label: 'Headings',
                  ok: data.headings.filter(h => h.level === 1).length === 1 ? 1 : 0,
                  total: 1,
                  extra: `${data.headings.length} thẻ`,
                  color: 'indigo',
                },
                {
                  label: 'Schema',
                  ok: data.schemas.length > 0 ? 1 : 0,
                  total: 1,
                  extra: data.schemas.length > 0 ? `${data.schemas.length} loại` : 'Không có',
                  color: 'violet',
                },
                {
                  label: 'Ảnh thiếu alt',
                  ok: data.images.missingAlt === 0 ? 1 : 0,
                  total: 1,
                  extra: `${data.images.total} ảnh`,
                  color: 'teal',
                },
              ].map(s => {
                const pct = Math.round((s.ok / s.total) * 100)
                const good = pct === 100
                const mid = pct >= 50
                return (
                  <div key={s.label} className={cn('rounded-xl border p-3',
                    good ? 'bg-green-50 border-green-200' : mid ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200')}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{s.label}</span>
                      {good ? <CheckCircle2 size={13} className="text-green-500" />
                        : mid ? <AlertTriangle size={13} className="text-amber-500" />
                        : <XCircle size={13} className="text-red-500" />}
                    </div>
                    <p className={cn('text-lg font-bold',
                      good ? 'text-green-700' : mid ? 'text-amber-700' : 'text-red-700')}>
                      {s.ok}/{s.total}
                    </p>
                    {s.extra && <p className="text-[10px] text-gray-500 mt-0.5">{s.extra}</p>}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* ── META & TAGS ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <Tag size={14} className="text-blue-500" />Meta & Tags
              </p>
              <Row ok={data.titleLen >= 30 && data.titleLen <= 65} warn={data.titleLen > 0 && (data.titleLen < 30 || data.titleLen > 65)}>
                <span className="font-medium">Title</span>
                {data.title ? (
                  <> — <span className={cn(data.titleLen > 65 ? 'text-red-600' : data.titleLen < 30 ? 'text-amber-600' : 'text-green-700')}>
                    {data.titleLen} ký tự
                  </span> · &ldquo;{data.title.slice(0, 55)}{data.title.length > 55 ? '…' : ''}&rdquo;</>
                ) : ' — Thiếu'}
              </Row>
              <Row ok={data.descLen >= 70 && data.descLen <= 160} warn={data.descLen > 0 && (data.descLen < 70 || data.descLen > 160)}>
                <span className="font-medium">Description</span>
                {data.desc ? (
                  <> — <span className={cn(data.descLen > 160 ? 'text-red-600' : data.descLen < 70 ? 'text-amber-600' : 'text-green-700')}>
                    {data.descLen} ký tự
                  </span>{data.descLen < 70 ? ' (cần ≥70)' : data.descLen > 160 ? ' (nên ≤160)' : ''}</>
                ) : ' — Thiếu'}
              </Row>
              <Row ok={data.canonicalOk} warn={!!data.canonical && !data.canonicalOk}>
                <span className="font-medium">Canonical</span>
                {!data.canonical ? ' — Thiếu'
                  : data.canonicalOk ? ' — Đúng'
                  : ' — Trỏ sai URL'}
              </Row>
              <Row ok={data.viewport}><span className="font-medium">Viewport</span> — {data.viewport ? 'Có' : 'Thiếu'}</Row>
              <Row ok={!data.metaRobots.includes('noindex')} warn={!data.metaRobots}>
                <span className="font-medium">Meta robots</span>
                {data.metaRobots ? ` — ${data.metaRobots}` : ' — Không khai báo (mặc định index)'}
              </Row>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Open Graph / Social</p>
                <div className="flex flex-wrap gap-1.5">
                  <Pill label={data.ogTitle ? 'og:title ✓' : 'og:title ✗'} color={data.ogTitle ? 'green' : 'red'} />
                  <Pill label={data.ogDesc ? 'og:description ✓' : 'og:description ✗'} color={data.ogDesc ? 'green' : 'red'} />
                  <Pill label={data.ogImage ? 'og:image ✓' : 'og:image ✗'} color={data.ogImage ? 'green' : 'red'} />
                  <Pill label={data.ogType ? `og:type: ${data.ogType}` : 'og:type ✗'} color={data.ogType ? 'green' : 'amber'} />
                  <Pill label={data.twitterCard ? `twitter:card ✓` : 'twitter:card ✗'} color={data.twitterCard ? 'green' : 'amber'} />
                </div>
              </div>
            </div>

            {/* ── HEADINGS ────────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <BookOpen size={14} className="text-indigo-500" />Headings
                </p>
                <div className="flex gap-1.5">
                  {[1,2,3,4,5,6].map(l => {
                    const cnt = data.headings.filter(h => h.level === l).length
                    if (!cnt) return null
                    const warn = l === 1 && cnt > 1
                    return (
                      <span key={l} className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
                        l === 1 ? warn ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                        : l === 2 ? 'bg-blue-50 text-blue-600'
                        : 'bg-gray-100 text-gray-500')}>
                        H{l}:{cnt}
                      </span>
                    )
                  })}
                  {!data.headings.some(h => h.level === 1) && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">H1:0</span>
                  )}
                </div>
              </div>
              {data.headings.length === 0
                ? <p className="text-xs text-gray-400 italic">Không tìm thấy heading nào</p>
                : (
                  <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
                    {data.headings.map((h, i) => (
                      <div key={i} className="flex items-start gap-1.5" style={{ paddingLeft: (h.level - 1) * 14 }}>
                        {h.level > 1 && (
                          <span className="text-gray-200 mt-0.5 shrink-0 select-none">└</span>
                        )}
                        <span className={cn('shrink-0 text-[9px] font-bold px-1 py-px rounded mt-0.5',
                          h.level === 1 ? 'bg-indigo-500 text-white'
                          : h.level === 2 ? 'bg-blue-100 text-blue-700'
                          : h.level === 3 ? 'bg-gray-100 text-gray-600'
                          : 'bg-gray-50 text-gray-400')}>H{h.level}</span>
                        <span className={cn('text-xs leading-snug break-all',
                          h.level === 1 ? 'text-gray-900 font-semibold'
                          : h.level === 2 ? 'text-gray-700 font-medium'
                          : 'text-gray-500')}>
                          {h.text || <em className="text-gray-300 font-normal">(trống)</em>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* ── CORE WEB VITALS ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
              <Gauge size={14} className="text-green-500" />Core Web Vitals
              <span className="text-[10px] font-normal text-gray-400">(Google PageSpeed Mobile)</span>
              {vitalsLoading && <Loader2 size={12} className="animate-spin text-gray-400" />}
            </p>
            {vitalsError && (
              <p className="text-xs text-red-400">{vitalsError}</p>
            )}
            {vitals && (() => {
              const { ring, text, label } = scoreRing(vitals.score)
              const dash = circumference - (vitals.score / 100) * circumference
              return (
                <div className="flex items-center gap-6 flex-wrap">
                  {/* Score ring */}
                  <div className="relative w-20 h-20 shrink-0">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 70 70">
                      <circle cx="35" cy="35" r="30" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                      <circle cx="35" cy="35" r="30" fill="none" strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={dash}
                        strokeLinecap="round"
                        className={cn('transition-all', ring)} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={cn('text-xl font-bold leading-none', text)}>{vitals.score}</span>
                      <span className="text-[9px] text-gray-400 mt-0.5">{label}</span>
                    </div>
                  </div>
                  {/* Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-1">
                    {VITAL_CFG.map(({ key, label, good, poor, fmt }) => {
                      const val = vitals[key] as number
                      const st = vStatus(val, good, poor)
                      return (
                        <div key={key} className={cn('rounded-xl border px-3 py-2.5 text-center',
                          st === 'good' ? 'bg-green-50 border-green-200'
                          : st === 'warn' ? 'bg-amber-50 border-amber-200'
                          : 'bg-red-50 border-red-200')}>
                          <p className={cn('text-base font-bold',
                            st === 'good' ? 'text-green-700' : st === 'warn' ? 'text-amber-700' : 'text-red-700')}>
                            {fmt(val)}
                          </p>
                          <p className="text-[10px] font-semibold text-gray-500 mt-0.5">{label}</p>
                          <p className={cn('text-[9px] mt-0.5',
                            st === 'good' ? 'text-green-600' : st === 'warn' ? 'text-amber-600' : 'text-red-600')}>
                            {st === 'good' ? 'Tốt' : st === 'warn' ? 'TB' : 'Kém'}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
            {!vitals && !vitalsLoading && !vitalsError && (
              <p className="text-xs text-gray-400 italic">Đang chờ kết quả PageSpeed...</p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* ── KEYWORD DENSITY ─────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <BarChart3 size={14} className="text-orange-500" />Mật độ từ khóa (N-gram)
              </p>
              <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
                {([['uni', 'Từ đơn'], ['bi', '2 từ'], ['tri', '3 từ']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setKwTab(k)}
                    className={cn('px-3 py-1 text-xs font-semibold rounded-md transition-all',
                      kwTab === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                    {l}
                  </button>
                ))}
              </div>
              {(() => {
                const rows = kwTab === 'uni' ? data.topUni : kwTab === 'bi' ? data.topBi : data.topTri
                if (rows.length === 0) return <p className="text-xs text-gray-400">Không đủ dữ liệu</p>
                const max = rows[0]?.count || 1
                return (
                  <div className="space-y-2">
                    {rows.slice(0, 10).map((r, i) => {
                      const pct = parseFloat(r.density)
                      const barW = Math.round((r.count / max) * 100)
                      const color = pct > 3 ? 'bg-red-400' : pct > 1 ? 'bg-green-400' : 'bg-gray-300'
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-gray-700 font-medium truncate max-w-[60%]">{r.text}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-gray-400">{r.count}x</span>
                              <span className={cn('text-[10px] font-bold w-10 text-right',
                                pct > 3 ? 'text-red-600' : pct > 1 ? 'text-green-600' : 'text-gray-500')}>
                                {r.density}%
                              </span>
                            </div>
                          </div>
                          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${barW}%` }} />
                          </div>
                        </div>
                      )
                    })}
                    <p className="text-[10px] text-gray-400 pt-1">
                      Tổng {data.wordCount.toLocaleString()} từ · Xanh 1–3%: OK · Đỏ &gt;3%: có thể keyword stuffing
                    </p>
                  </div>
                )
              })()}
            </div>

            {/* ── LINKS + IMAGES ──────────────────────────────────────────── */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                  <Link2 size={14} className="text-teal-500" />Phân tích Link
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Internal', val: data.links.internal, c: 'text-blue-700 bg-blue-50 border-blue-200' },
                    { label: 'External', val: data.links.external, c: 'text-gray-700 bg-gray-50 border-gray-200' },
                    { label: 'Dofollow', val: data.links.dofollow, c: 'text-green-700 bg-green-50 border-green-200' },
                    { label: 'Nofollow', val: data.links.nofollow, c: 'text-amber-700 bg-amber-50 border-amber-200' },
                    { label: 'UGC', val: data.links.ugc, c: 'text-orange-700 bg-orange-50 border-orange-200' },
                    { label: 'Sponsored', val: data.links.sponsored, c: 'text-purple-700 bg-purple-50 border-purple-200' },
                  ].map(s => (
                    <div key={s.label} className={cn('rounded-xl border p-2.5 text-center', s.c)}>
                      <p className="text-xl font-bold">{s.val}</p>
                      <p className="text-[10px] font-medium mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                  <Image size={14} className="text-sky-500" />Hình ảnh
                </p>
                <div className="flex gap-3">
                  <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-700">{data.images.total}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Tổng ảnh</p>
                  </div>
                  <div className={cn('flex-1 rounded-xl border p-3 text-center',
                    data.images.missingAlt === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                    <p className={cn('text-2xl font-bold', data.images.missingAlt === 0 ? 'text-green-700' : 'text-red-700')}>
                      {data.images.missingAlt}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Thiếu alt</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── SCHEMA JSON-LD ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
              <FileCode2 size={14} className="text-violet-500" />Schema JSON-LD
              {data.schemas.length > 0
                ? <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
                    {data.schemas.length} schema tìm thấy
                  </span>
                : <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">Không có</span>}
            </p>
            {data.schemas.length === 0
              ? (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <XCircle size={13} />Không tìm thấy Schema JSON-LD — ảnh hưởng đến rich results trên Google
                </div>
              )
              : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {data.schemas.map((s, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                      <button onClick={() => setExpandedSchema(expandedSchema === i ? null : i)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors text-left">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[9px] font-bold flex items-center justify-center shrink-0">✓</span>
                          <span className="text-xs font-semibold text-gray-700">{s.type}</span>
                        </div>
                        {expandedSchema === i ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
                      </button>
                      {expandedSchema === i && (
                        <pre className="text-[10px] font-mono text-gray-600 bg-gray-50 px-3 py-2.5 overflow-x-auto max-h-48 border-t border-gray-100 leading-relaxed">
                          {JSON.stringify(s.raw, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* ── READABILITY ──────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
              <BookOpen size={14} className="text-pink-500" />Readability
              <span className="text-[10px] font-normal text-gray-400">(Flesch — adapted tiếng Việt)</span>
            </p>
            <div className="flex items-center gap-6 flex-wrap">
              {/* Score ring */}
              {(() => {
                const { ring, text, label } = scoreRing(data.fleschScore)
                const dash = circumference - (data.fleschScore / 100) * circumference
                return (
                  <div className="relative w-20 h-20 shrink-0">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 70 70">
                      <circle cx="35" cy="35" r="30" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                      <circle cx="35" cy="35" r="30" fill="none" strokeWidth="8"
                        strokeDasharray={circumference} strokeDashoffset={dash}
                        strokeLinecap="round" className={cn('transition-all', ring)} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={cn('text-xl font-bold leading-none', text)}>{data.fleschScore}</span>
                      <span className="text-[9px] text-gray-400 mt-0.5">{label}</span>
                    </div>
                  </div>
                )
              })()}
              <div className="grid grid-cols-3 gap-3 flex-1">
                {[
                  { label: 'Tổng từ', val: data.wordCount.toLocaleString() },
                  { label: 'Số câu', val: data.sentenceCount.toLocaleString() },
                  { label: 'Từ/câu TB', val: data.avgWPS },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center">
                    <p className="text-xl font-bold text-gray-700">{s.val}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={cn('text-sm font-semibold',
                data.fleschScore >= 80 ? 'text-green-600' : data.fleschScore >= 60 ? 'text-amber-600' : 'text-red-600')}>
                {data.readLabel}
              </span>
              <span className="text-xs text-gray-400">· Lý tưởng: &lt;20 từ/câu · Điểm &ge;80 là dễ đọc</span>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
