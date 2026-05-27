'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Search, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ExternalLink, ChevronDown, ChevronUp, FileCode2, BookOpen,
  BarChart3, Tag, Link2, ImageIcon, Globe
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

function StatusIcon({ ok, warn }: { ok: boolean; warn?: boolean }) {
  return ok
    ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
    : warn ? <AlertTriangle size={14} className="text-amber-500 shrink-0" />
    : <XCircle size={14} className="text-red-500 shrink-0" />
}

function LengthBar({ val, min, max, label }: { val: number; min: number; max: number; label: string }) {
  const capped = Math.min(val, max + 10)
  const pct = Math.round((capped / (max + 10)) * 100)
  const ok = val >= min && val <= max
  const warn = val > 0 && !ok
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={cn('text-xs font-bold',
          ok ? 'text-green-600' : warn ? 'text-amber-600' : 'text-gray-400')}>
          {val} / {max} ký tự
          {ok && ' ✓'}{val > max && ' — quá dài'}{val > 0 && val < min && ' — quá ngắn'}
        </span>
      </div>
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        {/* Good zone marker */}
        <div className="absolute h-full bg-green-100 rounded-full"
          style={{ left: `${(min / (max + 10)) * 100}%`, width: `${((max - min) / (max + 10)) * 100}%` }} />
        {/* Value bar */}
        <div className={cn('absolute h-full rounded-full transition-all',
          ok ? 'bg-green-500' : val > max ? 'bg-red-500' : 'bg-amber-400')}
          style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[9px] text-gray-300 mt-0.5">
        <span>0</span>
        <span className="text-green-400">{min}–{max}</span>
        <span>{max + 10}</span>
      </div>
    </div>
  )
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = 30, circ = 2 * Math.PI * r
  const dash = circ - (Math.min(score, 100) / 100) * circ
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
  const textColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-500'
  const label = score >= 80 ? 'Dễ đọc' : score >= 60 ? 'Trung bình' : 'Khó đọc'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 74 74" className="-rotate-90">
        <circle cx="37" cy="37" r={r} fill="none" stroke="#f3f4f6" strokeWidth="8" />
        <circle cx="37" cy="37" r={r} fill="none" strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={dash}
          strokeLinecap="round" stroke={color} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-bold leading-none', textColor)} style={{ fontSize: size * 0.27 }}>{score}</span>
        <span className="text-[9px] text-gray-400 mt-0.5">{label}</span>
      </div>
    </div>
  )
}

