'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Search, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ExternalLink, ChevronDown, ChevronUp, FileCode2, BookOpen,
  BarChart3, Tag, Link2, ImageIcon
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

function StatusDot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  return ok
    ? <CheckCircle2 size={13} className="text-green-500 shrink-0 mt-0.5" />
    : warn ? <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
    : <XCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
}

function Row({ ok, warn, children }: { ok: boolean; warn?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0 text-xs text-gray-700 leading-snug">
      <StatusDot ok={ok} warn={warn} />
      {children}
    </div>
  )
}

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = 28, circ = 2 * Math.PI * r
  const dash = circ - (score / 100) * circ
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
  const textColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'
  const label = score >= 80 ? 'Tốt' : score >= 60 ? 'TB' : 'Kém'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 70 70" className="-rotate-90">
        <circle cx="35" cy="35" r={r} fill="none" stroke="#f3f4f6" strokeWidth="7" />
        <circle cx="35" cy="35" r={r} fill="none" strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={dash}
          strokeLinecap="round" stroke={color} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-bold leading-none', textColor)} style={{ fontSize: size * 0.26 }}>{score}</span>
        <span className="text-gray-400 mt-0.5" style={{ fontSize: size * 0.13 }}>{label}</span>
      </div>
    </div>
  )
}

