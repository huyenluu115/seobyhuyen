'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Search, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ExternalLink, ChevronDown, ChevronUp, Gauge, Link2,
  FileCode2, BookOpen, BarChart3, Tag
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

function Check({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2 text-xs py-1">
      {ok ? <CheckCircle2 size={13} className="text-green-500 mt-0.5 shrink-0" />
        : warn ? <AlertTriangle size={13} className="text-yellow-500 mt-0.5 shrink-0" />
        : <XCircle size={13} className="text-red-500 mt-0.5 shrink-0" />}
      <span className={cn('leading-snug', ok ? 'text-gray-700' : warn ? 'text-yellow-700' : 'text-red-700')}>{label}</span>
    </div>
  )
}

function SectionCard({ title, icon: Icon, children, color = 'blue' }: {
  title: string; icon: React.ElementType; children: React.ReactNode; color?: string
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-500', indigo: 'text-indigo-500', green: 'text-green-500',
    violet: 'text-violet-500', orange: 'text-orange-500', pink: 'text-pink-500',
    teal: 'text-teal-500',
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
        <Icon size={15} className={colors[color] || colors.blue} />{title}
      </p>
      {children}
    </div>
  )
}

function vitalColor(metric: string, val: number) {
  const thresholds: Record<string, [number, number]> = {
    ttfb: [800, 1800], fcp: [1800, 3000], lcp: [2500, 4000], cls: [0.1, 0.25], tbt: [200, 600]
  }
  const [good, poor] = thresholds[metric] || [0, 0]
  if (val <= good) return 'text-green-600 bg-green-50 border-green-200'
  if (val <= poor) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  return 'text-red-600 bg-red-50 border-red-200'
}

function vitalLabel(metric: string, val: number) {
  const thresholds: Record<string, [number, number]> = {
    ttfb: [800, 1800], fcp: [1800, 3000], lcp: [2500, 4000], cls: [0.1, 0.25], tbt: [200, 600]
  }
  const [good, poor] = thresholds[metric] || [0, 0]
  if (val <= good) return 'Tốt'
  if (val <= poor) return 'Cần cải thiện'
  return 'Kém'
}

function formatMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
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
      // Fetch vitals from client side (PageSpeed Insights)
      fetchVitals(fullUrl)
    } catch (e) { setError('Lỗi: ' + String(e)) }
    finally { setLoading(false) }
  }

  async function fetchVitals(targetUrl: string) {
    setVitalsLoading(true); setVitalsError('')
    try {
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&strategy=mobile&category=performance`
      const res = await fetch(apiUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      const au = d.lighthouseResult?.audits
      if (!au) throw new Error('Không có dữ liệu Lighthouse')
      setVitals({
        ttfb: Math.round(au['server-response-time']?.numericValue || 0),
        fcp: Math.round(au['first-contentful-paint']?.numericValue || 0),
        lcp: Math.round(au['largest-contentful-paint']?.numericValue || 0),
        cls: parseFloat((au['cumulative-layout-shift']?.numericValue || 0).toFixed(3)),
        tbt: Math.round(au['total-blocking-time']?.numericValue || 0),
        score: Math.round((d.lighthouseResult?.categories?.performance?.score || 0) * 100),
      })
    } catch (e) { setVitalsError('PageSpeed API lỗi: ' + String(e)) }
    finally { setVitalsLoading(false) }
  }

  const scoreColor = (s: number) => s >= 90 ? 'text-green-600' : s >= 50 ? 'text-yellow-600' : 'text-red-600'
  const scoreBg = (s: number) => s >= 90 ? 'bg-green-50 border-green-200' : s >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

  return (
    <div className="p-6 md:p-8 pb-16 min-h-screen" style={{ background: '#f8f9fb' }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Search size={20} className="text-blue-500" />Full SEO Audit
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Kiểm tra H1–H6, meta, canonical, Core Web Vitals, mật độ từ khóa n-gram, Schema JSON-LD, link nofollow/ugc, readability
        </p>
      </div>

      <div className="max-w-2xl mb-6 flex gap-2">
        <Input value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAudit()}
          placeholder="https://example.com/bai-viet" className="bg-white" />
        <Button onClick={handleAudit} disabled={loading || !url.trim()}
          className="shrink-0 gap-2 bg-blue-600 hover:bg-blue-700">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? 'Đang audit...' : 'Audit'}
        </Button>
      </div>

      {error && (
        <p className="max-w-2xl text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">{error}</p>
      )}

      {data && (
        <div className="max-w-4xl space-y-4">

          {/* ── META & TAGS ─────────────────────────────────────────────── */}
          <SectionCard title="Meta & Tags" icon={Tag} color="blue">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0.5">
              <div>
                <Check
                  ok={data.titleLen >= 30 && data.titleLen <= 65}
                  warn={data.titleLen > 0 && (data.titleLen < 30 || data.titleLen > 65)}
                  label={data.title
                    ? `Title (${data.titleLen} ký tự): "${data.title.slice(0, 50)}${data.title.length > 50 ? '…' : ''}"`
                    : 'Title — Thiếu'}
                />
                <Check
                  ok={data.descLen >= 70 && data.descLen <= 160}
                  warn={data.descLen > 0 && (data.descLen < 70 || data.descLen > 160)}
                  label={data.desc
                    ? `Description (${data.descLen} ký tự)`
                    : 'Meta description — Thiếu'}
                />
                <Check ok={data.canonicalOk} warn={!!data.canonical && !data.canonicalOk}
                  label={data.canonical
                    ? `Canonical: ${data.canonicalOk ? 'Đúng' : 'Trỏ sai URL'}`
                    : 'Canonical — Thiếu'} />
                <Check ok={data.viewport} label={data.viewport ? 'Viewport: Có' : 'Viewport — Thiếu'} />
                <Check ok={!data.metaRobots.includes('noindex')}
                  warn={data.metaRobots === ''}
                  label={data.metaRobots ? `Meta robots: ${data.metaRobots}` : 'Meta robots: Không khai báo (mặc định index)'} />
              </div>
              <div>
                <Check ok={!!data.ogTitle} label={data.ogTitle ? `og:title — Có` : 'og:title — Thiếu'} />
                <Check ok={!!data.ogDesc} label={data.ogDesc ? `og:description — Có` : 'og:description — Thiếu'} />
                <Check ok={!!data.ogImage} label={data.ogImage ? 'og:image — Có ảnh' : 'og:image — Thiếu'} />
                <Check ok={!!data.ogType} label={data.ogType ? `og:type: ${data.ogType}` : 'og:type — Thiếu'} />
                <Check ok={!!data.twitterCard}
                  warn={!data.twitterCard}
                  label={data.twitterCard ? `twitter:card — ${data.twitterCard}` : 'twitter:card — Thiếu'} />
              </div>
            </div>
            {data.canonical && (
              <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
                <span>Canonical:</span>
                <a href={data.canonical} target="_blank" rel="noopener noreferrer"
                  className="text-blue-500 hover:underline flex items-center gap-0.5 truncate">
                  {data.canonical}<ExternalLink size={10} className="shrink-0" />
                </a>
              </div>
            )}
          </SectionCard>

          {/* ── HEADINGS ────────────────────────────────────────────────── */}
          <SectionCard title={`Cấu trúc Heading (${data.headings.length} thẻ)`} icon={BookOpen} color="indigo">
            {data.headings.length === 0
              ? <p className="text-sm text-gray-400">Không tìm thấy heading nào</p>
              : (
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {data.headings.map((h, i) => {
                    const indent = (h.level - 1) * 16
                    const isH1 = h.level === 1
                    return (
                      <div key={i} className="flex items-start gap-2" style={{ paddingLeft: indent }}>
                        <span className={cn('shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5',
                          isH1 ? 'bg-indigo-100 text-indigo-700' :
                          h.level === 2 ? 'bg-blue-50 text-blue-600' :
                          'bg-gray-100 text-gray-500')}>
                          H{h.level}
                        </span>
                        <span className={cn('text-xs leading-snug', isH1 ? 'text-gray-900 font-semibold' : 'text-gray-600')}>
                          {h.text || <em className="text-gray-300">Trống</em>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-gray-100">
              {[1,2,3,4,5,6].map(l => {
                const cnt = data.headings.filter(h => h.level === l).length
                return cnt > 0 ? (
                  <span key={l} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                    H{l}: {cnt}
                  </span>
                ) : null
              })}
              {data.headings.filter(h => h.level === 1).length === 0 && (
                <span className="text-[11px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠ Thiếu H1</span>
              )}
              {data.headings.filter(h => h.level === 1).length > 1 && (
                <span className="text-[11px] bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full font-medium">
                  ⚠ {data.headings.filter(h => h.level === 1).length} H1 (nên có 1)
                </span>
              )}
            </div>
          </SectionCard>

          {/* ── CORE WEB VITALS ─────────────────────────────────────────── */}
          <SectionCard title="Core Web Vitals (Mobile)" icon={Gauge} color="green">
            {vitalsLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 size={14} className="animate-spin" />Đang lấy dữ liệu từ Google PageSpeed...
              </div>
            )}
            {vitalsError && (
              <p className="text-xs text-red-500">{vitalsError}</p>
            )}
            {vitals && (
              <div className="space-y-3">
                {/* Score */}
                <div className={cn('inline-flex items-center gap-3 px-4 py-2 rounded-xl border', scoreBg(vitals.score))}>
                  <span className={cn('text-3xl font-bold', scoreColor(vitals.score))}>{vitals.score}</span>
                  <div>
                    <p className={cn('text-sm font-semibold', scoreColor(vitals.score))}>
                      {vitals.score >= 90 ? 'Performance tốt' : vitals.score >= 50 ? 'Cần cải thiện' : 'Performance kém'}
                    </p>
                    <p className="text-xs text-gray-400">Google Lighthouse mobile</p>
                  </div>
                </div>
                {/* Metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {([
                    { key: 'ttfb', label: 'TTFB', val: vitals.ttfb, fmt: formatMs },
                    { key: 'fcp', label: 'FCP', val: vitals.fcp, fmt: formatMs },
                    { key: 'lcp', label: 'LCP', val: vitals.lcp, fmt: formatMs },
                    { key: 'cls', label: 'CLS', val: vitals.cls, fmt: (v: number) => v.toFixed(3) },
                    { key: 'tbt', label: 'TBT', val: vitals.tbt, fmt: formatMs },
                  ] as const).map(({ key, label, val, fmt }) => (
                    <div key={key} className={cn('rounded-xl border p-3 text-center', vitalColor(key, val))}>
                      <p className="text-lg font-bold">{fmt(val as number)}</p>
                      <p className="text-[10px] font-semibold mt-0.5">{label}</p>
                      <p className="text-[10px] opacity-70">{vitalLabel(key, val as number)}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400">
                  TTFB &lt;800ms · FCP &lt;1.8s · LCP &lt;2.5s · CLS &lt;0.1 · TBT &lt;200ms = Tốt
                </p>
              </div>
            )}
          </SectionCard>

          {/* ── KEYWORD DENSITY ─────────────────────────────────────────── */}
          <SectionCard title="Mật độ từ khóa (N-gram)" icon={BarChart3} color="orange">
            <div className="flex gap-1 mb-3">
              {([['uni', 'Từ đơn'], ['bi', '2 từ'], ['tri', '3 từ']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setKwTab(k)}
                  className={cn('px-3 py-1 text-xs font-semibold rounded-lg transition-colors',
                    kwTab === k ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100')}>
                  {l}
                </button>
              ))}
            </div>
            {(() => {
              const rows = kwTab === 'uni' ? data.topUni : kwTab === 'bi' ? data.topBi : data.topTri
              if (rows.length === 0) return <p className="text-xs text-gray-400">Không đủ dữ liệu</p>
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-100">
                        <th className="pb-2 font-semibold">Từ khóa</th>
                        <th className="pb-2 font-semibold text-right">Lần</th>
                        <th className="pb-2 font-semibold text-right">Mật độ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="py-1.5 font-medium text-gray-800">{r.text}</td>
                          <td className="py-1.5 text-right text-gray-500">{r.count}</td>
                          <td className="py-1.5 text-right">
                            <span className={cn('font-semibold',
                              parseFloat(r.density) > 3 ? 'text-red-600' :
                              parseFloat(r.density) > 1 ? 'text-green-600' : 'text-gray-500')}>
                              {r.density}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-gray-400 mt-2">
                    Tổng {data.wordCount.toLocaleString()} từ · Mật độ &gt;3%: có thể keyword stuffing · 1–3%: lý tưởng
                  </p>
                </div>
              )
            })()}
          </SectionCard>

          {/* ── LINKS ───────────────────────────────────────────────────── */}
          <SectionCard title="Phân tích Link" icon={Link2} color="teal">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { label: 'Internal', val: data.links.internal, color: 'bg-blue-50 text-blue-700 border-blue-200' },
                { label: 'External', val: data.links.external, color: 'bg-gray-50 text-gray-700 border-gray-200' },
                { label: 'Dofollow', val: data.links.dofollow, color: 'bg-green-50 text-green-700 border-green-200' },
                { label: 'Nofollow', val: data.links.nofollow, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                { label: 'UGC', val: data.links.ugc, color: 'bg-orange-50 text-orange-700 border-orange-200' },
                { label: 'Sponsored', val: data.links.sponsored, color: 'bg-purple-50 text-purple-700 border-purple-200' },
              ].map(s => (
                <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.color)}>
                  <p className="text-xl font-bold">{s.val}</p>
                  <p className="text-[10px] mt-0.5 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-gray-500">
              <span>🖼 {data.images.total} ảnh</span>
              {data.images.missingAlt > 0 && (
                <span className="text-red-600">⚠ {data.images.missingAlt} ảnh thiếu alt</span>
              )}
            </div>
          </SectionCard>

          {/* ── SCHEMA JSON-LD ──────────────────────────────────────────── */}
          <SectionCard title={`Schema JSON-LD (${data.schemas.length} schema)`} icon={FileCode2} color="violet">
            {data.schemas.length === 0
              ? <Check ok={false} label="Không tìm thấy Schema JSON-LD" />
              : (
                <div className="space-y-2">
                  {data.schemas.map((s, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedSchema(expandedSchema === i ? null : i)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-green-500" />
                          <span className="text-xs font-semibold text-gray-700">{s.type}</span>
                        </div>
                        {expandedSchema === i
                          ? <ChevronUp size={13} className="text-gray-400" />
                          : <ChevronDown size={13} className="text-gray-400" />}
                      </button>
                      {expandedSchema === i && (
                        <pre className="text-[10px] font-mono text-gray-600 bg-gray-50 px-3 py-2 overflow-x-auto max-h-48 border-t border-gray-100 leading-relaxed">
                          {JSON.stringify(s.raw, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </SectionCard>

          {/* ── READABILITY ─────────────────────────────────────────────── */}
          <SectionCard title="Readability (Flesch cho tiếng Việt)" icon={BookOpen} color="pink">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={cn('rounded-xl border p-3 text-center', scoreBg(data.fleschScore))}>
                <p className={cn('text-3xl font-bold', scoreColor(data.fleschScore))}>{data.fleschScore}</p>
                <p className="text-[10px] mt-0.5 font-medium text-gray-600">Điểm Flesch</p>
                <p className={cn('text-[10px] font-semibold', scoreColor(data.fleschScore))}>{data.readLabel}</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-3 text-center bg-gray-50">
                <p className="text-2xl font-bold text-gray-700">{data.wordCount.toLocaleString()}</p>
                <p className="text-[10px] mt-0.5 text-gray-500">Tổng từ</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-3 text-center bg-gray-50">
                <p className="text-2xl font-bold text-gray-700">{data.sentenceCount}</p>
                <p className="text-[10px] mt-0.5 text-gray-500">Câu</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-3 text-center bg-gray-50">
                <p className="text-2xl font-bold text-gray-700">{data.avgWPS}</p>
                <p className="text-[10px] mt-0.5 text-gray-500">Từ/câu TB</p>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-3">
              Điểm &ge;80: Dễ đọc · 60–79: Trung bình · &lt;60: Khó đọc · Lý tưởng: &lt;20 từ/câu
            </p>
          </SectionCard>
        </div>
      )}
    </div>
  )
}