const H_COLORS = ['', 'bg-indigo-500 text-white', 'bg-blue-400 text-white', 'bg-sky-300 text-white', 'bg-gray-300 text-gray-600', 'bg-gray-200 text-gray-500', 'bg-gray-100 text-gray-400']

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
        <p className="text-sm text-gray-500 mt-0.5">Meta · Heading H1–H6 · N-gram · Schema · Nofollow/UGC · Readability</p>
      </div>

      <div className="max-w-2xl mb-6 flex gap-2">
        <Input value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAudit()}
          placeholder="https://example.com/bai-viet" className="bg-white h-10" />
        <Button onClick={handleAudit} disabled={loading || !url.trim()}
          className="shrink-0 gap-2 bg-blue-600 hover:bg-blue-700 h-10 px-5">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? 'Đang audit...' : 'Audit ngay'}
        </Button>
      </div>

      {error && (
        <div className="max-w-2xl text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
          <XCircle size={14} className="shrink-0" />{error}
        </div>
      )}

      {data && (() => {
        const domain = (() => { try { return new URL(data.finalUrl).hostname } catch { return data.finalUrl } })()
        const h1Count = data.headings.filter(h => h.level === 1).length
        const hCounts = [1,2,3,4,5,6].map(l => ({ l, c: data.headings.filter(h => h.level === l).length }))
        const hMax = Math.max(...hCounts.map(h => h.c), 1)
        const totalLinks = data.links.internal + data.links.external
        const kwRows = kwTab === 'uni' ? data.topUni : kwTab === 'bi' ? data.topBi : data.topTri
        const kwMax = kwRows[0]?.count || 1

        // Count issues
        const issues = [
          data.titleLen < 30 || data.titleLen > 65 || !data.title,
          data.descLen < 70 || data.descLen > 160 || !data.desc,
          !data.canonical || !data.canonicalOk,
          !data.viewport,
          !data.ogImage,
          h1Count !== 1,
          data.schemas.length === 0,
          data.images.missingAlt > 0,
        ].filter(Boolean).length

        return (
          <div className="space-y-5 max-w-6xl">

            {/* ── HEADER SUMMARY ──────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe size={14} className="text-gray-400 shrink-0" />
                  <a href={data.finalUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate font-medium">
                    {data.finalUrl}<ExternalLink size={10} className="shrink-0 ml-0.5" />
                  </a>
                </div>
                <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold',
                  issues === 0 ? 'bg-green-100 text-green-700'
                  : issues <= 3 ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700')}>
                  {issues === 0 ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  {issues === 0 ? 'Không có vấn đề' : `${issues} vấn đề cần sửa`}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-gray-100">
                {[
                  { label: 'Title', ok: data.titleLen >= 30 && data.titleLen <= 65 && !!data.title, val: data.title ? `${data.titleLen}c` : 'Thiếu' },
                  { label: 'Description', ok: data.descLen >= 70 && data.descLen <= 160 && !!data.desc, val: data.desc ? `${data.descLen}c` : 'Thiếu' },
                  { label: 'Canonical', ok: data.canonicalOk, val: data.canonical ? (data.canonicalOk ? 'Đúng' : 'Sai') : 'Thiếu' },
                  { label: 'Viewport', ok: data.viewport, val: data.viewport ? 'Có' : 'Thiếu' },
                  { label: 'OG Image', ok: !!data.ogImage, val: data.ogImage ? 'Có' : 'Thiếu' },
                  { label: 'H1', ok: h1Count === 1, warn: h1Count > 1, val: `${h1Count} thẻ` },
                  { label: 'Schema', ok: data.schemas.length > 0, val: data.schemas.length > 0 ? `${data.schemas.length}` : 'Không' },
                  { label: 'Alt thiếu', ok: data.images.missingAlt === 0, val: `${data.images.missingAlt}/${data.images.total}` },
                ].map(({ label, ok, warn, val }) => (
                  <div key={label} className={cn('px-3 py-3 text-center',
                    ok ? 'bg-white' : warn ? 'bg-amber-50' : 'bg-red-50')}>
                    <div className="flex justify-center mb-1">
                      <StatusIcon ok={ok} warn={warn} />
                    </div>
                    <p className={cn('text-sm font-bold',
                      ok ? 'text-gray-800' : warn ? 'text-amber-700' : 'text-red-600')}>{val}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── ROW: SERP PREVIEW + META ─────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-5">

              {/* SERP Preview */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  Xem trước trên Google
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-4 h-4 rounded-full bg-gray-300 shrink-0" />
                    <span className="text-xs text-gray-500 truncate">{domain} › ...</span>
                  </div>
                  <p className="text-blue-700 font-medium leading-snug text-[15px] mb-1 line-clamp-2">
                    {data.title
                      ? (data.titleLen > 65 ? data.title.slice(0, 65) + '…' : data.title)
                      : <span className="italic text-gray-400">Không có title</span>}
                  </p>
                  <p className="text-sm text-gray-600 leading-snug line-clamp-2">
                    {data.desc
                      ? (data.descLen > 160 ? data.desc.slice(0, 160) + '…' : data.desc)
                      : <span className="italic text-gray-400">Không có meta description</span>}
                  </p>
                </div>
                <div className="space-y-3">
                  <LengthBar val={data.titleLen} min={30} max={65} label="Title tag" />
                  <LengthBar val={data.descLen} min={70} max={160} label="Meta description" />
                </div>
              </div>

              {/* Meta details */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  <Tag size={11} className="inline mr-1" />Chi tiết Meta
                </p>
                <div className="space-y-0">
                  {[
                    {
                      label: 'Title', ok: data.titleLen >= 30 && data.titleLen <= 65 && !!data.title,
                      warn: data.titleLen > 0 && (data.titleLen < 30 || data.titleLen > 65),
                      value: data.title || '—', note: !data.title ? 'Thiếu title tag' : data.titleLen < 30 ? 'Quá ngắn — cần ≥30 ký tự' : data.titleLen > 65 ? 'Quá dài — nên ≤65 ký tự' : '',
                    },
                    {
                      label: 'Description', ok: data.descLen >= 70 && data.descLen <= 160 && !!data.desc,
                      warn: data.descLen > 0 && (data.descLen < 70 || data.descLen > 160),
                      value: data.desc || '—', note: !data.desc ? 'Thiếu meta description' : data.descLen < 70 ? 'Quá ngắn — cần ≥70 ký tự' : data.descLen > 160 ? 'Quá dài — nên ≤160 ký tự' : '',
                    },
                    {
                      label: 'Canonical', ok: data.canonicalOk, warn: !!data.canonical && !data.canonicalOk,
                      value: data.canonical || '—', note: !data.canonical ? 'Thiếu canonical tag' : !data.canonicalOk ? 'Canonical trỏ sai URL' : '',
                    },
                    {
                      label: 'Viewport', ok: data.viewport, warn: false,
                      value: data.viewport ? 'Có meta viewport' : '—', note: !data.viewport ? 'Thiếu — không mobile-friendly' : '',
                    },
                    {
                      label: 'Robots', ok: !data.metaRobots.includes('noindex'), warn: !data.metaRobots,
                      value: data.metaRobots || 'Không khai báo', note: data.metaRobots.includes('noindex') ? '⚠ noindex — Google sẽ không index trang này!' : '',
                    },
                  ].map(({ label, ok, warn, value, note }) => (
                    <div key={label} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                      <StatusIcon ok={ok} warn={warn} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide w-20 shrink-0">{label}</span>
                          <span className="text-xs text-gray-700 truncate">{value}</span>
                        </div>
                        {note && <p className={cn('text-[11px] mt-0.5', ok ? 'text-gray-400' : warn ? 'text-amber-600' : 'text-red-500')}>{note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Open Graph & Social</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { k: 'og:title', v: !!data.ogTitle },
                      { k: 'og:description', v: !!data.ogDesc },
                      { k: 'og:image', v: !!data.ogImage },
                      { k: `og:type${data.ogType ? ` · ${data.ogType}` : ''}`, v: !!data.ogType },
                      { k: 'twitter:card', v: !!data.twitterCard },
                      { k: data.twitterCard ? `twitter:card · ${data.twitterCard}` : 'twitter:card', v: !!data.twitterCard },
                    ].slice(0, 5).map(({ k, v }) => (
                      <div key={k} className={cn('flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg',
                        v ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
                        {v ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                        <span className="truncate font-medium">{k}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── ROW: HEADINGS + KEYWORDS ──────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Headings */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <BookOpen size={14} className="text-indigo-500" />Cấu trúc Heading
                  </p>
                  <span className="text-xs text-gray-400">{data.headings.length} thẻ tổng</span>
                </div>

                {/* Distribution chart */}
                <div className="space-y-1.5 mb-4 pb-4 border-b border-gray-100">
                  {hCounts.filter(h => h.c > 0 || h.l <= 3).map(({ l, c }) => (
                    <div key={l} className="flex items-center gap-2">
                      <span className={cn('shrink-0 text-[10px] font-bold w-6 text-center py-0.5 rounded', H_COLORS[l])}>H{l}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all',
                          l === 1 ? 'bg-indigo-500' : l === 2 ? 'bg-blue-400' : l === 3 ? 'bg-sky-300' : 'bg-gray-300')}
                          style={{ width: `${(c / hMax) * 100}%` }} />
                      </div>
                      <span className={cn('text-xs font-bold w-6 text-right shrink-0',
                        l === 1 && c !== 1 ? 'text-red-500' : 'text-gray-600')}>{c}</span>
                      {l === 1 && c === 0 && <span className="text-[10px] text-red-500 shrink-0">⚠ Thiếu</span>}
                      {l === 1 && c > 1 && <span className="text-[10px] text-amber-500 shrink-0">⚠ Thừa</span>}
                    </div>
                  ))}
                </div>

                {/* Heading tree */}
                {data.headings.length === 0
                  ? <p className="text-xs text-gray-400 italic">Không tìm thấy heading nào</p>
                  : (
                    <div className="space-y-px max-h-[220px] overflow-y-auto pr-1">
                      {data.headings.map((h, i) => (
                        <div key={i} className="flex items-start gap-1.5 group"
                          style={{ paddingLeft: (h.level - 1) * 14 }}>
                          {h.level > 1 && <span className="text-gray-200 mt-0.5 text-xs select-none shrink-0">└</span>}
                          <span className={cn('shrink-0 text-[9px] font-bold px-1 py-px rounded mt-0.5', H_COLORS[h.level])}>
                            H{h.level}
                          </span>
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

              {/* Keyword Density */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <BarChart3 size={14} className="text-orange-500" />Mật độ từ khóa
                  </p>
                  <span className="text-xs text-gray-400">{data.wordCount.toLocaleString()} từ</span>
                </div>

                <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 mb-4">
                  {([['uni', 'Từ đơn'], ['bi', '2 từ'], ['tri', '3 từ']] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setKwTab(k)}
                      className={cn('flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all',
                        kwTab === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                      {l}
                    </button>
                  ))}
                </div>

                {kwRows.length === 0
                  ? <p className="text-xs text-gray-400">Không đủ dữ liệu</p>
                  : (
                    <div>
                      <div className="grid grid-cols-[1fr_auto_auto] text-[10px] font-semibold uppercase tracking-wide text-gray-400 pb-1.5 border-b border-gray-100 mb-2 gap-x-3">
                        <span>Từ khóa</span>
                        <span className="text-right">Lần</span>
                        <span className="text-right w-12">Mật độ</span>
                      </div>
                      <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                        {kwRows.slice(0, 12).map((r, i) => {
                          const pct = parseFloat(r.density)
                          const barColor = pct > 3 ? 'bg-red-400' : pct > 1 ? 'bg-green-400' : 'bg-gray-200'
                          const textColor = pct > 3 ? 'text-red-600' : pct > 1 ? 'text-green-600' : 'text-gray-400'
                          return (
                            <div key={i} className="group">
                              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 mb-0.5">
                                <span className="text-xs text-gray-700 font-medium truncate">{r.text}</span>
                                <span className="text-xs text-gray-400 text-right">{r.count}</span>
                                <span className={cn('text-xs font-bold text-right w-12', textColor)}>{r.density}%</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={cn('h-full rounded-full transition-all', barColor)}
                                  style={{ width: `${(r.count / kwMax) * 100}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex gap-3 mt-3 pt-2 border-t border-gray-100">
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />1–3%: OK
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />&gt;3%: Keyword stuffing
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* ── ROW: LINKS + IMAGES + READABILITY ─────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Links */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
                  <Link2 size={14} className="text-teal-500" />Phân tích Link
                </p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { label: 'Internal', val: data.links.internal, c: 'border-blue-200 bg-blue-50 text-blue-700' },
                    { label: 'External', val: data.links.external, c: 'border-gray-200 bg-gray-50 text-gray-600' },
                    { label: 'Dofollow', val: data.links.dofollow, c: 'border-green-200 bg-green-50 text-green-700' },
                    { label: 'Nofollow', val: data.links.nofollow, c: 'border-amber-200 bg-amber-50 text-amber-700' },
                    { label: 'UGC', val: data.links.ugc, c: 'border-orange-200 bg-orange-50 text-orange-700' },
                    { label: 'Sponsored', val: data.links.sponsored, c: 'border-purple-200 bg-purple-50 text-purple-700' },
                  ].map(s => (
                    <div key={s.label} className={cn('rounded-xl border px-3 py-2.5 text-center', s.c)}>
                      <p className="text-2xl font-bold">{s.val}</p>
                      <p className="text-[10px] font-medium mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                {totalLinks > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Internal / External</p>
                    <div className="h-2 rounded-full overflow-hidden flex">
                      <div className="bg-blue-400 h-full" style={{ width: `${(data.links.internal / totalLinks) * 100}%` }} />
                      <div className="bg-gray-300 h-full flex-1" />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>{Math.round((data.links.internal / totalLinks) * 100)}% nội bộ</span>
                      <span>{Math.round((data.links.external / totalLinks) * 100)}% ngoài</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Images */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
                  <ImageIcon size={14} className="text-sky-500" />Hình ảnh
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-3xl font-bold text-gray-700">{data.images.total}</p>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Tổng ảnh</p>
                      <p className="text-xs text-gray-400">trên trang</p>
                    </div>
                  </div>
                  <div className={cn('flex items-center gap-4 p-3 rounded-xl border',
                    data.images.missingAlt === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                    <p className={cn('text-3xl font-bold',
                      data.images.missingAlt === 0 ? 'text-green-600' : 'text-red-600')}>
                      {data.images.missingAlt}
                    </p>
                    <div>
                      <p className={cn('text-sm font-semibold',
                        data.images.missingAlt === 0 ? 'text-green-700' : 'text-red-700')}>
                        Thiếu alt tag
                      </p>
                      <p className="text-xs text-gray-400">
                        {data.images.missingAlt === 0 ? 'Tất cả ảnh có alt ✓' : `${data.images.total - data.images.missingAlt}/${data.images.total} ảnh có alt`}
                      </p>
                    </div>
                  </div>
                  {data.images.total > 0 && (
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Tỉ lệ có alt</span>
                        <span>{Math.round(((data.images.total - data.images.missingAlt) / data.images.total) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full',
                          data.images.missingAlt === 0 ? 'bg-green-400' : 'bg-amber-400')}
                          style={{ width: `${((data.images.total - data.images.missingAlt) / data.images.total) * 100}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Readability */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
                  <BookOpen size={14} className="text-pink-500" />Readability
                  <span className="text-[10px] text-gray-400 font-normal">Flesch (tiếng Việt)</span>
                </p>
                <div className="flex items-center gap-4 mb-4">
                  <ScoreRing score={data.fleschScore} size={76} />
                  <div>
                    <p className={cn('text-lg font-bold',
                      data.fleschScore >= 80 ? 'text-green-600' : data.fleschScore >= 60 ? 'text-amber-600' : 'text-red-500')}>
                      {data.readLabel}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Điểm càng cao → càng dễ đọc</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Tổng số từ', val: data.wordCount.toLocaleString(), ok: data.wordCount >= 300, note: data.wordCount < 300 ? 'Nội dung mỏng (<300 từ)' : '' },
                    { label: 'Số câu', val: data.sentenceCount.toLocaleString(), ok: true, note: '' },
                    { label: 'Từ / câu TB', val: `${data.avgWPS} từ`, ok: data.avgWPS <= 20, note: data.avgWPS > 25 ? 'Câu quá dài — khó đọc' : data.avgWPS > 20 ? 'Câu hơi dài' : '' },
                  ].map(({ label, val, ok, note }) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div>
                        <span className="text-xs text-gray-500">{label}</span>
                        {note && <p className="text-[10px] text-amber-600">{note}</p>}
                      </div>
                      <span className={cn('text-sm font-bold', ok ? 'text-gray-800' : 'text-amber-600')}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── SCHEMA JSON-LD ──────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <FileCode2 size={14} className="text-violet-500" />Schema JSON-LD
                </p>
                <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full',
                  data.schemas.length > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                  {data.schemas.length > 0 ? `✓ ${data.schemas.length} schema tìm thấy` : '✗ Không có schema'}
                </span>
              </div>
              {data.schemas.length === 0
                ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-red-700 mb-1">Không tìm thấy Schema JSON-LD</p>
                    <p className="text-xs text-red-600">Schema giúp Google hiểu nội dung và hiển thị rich results (rating sao, FAQ, breadcrumb...). Nên thêm ít nhất Article hoặc Organization schema.</p>
                  </div>
                )
                : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.schemas.map((s, i) => (
                      <div key={i} className="border border-gray-200 rounded-xl overflow-hidden hover:border-violet-200 transition-colors">
                        <button onClick={() => setExpandedSchema(expandedSchema === i ? null : i)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-50 transition-colors text-left">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                              <FileCode2 size={13} className="text-violet-600" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-800">{s.type}</p>
                              <p className="text-[10px] text-gray-400">
                                {Object.keys(s.raw as object).filter(k => !k.startsWith('@')).slice(0, 3).join(', ')}
                              </p>
                            </div>
                          </div>
                          {expandedSchema === i ? <ChevronUp size={13} className="text-gray-400 shrink-0" /> : <ChevronDown size={13} className="text-gray-400 shrink-0" />}
                        </button>
                        {expandedSchema === i && (
                          <pre className="text-[10px] font-mono text-gray-600 bg-gray-50 px-4 py-3 overflow-x-auto max-h-52 border-t border-gray-100 leading-relaxed">
                            {JSON.stringify(s.raw, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>

          </div>
        )
      })()}
    </div>
  )
}
