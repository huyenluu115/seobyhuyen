'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import Papa from 'papaparse'
import { Download, Copy, Check, Upload, ChevronDown, ChevronUp } from 'lucide-react'

// ── Config types ──────────────────────────────────────────────────────────────
interface OrgConfig {
  orgName: string
  orgUrl: string
  orgPhone: string
  logoUrl: string
}

interface SchemaRow {
  url: string
  name: string
  headline: string
  description: string
  image: string
  datePublished: string
  schemaTypes: string
}

interface SchemaResult {
  url: string
  name: string
  types: string
  code: string
  status: 'ok' | 'error'
  error?: string
}

// ── Schema type detection (ported from generator.py) ─────────────────────────
function detectTypes(url: string): Set<string> {
  const slug = url.replace(/\/$/, '').split('/').pop()?.toLowerCase() || ''
  const types = new Set(['Article', 'BreadcrumbList', 'FAQPage'])

  const howtoKw = ['quy-trinh', 'huong-dan', 'cac-buoc', 'danh-gia-noi-bo']
  const serviceKw = ['chi-phi', 'gia-', 'dich-vu', 'to-chuc', 'tham-dinh', 'kiem-dinh', 'kiem-toan-nang-luong', 'chung-nhan', 'quan-trac']
  const courseKw = ['dao-tao', 'huan-luyen', 'cap-chung-chi', 'chung-chi-an-toan', 'nhom-1', 'nhom-2', 'nhom-3', 'nhom-4', 'nhom-5', 'nhom-6']
  const listKw = ['danh-muc', 'nguyen-tac', 'danh-sach']

  howtoKw.forEach(kw => { if (slug.includes(kw)) types.add('HowTo') })
  serviceKw.forEach(kw => { if (slug.includes(kw)) types.add('Service') })
  courseKw.forEach(kw => { if (slug.includes(kw)) { types.add('Course'); types.add('FAQPage') } })
  listKw.forEach(kw => { if (slug.includes(kw)) types.add('ItemList') })
  return types
}