export default function SeoAuditPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AuditData | null>(null)
  const [error, setError] = useState('')
  const [kwTab, setKwTab] = useState<'uni' | 'bi' | 'tri'>('uni')
  const [expandedSchema, setExpandedSchema] = useState<number | null>(null)

  async function handleAudit() {
    const u = url.trim()
    if (!u) return
    const fullUrl = u.startsWith('http') ? u : 'https://' + u
    setLoading(true); setError(''); setData(null)
    try {
      const res = await fetch('/api/tools/seo-audit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fullUrl }),
      })
      const d = await res.json()
      if (d.error) { setError(d.error); return }
      setData(d)
    } catch (e) { setError('Lỗi: ' + String(e)) }
    finally { setLoading(false) }
  }

  return (
    <div className="p-6 md:p-8 pb-16 min-h-screen" style={{ background: '#f8f9fb' }}>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Search size={20} className="text-blue-600" />Full SEO Audit
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Meta · H1–H6 · N-gram · Schema · Nofollow · Readability</p>
      </div>

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
          <XCircle size={14} className="shrink-0" />{error}
        </div>
      )}

      {data && (
        <div className="space-y-4 max-w-6xl">

          {/* ── ROW 1: OVERVIEW CHIPS ──────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <div className="flex items-center gap-2 mb-3 text-xs text-gray-400">
              <a href={data.finalUrl} target="_blank" rel="noopener noreferrer"
                className="text-blue-500 hover:underline flex items-center gap-1 font-medium truncate">
                {data.finalUrl}<ExternalLink size={10} className="shrink-0" />
              </a>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: 'Title',
                  status: !data.title ? 'bad' : data.titleLen < 30 || data.titleLen > 65 ? 'warn' : 'ok',
                  detail: data.title ? `${data.titleLen} ký tự` : 'Thiếu',
                },
                {
                  label: 'Description',
                  status: !data.desc ? 'bad' : data.descLen < 70 || data.descLen > 160 ? 'warn' : 'ok',
                  detail: data.desc ? `${data.descLen} ký tự` : 'Thiếu',
                },
                {
                  label: 'Canonical',
                  status: !data.canonical ? 'bad' : data.canonicalOk ? 'ok' : 'warn',
                  detail: !data.canonical ? 'Thiếu' : data.canonicalOk ? 'Đúng' : 'Sai URL',
                },
                {
                  label: 'OG Image',
                  status: data.ogImage ? 'ok' : 'bad',
                  detail: data.ogImage ? 'Có' : 'Thiếu',
                },
                {
                  label: 'H1',
                  status: data.headings.filter(h => h.level === 1).length === 1 ? 'ok'
                    : data.headings.filter(h => h.level === 1).length > 1 ? 'warn' : 'bad',
                  detail: `${data.headings.filter(h => h.level === 1).length} thẻ`,
                },
                {
                  label: 'Schema',
                  status: data.schemas.length > 0 ? 'ok' : 'bad',
                  detail: data.schemas.length > 0 ? `${data.schemas.length} loại` : 'Không có',
                },
                {
                  label: 'Ảnh thiếu alt',
                  status: data.images.missingAlt === 0 ? 'ok' : 'warn',
                  detail: `${data.images.missingAlt}/${data.images.total}`,
                },
                {
                  label: 'Viewport',
                  status: data.viewport ? 'ok' : 'bad',
                  detail: data.viewport ? 'Có' : 'Thiếu',
                },
              ].map(({ label, status, detail }) => (
                <div key={label} className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium',
                  status === 'ok' ? 'bg-green-50 border-green-200 text-green-700'
                  : status === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-red-50 border-red-200 text-red-700'
                )}>
                  {status === 'ok' ? <CheckCircle2 size={12} />
                    : status === 'warn' ? <AlertTriangle size={12} />
                    : <XCircle size={12} />}
                  <span>{label}</span>
                  <span className="opacity-60 font-normal">·</span>
                  <span className="font-normal">{detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── ROW 2: META + HEADINGS ──────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4">

            {/* Meta & Tags */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <Tag size={14} className="text-blue-500" />Meta & Tags
              </p>
              <Row ok={data.titleLen >= 30 && data.titleLen <= 65} warn={data.titleLen > 0 && (data.titleLen < 30 || data.titleLen > 65)}>
                <span><strong>Title</strong> — {data.title
                  ? <>{data.title.slice(0, 60)}{data.title.length > 60 ? '…' : ''} <span className={cn('font-semibold', data.titleLen > 65 ? 'text-red-500' : data.titleLen < 30 ? 'text-amber-500' : 'text-green-600')}>({data.titleLen})</span></>
                  : 'Thiếu'}</span>
              </Row>
              <Row ok={data.descLen >= 70 && data.descLen <= 160} warn={data.descLen > 0 && (data.descLen < 70 || data.descLen > 160)}>
                <span><strong>Description</strong> — {data.desc
                  ? <>{data.desc.slice(0, 60)}{data.desc.length > 60 ? '…' : ''} <span className={cn('font-semibold', data.descLen > 160 ? 'text-red-500' : data.descLen < 70 ? 'text-amber-500' : 'text-green-600')}>({data.descLen})</span></>
                  : 'Thiếu'}</span>
              </Row>
              <Row ok={data.canonicalOk} warn={!!data.canonical && !data.canonicalOk}>
                <span><strong>Canonical</strong> — {!data.canonical ? 'Thiếu' : data.canonicalOk ? 'Đúng' : 'Trỏ sai URL'}</span>
              </Row>
              <Row ok={data.viewport}><strong>Viewport</strong> — {data.viewport ? 'Có' : 'Thiếu'}</Row>
              <Row ok={!data.metaRobots.includes('noindex')} warn={!data.metaRobots}>
                <span><strong>Robots</strong> — {data.metaRobots || 'Không khai báo (mặc định index)'}</span>
              </Row>

              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Open Graph / Social</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { k: 'og:title', v: data.ogTitle },
                    { k: 'og:description', v: data.ogDesc },
                    { k: 'og:image', v: data.ogImage },
                    { k: `og:type${data.ogType ? ` (${data.ogType})` : ''}`, v: data.ogType },
                    { k: 'twitter:card', v: data.twitterCard },
                  ].map(({ k, v }) => (
                    <span key={k} className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                      v ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'
                    )}>{v ? '✓' : '✗'} {k}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Headings */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <BookOpen size={14} className="text-indigo-500" />Headings
                </p>
                <div className="flex gap-1">
                  {[1,2,3,4,5,6].map(l => {
                    const cnt = data.headings.filter(h => h.level === l).length
                    if (!cnt) return null
                    return (
                      <span key={l} className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
                        l === 1 ? (cnt > 1 ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700')
                        : l === 2 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500')}>
                        H{l}:{cnt}
                      </span>
                    )
                  })}
                  {!data.headings.some(h => h.level === 1) && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">H1:0 ⚠</span>
                  )}
                </div>
              </div>

              {data.headings.length === 0
                ? <p className="text-xs text-gray-400 italic">Không tìm thấy heading nào</p>
                : (
                  <div className="space-y-0.5 max-h-[260px] overflow-y-auto pr-1">
                    {data.headings.map((h, i) => (
                      <div key={i} className="flex items-start gap-1.5" style={{ paddingLeft: (h.level - 1) * 12 }}>
                        {h.level > 1 && <span className="text-gray-200 mt-px select-none text-xs shrink-0">└</span>}
                        <span className={cn(
                          'shrink-0 text-[9px] font-bold px-1 py-px rounded mt-0.5',
                          h.level === 1 ? 'bg-indigo-500 text-white'
                          : h.level === 2 ? 'bg-blue-100 text-blue-700'
                          : h.level === 3 ? 'bg-gray-100 text-gray-600'
                          : 'bg-gray-50 text-gray-400')}>H{h.level}</span>
                        <span className={cn('text-xs leading-snug break-words min-w-0',
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

          {/* ── ROW 3: KEYWORDS + LINKS + IMAGES ───────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Keyword Density */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <BarChart3 size={14} className="text-orange-500" />Mật độ từ khóa
              </p>
              <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 mb-4">
                {([['uni', 'Từ đơn'], ['bi', '2 từ'], ['tri', '3 từ']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setKwTab(k)}
                    className={cn('flex-1 py-1 text-[11px] font-semibold rounded-md transition-all',
                      kwTab === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                    {l}
                  </button>
                ))}
              </div>
              {(() => {
                const rows = kwTab === 'uni' ? data.topUni : kwTab === 'bi' ? data.topBi : data.topTri
                if (!rows.length) return <p className="text-xs text-gray-400">Không đủ dữ liệu</p>
                const max = rows[0]?.count || 1
                return (
                  <div className="space-y-2.5">
                    {rows.slice(0, 10).map((r, i) => {
                      const pct = parseFloat(r.density)
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-gray-700 font-medium truncate max-w-[65%]">{r.text}</span>
                            <span className={cn('text-[11px] font-bold',
                              pct > 3 ? 'text-red-500' : pct > 1 ? 'text-green-600' : 'text-gray-400')}>
                              {r.density}% <span className="font-normal text-gray-400">({r.count}x)</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full',
                              pct > 3 ? 'bg-red-400' : pct > 1 ? 'bg-green-400' : 'bg-gray-300')}
                              style={{ width: `${(r.count / max) * 100}%` }} />
                          </div>
                        </div>
                      )
                    })}
                    <p className="text-[10px] text-gray-400 pt-1">
                      {data.wordCount.toLocaleString()} từ · xanh 1–3%: OK · đỏ &gt;3%: stuffing
                    </p>
                  </div>
                )
              })()}
            </div>

            {/* Links */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <Link2 size={14} className="text-teal-500" />Phân tích Link
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Internal', val: data.links.internal, c: 'text-blue-700 bg-blue-50 border-blue-200' },
                  { label: 'External', val: data.links.external, c: 'text-gray-700 bg-gray-50 border-gray-200' },
                  { label: 'Dofollow', val: data.links.dofollow, c: 'text-green-700 bg-green-50 border-green-200' },
                  { label: 'Nofollow', val: data.links.nofollow, c: 'text-amber-700 bg-amber-50 border-amber-200' },
                  { label: 'UGC', val: data.links.ugc, c: 'text-orange-700 bg-orange-50 border-orange-200' },
                  { label: 'Sponsored', val: data.links.sponsored, c: 'text-purple-700 bg-purple-50 border-purple-200' },
                ].map(s => (
                  <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.c)}>
                    <p className="text-2xl font-bold">{s.val}</p>
                    <p className="text-[10px] font-medium mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Images + Readability */}
            <div className="space-y-4">
              {/* Images */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                  <ImageIcon size={14} className="text-sky-500" />Hình ảnh
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-700">{data.images.total}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Tổng ảnh</p>
                  </div>
                  <div className={cn('flex-1 rounded-xl border p-3 text-center',
                    data.images.missingAlt === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                    <p className={cn('text-2xl font-bold', data.images.missingAlt === 0 ? 'text-green-700' : 'text-red-600')}>
                      {data.images.missingAlt}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Thiếu alt</p>
                  </div>
                </div>
              </div>

              {/* Readability */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                  <BookOpen size={14} className="text-pink-500" />Readability
                </p>
                <div className="flex items-center gap-4">
                  <ScoreRing score={data.fleschScore} size={64} />
                  <div className="space-y-1.5 text-xs text-gray-600 flex-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tổng từ</span>
                      <span className="font-semibold">{data.wordCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Số câu</span>
                      <span className="font-semibold">{data.sentenceCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Từ/câu TB</span>
                      <span className={cn('font-semibold', data.avgWPS > 20 ? 'text-amber-600' : 'text-green-600')}>
                        {data.avgWPS}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">{data.readLabel}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 4: SCHEMA ───────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
              <FileCode2 size={14} className="text-violet-500" />Schema JSON-LD
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                data.schemas.length > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                {data.schemas.length > 0 ? `${data.schemas.length} schema` : 'Không có'}
              </span>
            </p>
            {data.schemas.length === 0
              ? (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <XCircle size={13} />Không tìm thấy Schema JSON-LD — ảnh hưởng đến rich results trên Google
                </div>
              )
              : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {data.schemas.map((s, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                      <button onClick={() => setExpandedSchema(expandedSchema === i ? null : i)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-left">
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

        </div>
      )}
    </div>
  )
}
