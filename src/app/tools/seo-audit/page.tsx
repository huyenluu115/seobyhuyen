'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Search, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ExternalLink, ChevronDown, ChevronUp, FileCode2, BookOpen,
  BarChart3, Tag, Link2, ImageIcon, Globe, Copy, Check,
  Lightbulb, ChevronRight
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
  images: { total: number; missingAlt: number; missingAltImgs: string[] }
  wordCount: number; sentenceCount: number; avgWPS: number; fleschScore: number; readLabel: string
  topUni: { text: string; count: number; density: string }[]
  topBi: { text: string; count: number; density: string }[]
  topTri: { text: string; count: number; density: string }[]
}

interface Issue {
  id: string
  severity: 'error' | 'warning'
  category: string
  title: string
  detail: string
  fix?: string
  fixLabel?: string
  docsUrl?: string
  docsLabel?: string
}

function buildIssues(data: AuditData, domain: string): Issue[] {
  const list: Issue[] = []

  // Title
  if (!data.title) {
    list.push({ id: 'title-missing', severity: 'error', category: 'Meta', title: 'Thiếu Title Tag',
      detail: 'Trang không có thẻ <title>. Google dùng title để hiển thị kết quả tìm kiếm.',
      fix: `<title>Từ khóa chính — ${domain}</title>`,
      docsUrl: 'https://developers.google.com/search/docs/appearance/title-link', docsLabel: 'Google: Title best practices' })
  } else if (data.titleLen < 30) {
    list.push({ id: 'title-short', severity: 'warning', category: 'Meta', title: `Title quá ngắn (${data.titleLen}/30–65 ký tự)`,
      detail: 'Title ngắn không truyền đủ thông tin cho Google và người dùng.',
      fixLabel: 'Thêm từ khóa phụ hoặc tên thương hiệu. Mục tiêu: 50–65 ký tự.',
      docsUrl: 'https://developers.google.com/search/docs/appearance/title-link', docsLabel: 'Google: Title link' })
  } else if (data.titleLen > 65) {
    list.push({ id: 'title-long', severity: 'warning', category: 'Meta', title: `Title quá dài (${data.titleLen}/65 ký tự)`,
      detail: 'Google sẽ cắt bỏ phần thừa khi hiển thị. Người dùng không đọc được đầy đủ.',
      fixLabel: 'Rút ngắn còn ≤65 ký tự. Đặt từ khóa quan trọng nhất lên đầu.',
      docsUrl: 'https://developers.google.com/search/docs/appearance/title-link', docsLabel: 'Google: Title link' })
  }

  // Description
  if (!data.desc) {
    list.push({ id: 'desc-missing', severity: 'error', category: 'Meta', title: 'Thiếu Meta Description',
      detail: 'Không có meta description. Google có thể tự tạo snippet không tối ưu.',
      fix: `<meta name="description" content="Mô tả trang khoảng 120–155 ký tự, chứa từ khóa chính.">`,
      docsUrl: 'https://developers.google.com/search/docs/appearance/snippet', docsLabel: 'Google: Snippet best practices' })
  } else if (data.descLen < 70) {
    list.push({ id: 'desc-short', severity: 'warning', category: 'Meta', title: `Meta description quá ngắn (${data.descLen}/70–160 ký tự)`,
      detail: 'Description ngắn bỏ lỡ cơ hội thuyết phục người dùng click.',
      fixLabel: 'Mở rộng đến 120–155 ký tự: mô tả nội dung, lợi ích, CTA nhẹ.',
      docsUrl: 'https://developers.google.com/search/docs/appearance/snippet', docsLabel: 'Google: Snippet' })
  } else if (data.descLen > 160) {
    list.push({ id: 'desc-long', severity: 'warning', category: 'Meta', title: `Meta description quá dài (${data.descLen}/160 ký tự)`,
      detail: 'Google sẽ cắt bỏ phần thừa khi hiển thị kết quả tìm kiếm.',
      fixLabel: 'Rút ngắn còn ≤160 ký tự. Giữ phần quan trọng nhất ở đầu.',
      docsUrl: 'https://developers.google.com/search/docs/appearance/snippet', docsLabel: 'Google: Snippet' })
  }

  // Canonical
  if (!data.canonical) {
    list.push({ id: 'canonical-missing', severity: 'warning', category: 'Kỹ thuật', title: 'Thiếu Canonical Tag',
      detail: 'Không có canonical URL. Gây nhầm lẫn khi có nhiều URL dẫn đến cùng nội dung.',
      fix: `<link rel="canonical" href="${data.finalUrl}">`,
      docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/canonicalization', docsLabel: 'Google: Canonicalization' })
  } else if (!data.canonicalOk) {
    list.push({ id: 'canonical-wrong', severity: 'error', category: 'Kỹ thuật', title: 'Canonical trỏ sai URL',
      detail: `Canonical hiện tại: ${data.canonical} — không khớp với URL trang: ${data.finalUrl}`,
      fix: `<link rel="canonical" href="${data.finalUrl}">`,
      docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/canonicalization', docsLabel: 'Google: Canonicalization' })
  }

  // Viewport
  if (!data.viewport) {
    list.push({ id: 'viewport-missing', severity: 'error', category: 'Kỹ thuật', title: 'Thiếu Meta Viewport',
      detail: 'Không có viewport meta tag. Trang sẽ không hiển thị đúng trên mobile — ảnh hưởng xếp hạng.',
      fix: `<meta name="viewport" content="width=device-width, initial-scale=1">`,
      docsUrl: 'https://web.dev/articles/responsive-web-design-basics', docsLabel: 'web.dev: Responsive basics' })
  }

  // OG Image
  if (!data.ogImage) {
    list.push({ id: 'og-image-missing', severity: 'warning', category: 'Social', title: 'Thiếu OG Image',
      detail: 'Link share trên Facebook/Zalo/LinkedIn sẽ không có ảnh preview — tỉ lệ click giảm mạnh.',
      fix: `<meta property="og:image" content="https://${domain}/images/og-image.jpg">\n<!-- Khuyến nghị: ảnh 1200×630px, <1MB -->`,
      docsUrl: 'https://ogp.me/', docsLabel: 'The Open Graph protocol' })
  }

  // H1
  const h1Count = data.headings.filter(h => h.level === 1).length
  if (h1Count === 0) {
    list.push({ id: 'h1-missing', severity: 'error', category: 'Nội dung', title: 'Thiếu thẻ H1',
      detail: 'Không có H1. Google dùng H1 để hiểu chủ đề trang. Mỗi trang cần đúng 1 thẻ H1.',
      fix: `<h1>Từ khóa chính của trang</h1>`,
      docsUrl: 'https://developers.google.com/search/docs/appearance/title-link', docsLabel: 'Google: Heading structure' })
  } else if (h1Count > 1) {
    list.push({ id: 'h1-multiple', severity: 'warning', category: 'Nội dung', title: `Có ${h1Count} thẻ H1 (nên có đúng 1)`,
      detail: 'Nhiều H1 gây nhầm lẫn cho Google về chủ đề chính của trang.',
      fixLabel: `Giữ lại 1 H1 chứa từ khóa chính. Đổi ${h1Count - 1} H1 còn lại thành H2.` })
  }

  // Schema
  if (data.schemas.length === 0) {
    list.push({ id: 'schema-missing', severity: 'warning', category: 'Schema', title: 'Không có Schema JSON-LD',
      detail: 'Thiếu structured data — mất cơ hội hiển thị rich results (rating sao, FAQ, breadcrumb...) trên Google.',
      fix: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Article",\n  "headline": "${data.title || 'Tiêu đề bài viết'}",\n  "author": { "@type": "Person", "name": "Tên tác giả" },\n  "publisher": { "@type": "Organization", "name": "${domain}" }\n}\n</script>`,
      docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data', docsLabel: 'Google: Structured Data' })
  }

  // Images alt
  if (data.images.missingAlt > 0) {
    const imgList = data.images.missingAltImgs.length > 0
      ? `\n\nCác ảnh thiếu alt:\n${data.images.missingAltImgs.map(s => `• ${s}`).join('\n')}${data.images.missingAlt > data.images.missingAltImgs.length ? `\n• ... và ${data.images.missingAlt - data.images.missingAltImgs.length} ảnh khác` : ''}`
      : ''
    list.push({ id: 'alt-missing', severity: 'warning', category: 'Hình ảnh', title: `${data.images.missingAlt} ảnh thiếu thuộc tính alt`,
      detail: `Alt text giúp Google Image Search và người dùng khiếm thị. Ảnh không có alt bỏ lỡ traffic từ Google Images.${imgList}`,
      fix: data.images.missingAltImgs.slice(0, 3).map(s => `<img src="${s}" alt="Mô tả nội dung ảnh chứa từ khóa">`).join('\n') || `<img src="anh.jpg" alt="Mô tả nội dung ảnh chứa từ khóa liên quan">`,
      docsUrl: 'https://developers.google.com/search/docs/appearance/google-images', docsLabel: 'Google: Image best practices' })
  }

  // Robots noindex
  if (data.metaRobots.includes('noindex')) {
    list.push({ id: 'noindex', severity: 'error', category: 'Kỹ thuật', title: 'Meta robots: noindex — Google KHÔNG index trang này!',
      detail: `Robots tag hiện tại: "${data.metaRobots}". Google sẽ bỏ qua trang này hoàn toàn.`,
      fix: `<!-- Xóa hoặc thay bằng: -->\n<meta name="robots" content="index, follow">`,
      docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag', docsLabel: 'Google: Robots meta tag' })
  }

  // Word count
  if (data.wordCount < 300) {
    list.push({ id: 'thin-content', severity: 'warning', category: 'Nội dung', title: `Nội dung mỏng (${data.wordCount} từ)`,
      detail: 'Google coi trang có <300 từ là thin content — dễ bị đánh giá thấp hơn.',
      fixLabel: 'Bổ sung nội dung: giải thích chi tiết hơn, thêm FAQ, ví dụ thực tế, thống kê.',
      docsUrl: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', docsLabel: 'Google: Helpful content' })
  }

  return list
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors shrink-0">
      {copied ? <><Check size={10} />Đã copy</> : <><Copy size={10} />Copy</>}
    </button>
  )
}

function IssueItem({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false)
  const isError = issue.severity === 'error'
  return (
    <div className={cn('rounded-xl border overflow-hidden', isError ? 'border-red-200' : 'border-amber-200')}>
      <button onClick={() => setOpen(v => !v)}
        className={cn('w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
          isError ? 'bg-red-50 hover:bg-red-100' : 'bg-amber-50 hover:bg-amber-100')}>
        <span className={cn('shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide',
          isError ? 'bg-red-200 text-red-700' : 'bg-amber-200 text-amber-700')}>
          {isError ? 'Lỗi' : 'Cảnh báo'}
        </span>
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
          'bg-white/70 text-gray-500')}>{issue.category}</span>
        <span className={cn('text-sm font-semibold flex-1', isError ? 'text-red-800' : 'text-amber-800')}>
          {issue.title}
        </span>
        {open ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 py-3 bg-white border-t border-gray-100 space-y-3">
          <p className="text-xs text-gray-600 leading-relaxed">{issue.detail}</p>

          {issue.fix && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                  <Lightbulb size={11} className="text-green-500" />Cách sửa — thêm vào <code className="bg-gray-100 px-1 rounded text-[10px]">&lt;head&gt;</code>
                </p>
                <CopyBtn text={issue.fix} />
              </div>
              <pre className="text-[11px] font-mono bg-gray-900 text-green-300 rounded-xl px-4 py-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                {issue.fix}
              </pre>
            </div>
          )}

          {issue.fixLabel && !issue.fix && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
              <Lightbulb size={13} className="text-green-500 shrink-0 mt-0.5" />
              <p className="text-xs text-green-800">{issue.fixLabel}</p>
            </div>
          )}

          {issue.docsUrl && (
            <a href={issue.docsUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium">
              <ExternalLink size={11} />{issue.docsLabel}
            </a>
          )}
        </div>
      )}
    </div>
  )
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
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={cn('text-xs font-bold', ok ? 'text-green-600' : val > 0 ? 'text-amber-600' : 'text-gray-400')}>
          {val} / {max} ký tự{ok ? ' ✓' : val > max ? ' — quá dài' : val > 0 ? ' — quá ngắn' : ''}
        </span>
      </div>
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="absolute h-full bg-green-100 rounded-full"
          style={{ left: `${(min / (max + 10)) * 100}%`, width: `${((max - min) / (max + 10)) * 100}%` }} />
        <div className={cn('absolute h-full rounded-full', ok ? 'bg-green-500' : val > max ? 'bg-red-500' : 'bg-amber-400')}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ScoreRing({ score, size = 76 }: { score: number; size?: number }) {
  const r = 30, circ = 2 * Math.PI * r
  const dash = circ - (Math.min(score, 100) / 100) * circ
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
  const textColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-500'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 74 74" className="-rotate-90">
        <circle cx="37" cy="37" r={r} fill="none" stroke="#f3f4f6" strokeWidth="8" />
        <circle cx="37" cy="37" r={r} fill="none" strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round" stroke={color} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-bold leading-none', textColor)} style={{ fontSize: size * 0.27 }}>{score}</span>
        <span className="text-[9px] text-gray-400 mt-0.5">{score >= 80 ? 'Dễ đọc' : score >= 60 ? 'Trung bình' : 'Khó'}</span>
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
  const [showAllIssues, setShowAllIssues] = useState(true)

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
        <p className="text-sm text-gray-500 mt-0.5">Meta · H1–H6 · N-gram · Schema · Nofollow · Readability · Hướng dẫn fix lỗi</p>
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
        const issues = buildIssues(data, domain)
        const errors = issues.filter(i => i.severity === 'error')
        const warnings = issues.filter(i => i.severity === 'warning')

        return (
          <div className="space-y-5 max-w-6xl">

            {/* ── HEADER SUMMARY ──────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe size={13} className="text-gray-400 shrink-0" />
                  <a href={data.finalUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate font-medium">
                    {data.finalUrl}<ExternalLink size={10} className="shrink-0 ml-0.5" />
                  </a>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {errors.length > 0 && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-100 text-red-700">
                      <XCircle size={13} />{errors.length} lỗi
                    </span>
                  )}
                  {warnings.length > 0 && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-700">
                      <AlertTriangle size={13} />{warnings.length} cảnh báo
                    </span>
                  )}
                  {issues.length === 0 && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-green-100 text-green-700">
                      <CheckCircle2 size={13} />Hoàn hảo
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 divide-x divide-gray-100">
                {[
                  { label: 'Title', ok: data.titleLen >= 30 && data.titleLen <= 65 && !!data.title, warn: data.titleLen > 0 && (data.titleLen < 30 || data.titleLen > 65), val: data.title ? `${data.titleLen}c` : 'Thiếu' },
                  { label: 'Description', ok: data.descLen >= 70 && data.descLen <= 160 && !!data.desc, warn: data.descLen > 0 && (data.descLen < 70 || data.descLen > 160), val: data.desc ? `${data.descLen}c` : 'Thiếu' },
                  { label: 'Canonical', ok: data.canonicalOk, warn: !!data.canonical && !data.canonicalOk, val: data.canonical ? (data.canonicalOk ? 'Đúng' : 'Sai') : 'Thiếu' },
                  { label: 'Viewport', ok: data.viewport, warn: false, val: data.viewport ? 'Có' : 'Thiếu' },
                  { label: 'OG Image', ok: !!data.ogImage, warn: false, val: data.ogImage ? 'Có' : 'Thiếu' },
                  { label: 'H1', ok: h1Count === 1, warn: h1Count > 1, val: `${h1Count} thẻ` },
                  { label: 'Schema', ok: data.schemas.length > 0, warn: false, val: data.schemas.length > 0 ? `${data.schemas.length}` : 'Không' },
                  { label: 'Alt thiếu', ok: data.images.missingAlt === 0, warn: data.images.missingAlt > 0, val: `${data.images.missingAlt}/${data.images.total}` },
                ].map(({ label, ok, warn, val }) => (
                  <div key={label} className={cn('px-2 py-3 text-center', ok ? '' : warn ? 'bg-amber-50' : 'bg-red-50')}>
                    <div className="flex justify-center mb-1"><StatusIcon ok={ok} warn={warn} /></div>
                    <p className={cn('text-sm font-bold', ok ? 'text-gray-800' : warn ? 'text-amber-700' : 'text-red-600')}>{val}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── ISSUES PANEL ────────────────────────────────────────── */}
            {issues.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => setShowAllIssues(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                      <AlertTriangle size={15} className="text-red-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">
                        Vấn đề cần sửa — {issues.length} mục
                      </p>
                      <p className="text-xs text-gray-500">Nhấn vào từng lỗi để xem hướng dẫn fix chi tiết + link tài liệu Google</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className={cn('text-gray-400 transition-transform', showAllIssues && 'rotate-90')} />
                </button>

                {showAllIssues && (
                  <div className="px-5 pb-5 space-y-2 border-t border-gray-100 pt-4">
                    {errors.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 flex items-center gap-1">
                          <XCircle size={10} />Lỗi nghiêm trọng — cần sửa ngay
                        </p>
                        {errors.map(issue => <IssueItem key={issue.id} issue={issue} />)}
                      </div>
                    )}
                    {warnings.length > 0 && (
                      <div className="space-y-2 mt-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 flex items-center gap-1 mt-4">
                          <AlertTriangle size={10} />Cảnh báo — nên cải thiện
                        </p>
                        {warnings.map(issue => <IssueItem key={issue.id} issue={issue} />)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── SERP PREVIEW + META ──────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-5">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Xem trước trên Google</p>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-4 h-4 rounded-full bg-gray-300 shrink-0" />
                    <span className="text-xs text-gray-500 truncate">{domain} › ...</span>
                  </div>
                  <p className="text-blue-700 font-medium leading-snug text-[15px] mb-1 line-clamp-2">
                    {data.title ? (data.titleLen > 65 ? data.title.slice(0, 65) + '…' : data.title) : <span className="italic text-gray-400">Không có title</span>}
                  </p>
                  <p className="text-sm text-gray-600 leading-snug line-clamp-2">
                    {data.desc ? (data.descLen > 160 ? data.desc.slice(0, 160) + '…' : data.desc) : <span className="italic text-gray-400">Không có meta description</span>}
                  </p>
                </div>
                <div className="space-y-3">
                  <LengthBar val={data.titleLen} min={30} max={65} label="Title tag" />
                  <LengthBar val={data.descLen} min={70} max={160} label="Meta description" />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  <Tag size={11} className="inline mr-1" />Chi tiết Meta
                </p>
                <div className="space-y-0">
                  {[
                    { label: 'Title', ok: data.titleLen >= 30 && data.titleLen <= 65 && !!data.title, warn: data.titleLen > 0 && (data.titleLen < 30 || data.titleLen > 65), value: data.title || '—', note: !data.title ? 'Thiếu title tag' : data.titleLen < 30 ? `Quá ngắn (${data.titleLen} ký tự, cần ≥30)` : data.titleLen > 65 ? `Quá dài (${data.titleLen} ký tự, nên ≤65)` : '' },
                    { label: 'Description', ok: data.descLen >= 70 && data.descLen <= 160 && !!data.desc, warn: data.descLen > 0 && (data.descLen < 70 || data.descLen > 160), value: data.desc || '—', note: !data.desc ? 'Thiếu description' : data.descLen < 70 ? `Quá ngắn (${data.descLen} ký tự, cần ≥70)` : data.descLen > 160 ? `Quá dài (${data.descLen}, nên ≤160)` : '' },
                    { label: 'Canonical', ok: data.canonicalOk, warn: !!data.canonical && !data.canonicalOk, value: data.canonical || '—', note: !data.canonical ? 'Thiếu canonical' : !data.canonicalOk ? 'Trỏ sai URL' : '' },
                    { label: 'Viewport', ok: data.viewport, warn: false, value: data.viewport ? 'Có' : '—', note: !data.viewport ? 'Thiếu — không mobile-friendly' : '' },
                    { label: 'Robots', ok: !data.metaRobots.includes('noindex'), warn: !data.metaRobots, value: data.metaRobots || 'Không khai báo', note: data.metaRobots.includes('noindex') ? '⚠ noindex — Google KHÔNG index!' : '' },
                  ].map(({ label, ok, warn, value, note }) => (
                    <div key={label} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                      <StatusIcon ok={ok} warn={warn} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide w-[72px] shrink-0">{label}</span>
                          <span className="text-xs text-gray-700 truncate">{value}</span>
                        </div>
                        {note && <p className={cn('text-[11px] mt-0.5', ok ? 'text-gray-400' : warn ? 'text-amber-600' : 'text-red-500')}>{note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Open Graph & Social</p>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { k: 'og:title', v: !!data.ogTitle },
                      { k: 'og:description', v: !!data.ogDesc },
                      { k: 'og:image', v: !!data.ogImage },
                      { k: data.ogType ? `og:type · ${data.ogType}` : 'og:type', v: !!data.ogType },
                      { k: data.twitterCard ? `twitter:card · ${data.twitterCard}` : 'twitter:card', v: !!data.twitterCard },
                    ].map(({ k, v }) => (
                      <div key={k} className={cn('flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg font-medium',
                        v ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
                        {v ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                        <span className="truncate">{k}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── HEADINGS + KEYWORDS ──────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <BookOpen size={14} className="text-indigo-500" />Cấu trúc Heading
                  </p>
                  <span className="text-xs text-gray-400">{data.headings.length} thẻ</span>
                </div>
                <div className="space-y-1.5 mb-4 pb-4 border-b border-gray-100">
                  {hCounts.filter(h => h.c > 0 || h.l <= 3).map(({ l, c }) => (
                    <div key={l} className="flex items-center gap-2">
                      <span className={cn('shrink-0 text-[10px] font-bold w-6 text-center py-0.5 rounded', H_COLORS[l])}>H{l}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', l === 1 ? 'bg-indigo-500' : l === 2 ? 'bg-blue-400' : l === 3 ? 'bg-sky-300' : 'bg-gray-300')}
                          style={{ width: `${(c / hMax) * 100}%` }} />
                      </div>
                      <span className={cn('text-xs font-bold w-6 text-right shrink-0', l === 1 && c !== 1 ? 'text-red-500' : 'text-gray-600')}>{c}</span>
                      {l === 1 && c === 0 && <span className="text-[10px] text-red-500 shrink-0">⚠ Thiếu</span>}
                      {l === 1 && c > 1 && <span className="text-[10px] text-amber-500 shrink-0">⚠ Thừa</span>}
                    </div>
                  ))}
                </div>
                {data.headings.length === 0
                  ? <p className="text-xs text-gray-400 italic">Không tìm thấy heading nào</p>
                  : (
                    <div className="space-y-px max-h-[200px] overflow-y-auto pr-1">
                      {data.headings.map((h, i) => (
                        <div key={i} className="flex items-start gap-1.5" style={{ paddingLeft: (h.level - 1) * 14 }}>
                          {h.level > 1 && <span className="text-gray-200 mt-0.5 text-xs select-none shrink-0">└</span>}
                          <span className={cn('shrink-0 text-[9px] font-bold px-1 py-px rounded mt-0.5', H_COLORS[h.level])}>H{h.level}</span>
                          <span className={cn('text-xs leading-snug break-words min-w-0',
                            h.level === 1 ? 'text-gray-900 font-semibold' : h.level === 2 ? 'text-gray-700 font-medium' : 'text-gray-500')}>
                            {h.text || <em className="text-gray-300 font-normal">(trống)</em>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

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
                {kwRows.length === 0 ? <p className="text-xs text-gray-400">Không đủ dữ liệu</p> : (
                  <div>
                    <div className="grid grid-cols-[1fr_auto_auto] text-[10px] font-semibold uppercase tracking-wide text-gray-400 pb-1.5 border-b border-gray-100 mb-2 gap-x-3">
                      <span>Từ khóa</span><span className="text-right">Lần</span><span className="text-right w-12">Mật độ</span>
                    </div>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {kwRows.slice(0, 12).map((r, i) => {
                        const pct = parseFloat(r.density)
                        return (
                          <div key={i}>
                            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 mb-0.5">
                              <span className="text-xs text-gray-700 font-medium truncate">{r.text}</span>
                              <span className="text-xs text-gray-400 text-right">{r.count}</span>
                              <span className={cn('text-xs font-bold text-right w-12', pct > 3 ? 'text-red-600' : pct > 1 ? 'text-green-600' : 'text-gray-400')}>{r.density}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full', pct > 3 ? 'bg-red-400' : pct > 1 ? 'bg-green-400' : 'bg-gray-200')}
                                style={{ width: `${(r.count / kwMax) * 100}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex gap-3 mt-2 pt-2 border-t border-gray-100">
                      <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />1–3%: OK</span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />&gt;3%: Keyword stuffing</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── LINKS + IMAGES + READABILITY ─────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
                  <>
                    <p className="text-[10px] text-gray-400 mb-1">Internal / External</p>
                    <div className="h-2 rounded-full overflow-hidden flex">
                      <div className="bg-blue-400 h-full" style={{ width: `${(data.links.internal / totalLinks) * 100}%` }} />
                      <div className="bg-gray-200 h-full flex-1" />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>{Math.round((data.links.internal / totalLinks) * 100)}% nội bộ</span>
                      <span>{Math.round((data.links.external / totalLinks) * 100)}% ngoài</span>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
                  <ImageIcon size={14} className="text-sky-500" />Hình ảnh
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-3xl font-bold text-gray-700">{data.images.total}</p>
                    <div><p className="text-sm font-semibold text-gray-600">Tổng ảnh</p><p className="text-xs text-gray-400">trên trang</p></div>
                  </div>
                  <div className={cn('flex items-center gap-4 p-3 rounded-xl border', data.images.missingAlt === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                    <p className={cn('text-3xl font-bold', data.images.missingAlt === 0 ? 'text-green-600' : 'text-red-600')}>{data.images.missingAlt}</p>
                    <div>
                      <p className={cn('text-sm font-semibold', data.images.missingAlt === 0 ? 'text-green-700' : 'text-red-700')}>Thiếu alt tag</p>
                      <p className="text-xs text-gray-400">{data.images.missingAlt === 0 ? 'Tất cả ảnh có alt ✓' : `${data.images.total - data.images.missingAlt}/${data.images.total} ảnh có alt`}</p>
                    </div>
                  </div>
                  {data.images.total > 0 && (
                    <>
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Tỉ lệ có alt</span>
                        <span>{Math.round(((data.images.total - data.images.missingAlt) / data.images.total) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', data.images.missingAlt === 0 ? 'bg-green-400' : 'bg-amber-400')}
                          style={{ width: `${((data.images.total - data.images.missingAlt) / data.images.total) * 100}%` }} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
                  <BookOpen size={14} className="text-pink-500" />Readability
                  <span className="text-[10px] text-gray-400 font-normal">Flesch (VI)</span>
                </p>
                <div className="flex items-center gap-4 mb-4">
                  <ScoreRing score={data.fleschScore} size={76} />
                  <div>
                    <p className={cn('text-lg font-bold', data.fleschScore >= 80 ? 'text-green-600' : data.fleschScore >= 60 ? 'text-amber-600' : 'text-red-500')}>{data.readLabel}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Điểm càng cao → càng dễ đọc</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Tổng số từ', val: data.wordCount.toLocaleString(), ok: data.wordCount >= 300, note: data.wordCount < 300 ? '⚠ Mỏng (<300 từ)' : '' },
                    { label: 'Số câu', val: data.sentenceCount.toLocaleString(), ok: true, note: '' },
                    { label: 'Từ / câu TB', val: `${data.avgWPS} từ`, ok: data.avgWPS <= 20, note: data.avgWPS > 25 ? '⚠ Câu quá dài' : data.avgWPS > 20 ? '⚠ Câu hơi dài' : '' },
                  ].map(({ label, val, ok, note }) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div><span className="text-xs text-gray-500">{label}</span>{note && <p className="text-[10px] text-amber-600">{note}</p>}</div>
                      <span className={cn('text-sm font-bold', ok ? 'text-gray-800' : 'text-amber-600')}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── SCHEMA ──────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <FileCode2 size={14} className="text-violet-500" />Schema JSON-LD
                </p>
                <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', data.schemas.length > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                  {data.schemas.length > 0 ? `✓ ${data.schemas.length} schema` : '✗ Không có'}
                </span>
              </div>
              {data.schemas.length === 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-red-700 mb-1">Không tìm thấy Schema JSON-LD</p>
                  <p className="text-xs text-red-600 mb-2">Schema giúp Google hiểu nội dung và hiển thị rich results. Xem hướng dẫn fix ở phần Issues phía trên.</p>
                  <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                    <ExternalLink size={11} />Google Rich Results Test
                  </a>
                </div>
              ) : (
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
                            <p className="text-[10px] text-gray-400">{Object.keys(s.raw as object).filter(k => !k.startsWith('@')).slice(0, 3).join(', ')}</p>
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