// ── JSON-LD builders ──────────────────────────────────────────────────────────
function esc(s: string) { return s.replace(/"/g, '\\"').replace(/\n/g, ' ').trim() }

function buildArticle(cfg: OrgConfig, a: SchemaRow) {
  return `    {
      "@type": "Article",
      "headline": "${esc(a.headline)}",
      "description": "${esc(a.description)}",
      "image": "${esc(a.image)}",
      "url": "${esc(a.url)}",
      "datePublished": "${esc(a.datePublished)}",
      "author": {"@type": "Organization", "name": "${esc(cfg.orgName)}", "url": "${esc(cfg.orgUrl)}"},
      "publisher": {"@type": "Organization", "name": "${esc(cfg.orgName)}", "logo": {"@type": "ImageObject", "url": "${esc(cfg.logoUrl)}"}},
      "inLanguage": "vi"
    }`
}

function buildBreadcrumb(cfg: OrgConfig, name: string, url: string) {
  return `    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Trang chủ", "item": "${esc(cfg.orgUrl)}"},
        {"@type": "ListItem", "position": 2, "name": "${esc(name)}", "item": "${esc(url)}"}
      ]
    }`
}

function buildFaq(faqs: [string, string][]) {
  const items = faqs.map(([q, a]) =>
    `        {"@type": "Question", "name": "${esc(q)}", "acceptedAnswer": {"@type": "Answer", "text": "${esc(a)}"}}`
  ).join(',\n')
  return `    {
      "@type": "FAQPage",
      "mainEntity": [
${items}
      ]
    }`
}

function buildService(cfg: OrgConfig, serviceType: string, desc: string) {
  return `    {
      "@type": "Service",
      "serviceType": "${esc(serviceType)}",
      "description": "${esc(desc)}",
      "provider": {"@type": "Organization", "name": "${esc(cfg.orgName)}", "url": "${esc(cfg.orgUrl)}"},
      "areaServed": {"@type": "Country", "name": "Việt Nam"},
      "availableChannel": {"@type": "ServiceChannel", "servicePhone": "${esc(cfg.orgPhone)}"}
    }`
}

function buildHowTo(name: string) {
  const steps = [
    ['Bước 1: Kiểm tra hồ sơ', 'Chuẩn bị và kiểm tra đầy đủ hồ sơ, tài liệu kỹ thuật liên quan.'],
    ['Bước 2: Kiểm tra kỹ thuật', 'Thực hiện kiểm tra kỹ thuật theo quy trình và tiêu chuẩn hiện hành.'],
    ['Bước 3: Thử nghiệm', 'Tiến hành thử nghiệm theo yêu cầu kỹ thuật của quy chuẩn.'],
    ['Bước 4: Đánh giá kết quả', 'Đánh giá kết quả và so sánh với tiêu chuẩn quy định.'],
    ['Bước 5: Cấp chứng nhận', 'Cấp giấy chứng nhận hoặc thông báo yêu cầu khắc phục nếu chưa đạt.'],
  ]
  const items = steps.map(([n, t]) =>
    `        {"@type": "HowToStep", "name": "${esc(n)}", "text": "${esc(t)}"}`
  ).join(',\n')
  return `    {
      "@type": "HowTo",
      "name": "${esc(name)}",
      "step": [
${items}
      ]
    }`
}

function defaultFaqs(cfg: OrgConfig): [string, string][] {
  return [
    ['Dịch vụ này áp dụng cho đối tượng nào?', `Áp dụng cho doanh nghiệp có nhu cầu theo quy định pháp luật. Liên hệ ${cfg.orgPhone} để được tư vấn.`],
    ['Chi phí thực hiện là bao nhiêu?', `Chi phí phụ thuộc vào quy mô và yêu cầu thực tế. Gọi ${cfg.orgPhone} để được báo giá.`],
    ['Thời gian thực hiện mất bao lâu?', 'Thời gian thực hiện tùy quy mô và yêu cầu cụ thể. Liên hệ để được tư vấn chi tiết.'],
  ]
}

function buildFullSchema(cfg: OrgConfig, row: SchemaRow, types: Set<string>): string {
  const blocks: string[] = []
  blocks.push(buildArticle(cfg, row))
  blocks.push(buildBreadcrumb(cfg, row.name, row.url))
  if (types.has('Service')) blocks.push(buildService(cfg, row.headline.split('|')[0].trim(), row.description))
  if (types.has('HowTo')) blocks.push(buildHowTo(row.headline.split('|')[0].trim()))
  if (types.has('FAQPage')) blocks.push(buildFaq(defaultFaqs(cfg)))
  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
${blocks.join(',\n')}
  ]
}
</script>`
}

function formatDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10) + 'T08:00:00+07:00'
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim() + 'T08:00:00+07:00'
  return raw.trim()
}

// ── Export helpers ────────────────────────────────────────────────────────────
function exportMarkdown(results: SchemaResult[]) {
  const now = new Date().toLocaleString('vi-VN')
  const lines = [
    '# Schema JSON-LD — Auto Generated',
    `> Generated: ${now} | ${results.length} bài`,
    '> Dán từng block `<script>` vào `<head>` của trang tương ứng.',
    '',
  ]
  results.forEach((r, i) => {
    lines.push('---', '', `## ${i + 1}. ${r.name}`, `\`${r.url}\``, `**Schema:** ${r.types}`, '', '```html', r.code, '```', '')
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'schema-output.md'
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Schema type definitions ───────────────────────────────────────────────────
const SCHEMA_TYPES = [
  { key: 'Article', label: 'Article', desc: 'Bài viết, tin tức' },
  { key: 'BreadcrumbList', label: 'Breadcrumb', desc: 'Đường dẫn phân cấp' },
  { key: 'FAQPage', label: 'FAQPage', desc: 'Câu hỏi thường gặp' },
  { key: 'HowTo', label: 'HowTo', desc: 'Quy trình, hướng dẫn' },
  { key: 'Service', label: 'Service', desc: 'Dịch vụ, chi phí' },
  { key: 'Course', label: 'Course', desc: 'Đào tạo, chứng chỉ' },
  { key: 'ItemList', label: 'ItemList', desc: 'Danh mục, danh sách' },
] as const

const DEFAULT_TYPES = new Set(['Article', 'BreadcrumbList', 'FAQPage'])

// ── Component ─────────────────────────────────────────────────────────────────
export default function SchemaGeneratorPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [config, setConfig] = useState<OrgConfig>({ orgName: '', orgUrl: '', orgPhone: '', logoUrl: '' })
  const [urls, setUrls] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [autoDetect, setAutoDetect] = useState(true)
  const [results, setResults] = useState<SchemaResult[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0)

  function toggleType(key: string) {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
    setAutoDetect(false)
  }

  function toggleAutoDetect() {
    setAutoDetect(true)
    setSelectedTypes(new Set())
  }

  function parseCsv(text: string): SchemaRow[] {
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
    return parsed.data
      .filter(r => r.url?.trim())
      .map(r => ({
        url: r.url?.trim() || '',
        name: r.name?.trim() || '',
        headline: r.headline?.trim() || '',
        description: r.description?.trim() || '',
        image: r.image?.trim() || '',
        datePublished: formatDate(r.datePublished || r.date || ''),
        schemaTypes: r.schema_types?.trim() || '',
      }))
  }

  function parseUrlList(text: string): SchemaRow[] {
    return text.split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('http'))
      .map(url => ({ url, name: '', headline: '', description: '', image: '', datePublished: formatDate(''), schemaTypes: '' }))
  }

  async function handleGenerate() {
    setError('')
    let rows: SchemaRow[] = []

    if (fileRef.current?.files?.[0]) {
      const text = await fileRef.current.files[0].text()
      rows = parseCsv(text)
    } else {
      rows = parseUrlList(urls)
    }

    if (rows.length === 0) { setError('Không có URL nào để xử lý'); return }

    setLoading(true)
    setResults([])
    setProgress({ current: 0, total: rows.length })

    const out: SchemaResult[] = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      setProgress({ current: i + 1, total: rows.length })

      try {
        // Fetch meta if fields missing
        if (!row.headline || !row.description) {
          const res = await fetch('/api/seo/fetch-meta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: row.url }),
          })
          const meta = await res.json()
          if (!row.headline) row.headline = meta.title || row.url
          if (!row.name) row.name = (meta.title || row.url).split('|')[0].trim()
          if (!row.description) row.description = meta.description || ''
          if (!row.image) row.image = meta.image || ''
        }
        if (!row.name) row.name = row.headline.split('|')[0].trim()

        // Detect schema types — manual selection > CSV override > auto-detect
        const types = !autoDetect && selectedTypes.size > 0
          ? new Set(selectedTypes)
          : row.schemaTypes
          ? new Set(row.schemaTypes.split(/[+,;]/).map(t => t.trim()))
          : detectTypes(row.url)

        const code = buildFullSchema(config, row, types)
        out.push({ url: row.url, name: row.name, types: [...types].sort().join(', '), code, status: 'ok' })
      } catch (e: unknown) {
        out.push({ url: row.url, name: row.url, types: '', code: '', status: 'error', error: e instanceof Error ? e.message : String(e) })
      }

      setResults([...out])
    }

    setLoading(false)
  }

  async function copyCode(code: string, key: string) {
    await navigator.clipboard.writeText(code)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const okResults = results.filter(r => r.status === 'ok')

  return (
    <div className="p-6 md:p-8 pb-16">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Schema Generator</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tạo JSON-LD tự động: Article · BreadcrumbList · FAQPage · HowTo · Service · Course</p>
        </div>
        {okResults.length > 0 && !loading && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportMarkdown(okResults)}>
            <Download size={13} />Export .md
          </Button>
        )}
      </div>

      {/* Config */}
      <div className="bg-white rounded-xl border p-4 shadow-sm mb-5">
        <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Cấu hình tổ chức (tuỳ chọn)</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tên tổ chức</label>
            <Input value={config.orgName} onChange={e => setConfig(c => ({ ...c, orgName: e.target.value }))} placeholder="vd: Vinacontrol CE" className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Website</label>
            <Input value={config.orgUrl} onChange={e => setConfig(c => ({ ...c, orgUrl: e.target.value }))} placeholder="https://example.com" className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Điện thoại</label>
            <Input value={config.orgPhone} onChange={e => setConfig(c => ({ ...c, orgPhone: e.target.value }))} placeholder="1800-xxxx" className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">URL Logo</label>
            <Input value={config.logoUrl} onChange={e => setConfig(c => ({ ...c, logoUrl: e.target.value }))} placeholder="https://example.com/logo.png" className="text-sm" />
          </div>
        </div>
      </div>

      {/* Input */}
      {results.length === 0 && !loading && (
        <div className="max-w-2xl space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Upload CSV (cột url bắt buộc)</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm text-gray-600 cursor-pointer hover:bg-gray-50 transition-colors">
                <Upload size={14} />Chọn file CSV
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" />
              </label>
              <span className="text-xs text-gray-400">hoặc</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Paste danh sách URL (mỗi dòng 1 URL)</label>
            <textarea
              value={urls}
              onChange={e => setUrls(e.target.value)}
              placeholder={'https://example.com/bai-viet-1\nhttps://example.com/bai-viet-2\nhttps://example.com/bai-viet-3'}
              className="w-full border rounded-lg p-3 text-sm font-mono min-h-[120px] outline-none focus:ring-2 focus:ring-blue-200 resize-y"
            />
          </div>
          {/* Schema type selector */}
          <div className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Loại Schema</p>
            <div className="flex flex-wrap gap-2">
              {/* Auto-detect toggle */}
              <button
                onClick={toggleAutoDetect}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  autoDetect
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', autoDetect ? 'bg-white' : 'bg-gray-300')} />
                Auto-detect
              </button>
              {SCHEMA_TYPES.map(t => {
                const active = !autoDetect && selectedTypes.has(t.key)
                const isDefault = DEFAULT_TYPES.has(t.key)
                return (
                  <button
                    key={t.key}
                    onClick={() => toggleType(t.key)}
                    title={t.desc}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      active
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                    )}
                  >
                    {active && <Check size={10} />}
                    {t.label}
                    {isDefault && !active && <span className="text-[9px] text-gray-400">(default)</span>}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-400">
              {autoDetect
                ? 'Tự động nhận dạng loại schema từ URL. Chọn thủ công để ghi đè cho tất cả URL trong batch.'
                : selectedTypes.size === 0
                ? 'Chưa chọn loại nào — sẽ dùng auto-detect.'
                : `Áp dụng cho tất cả URL: ${[...selectedTypes].sort().join(', ')}`}
            </p>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <Button onClick={handleGenerate}>Tạo Schema</Button>
        </div>
      )}

      {/* Progress */}
      {loading && (
        <div className="max-w-lg space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-sm text-gray-700">Đang xử lý {progress.current}/{progress.total}: {results[results.length - 1]?.url || ''}</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && !loading && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600">{okResults.length} schema đã tạo</p>
            <button onClick={() => { setResults([]); setProgress({ current: 0, total: 0 }) }}
              className="text-xs text-gray-400 hover:text-gray-600 ml-auto">Tạo lại</button>
          </div>
          {results.map((r, i) => (
            <div key={r.url} className={cn('bg-white rounded-xl border shadow-sm overflow-hidden', r.status === 'error' && 'border-red-200')}>
              <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{r.name || r.url}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400 truncate max-w-xs">{r.url}</span>
                    {r.types && <span className="text-[10px] bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">{r.types}</span>}
                    {r.status === 'error' && <span className="text-[10px] bg-red-100 text-red-600 rounded px-1.5 py-0.5">{r.error}</span>}
                  </div>
                </div>
                {r.status === 'ok' && (
                  <button onClick={e => { e.stopPropagation(); copyCode(r.code, r.url) }}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 shrink-0">
                    {copied === r.url ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    {copied === r.url ? 'Copied!' : 'Copy'}
                  </button>
                )}
                {expandedIdx === i ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
              </button>
              {expandedIdx === i && r.status === 'ok' && (
                <div className="border-t bg-gray-50 p-4">
                  <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">{r.code}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
