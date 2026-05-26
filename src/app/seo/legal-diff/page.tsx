'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Upload, Loader2, ArrowLeftRight, Plus, Minus, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type DiffKind = 'same' | 'add' | 'del'
type ChangeType = 'modified' | 'added' | 'removed' | 'unchanged'

interface DiffToken { text: string; kind: DiffKind }

interface ArticleDiff {
  key: string       // "điều 1", "điều 2a" …
  label: string     // display label
  type: ChangeType
  oldText: string
  newText: string
  tokens: DiffToken[]
  similarity: number
}

// ── Algorithms ────────────────────────────────────────────────────────────────

function wordDiff(oldStr: string, newStr: string): DiffToken[] {
  const a = oldStr.trim().split(/\s+/).slice(0, 300)
  const b = newStr.trim().split(/\s+/).slice(0, 300)
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
  const tokens: DiffToken[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      tokens.unshift({ text: a[i - 1], kind: 'same' }); i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.unshift({ text: b[j - 1], kind: 'add' }); j--
    } else {
      tokens.unshift({ text: a[i - 1], kind: 'del' }); i--
    }
  }
  return tokens
}

function similarity(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2))
  const wb = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2))
  if (wa.size === 0 && wb.size === 0) return 1
  let shared = 0
  wa.forEach(w => { if (wb.has(w)) shared++ })
  return shared / Math.max(wa.size, wb.size)
}

function extractArticles(text: string): Map<string, string> {
  const map = new Map<string, string>()
  const lines = text.split('\n')
  let key = '', buf: string[] = []

  const flush = () => { if (key && buf.length) map.set(key, buf.join('\n').trim()) }

  for (const line of lines) {
    const m = line.match(/^(điều\s+\d+[a-zàáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]*)/i)
    if (m) {
      flush()
      key = m[1].toLowerCase().replace(/\s+/g, ' ')
      buf = [line]
    } else if (key) {
      buf.push(line)
    }
  }
  flush()
  return map
}

function compareDocuments(oldText: string, newText: string): ArticleDiff[] {
  const oldMap = extractArticles(oldText)
  const newMap = extractArticles(newText)
  const allKeys = new Set([...oldMap.keys(), ...newMap.keys()])
  const results: ArticleDiff[] = []

  allKeys.forEach(key => {
    const oldContent = oldMap.get(key) ?? ''
    const newContent = newMap.get(key) ?? ''
    const label = key.replace(/^(đ)/, c => c.toUpperCase())
    const sim = oldContent && newContent ? similarity(oldContent, newContent) : 0

    let type: ChangeType
    if (!oldContent) type = 'added'
    else if (!newContent) type = 'removed'
    else if (sim > 0.92) type = 'unchanged'
    else type = 'modified'

    results.push({
      key, label, type,
      oldText: oldContent,
      newText: newContent,
      tokens: type === 'modified' ? wordDiff(oldContent, newContent) : [],
      similarity: Math.round(sim * 100),
    })
  })

  // Sort: Điều 1, 2, 3 … numerically
  results.sort((a, b) => {
    const numA = parseInt(a.key.match(/\d+/)?.[0] ?? '0')
    const numB = parseInt(b.key.match(/\d+/)?.[0] ?? '0')
    return numA - numB
  })

  return results
}

// ── PDF upload helper ─────────────────────────────────────────────────────────

function isGarbled(text: string): boolean {
  const s = text.replace(/\s/g, '')
  if (s.length < 30) return true
  const len = s.length
  const chunks = [s.slice(0, 300), s.slice(Math.floor(len * 0.4), Math.floor(len * 0.4) + 300), s.slice(Math.max(0, len - 300))]
  return chunks.some(c => {
    if (c.length < 20) return false
    let valid = 0
    for (const ch of c) {
      const cp = ch.codePointAt(0) ?? 0
      if ((cp >= 0x20 && cp <= 0x7E) || (cp >= 0xC0 && cp <= 0x024F) || (cp >= 0x1E00 && cp <= 0x1EFF)) valid++
    }
    return valid / c.length < 0.65
  })
}

async function readFile(file: File, onStatus: (s: string) => void): Promise<string> {
  if (file.name.toLowerCase().endsWith('.txt')) {
    return new Promise(resolve => {
      const r = new FileReader()
      r.onload = e => resolve(e.target?.result as string)
      r.readAsText(file, 'UTF-8')
    })
  }
  if (file.name.toLowerCase().endsWith('.pdf')) {
    onStatus('Đang đọc PDF…')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/seo/extract-pdf', { method: 'POST', body: form })
    const data = await res.json()
    if (res.ok && data.text && !isGarbled(data.text)) return data.text

    // OCR fallback
    onStatus('Chuyển sang OCR…')
    const [pdfjsLib, { createWorker }] = await Promise.all([import('pdfjs-dist'), import('tesseract.js')])
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
    const worker = await createWorker('vie', 1, { logger: () => {} })
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
    const pages: string[] = []
    for (let p = 1; p <= pdf.numPages; p++) {
      onStatus(`OCR trang ${p}/${pdf.numPages}…`)
      const page = await pdf.getPage(p)
      const viewport = page.getViewport({ scale: 3 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width; canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise
      const { data: { text } } = await worker.recognize(canvas)
      pages.push(text); page.cleanup()
    }
    await worker.terminate()
    return pages.join('\n\n')
  }
  throw new Error('Chỉ hỗ trợ .pdf hoặc .txt')
}

// ── UI helpers ────────────────────────────────────────────────────────────────

const TYPE_CFG = {
  modified: { label: 'Thay đổi', bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', icon: <RefreshCw size={13} className="text-yellow-600" /> },
  added:    { label: 'Mới thêm', bg: 'bg-green-50 border-green-200',  badge: 'bg-green-100 text-green-700',   icon: <Plus size={13} className="text-green-600" /> },
  removed:  { label: 'Bị xóa',  bg: 'bg-red-50 border-red-200',      badge: 'bg-red-100 text-red-600',       icon: <Minus size={13} className="text-red-600" /> },
  unchanged:{ label: 'Giữ nguyên', bg: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-500',     icon: null },
}

function DiffView({ tokens, oldText, newText, type }: { tokens: DiffToken[]; oldText: string; newText: string; type: ChangeType }) {
  if (type === 'added') return <p className="text-sm text-green-800 leading-relaxed whitespace-pre-wrap">{newText}</p>
  if (type === 'removed') return <p className="text-sm text-red-700 leading-relaxed line-through whitespace-pre-wrap">{oldText}</p>
  if (type === 'unchanged') return <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{newText}</p>

  return (
    <p className="text-sm leading-relaxed">
      {tokens.map((t, i) => (
        t.kind === 'same'
          ? <span key={i}>{t.text} </span>
          : t.kind === 'add'
          ? <mark key={i} className="bg-green-200 text-green-900 rounded px-0.5 mx-0.5 no-underline">{t.text} </mark>
          : <del key={i} className="bg-red-100 text-red-600 rounded px-0.5 mx-0.5">{t.text} </del>
      ))}
    </p>
  )
}

function ArticleCard({ diff }: { diff: ArticleDiff }) {
  const [open, setOpen] = useState(diff.type !== 'unchanged')
  const cfg = TYPE_CFG[diff.type]
  return (
    <div className={cn('rounded-xl border overflow-hidden', cfg.bg)}>
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:brightness-95 transition-all"
        onClick={() => setOpen(v => !v)}>
        {cfg.icon}
        <span className="font-semibold text-sm text-gray-800">{diff.label}</span>
        <span className={cn('text-[10px] font-medium rounded px-2 py-0.5 border', cfg.badge)}>{cfg.label}</span>
        {diff.type === 'modified' && (
          <span className="text-[10px] text-gray-400 ml-1">tương đồng {diff.similarity}%</span>
        )}
        <span className="ml-auto">{open ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-current/10 pt-3">
          {diff.type === 'modified' && (
            <div className="flex gap-2 text-[10px] mb-3">
              <span className="bg-green-100 text-green-700 rounded px-1.5 py-0.5">● Thêm mới</span>
              <span className="bg-red-100 text-red-600 rounded px-1.5 py-0.5">● Bị xóa</span>
            </div>
          )}
          <DiffView tokens={diff.tokens} oldText={diff.oldText} newText={diff.newText} type={diff.type} />
        </div>
      )}
    </div>
  )
}

// ── Upload panel ──────────────────────────────────────────────────────────────

interface UploadPanelProps {
  label: string
  accent: string
  text: string
  status: string
  onText: (t: string) => void
  onStatus: (s: string) => void
}

function UploadPanel({ label, accent, text, status, onText, onStatus }: UploadPanelProps) {
  const ref = useRef<HTMLInputElement>(null)
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
    try { onText(await readFile(file, onStatus)) } catch (err: unknown) { onStatus('Lỗi: ' + (err instanceof Error ? err.message : String(err))) }
    onStatus('')
  }
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-bold uppercase tracking-wide', accent)}>{label}</span>
        <div>
          <input ref={ref} type="file" accept=".pdf,.txt" className="hidden" onChange={handleFile} />
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" disabled={!!status}
            onClick={() => ref.current?.click()}>
            {status
              ? <><Loader2 size={11} className="animate-spin" /><span className="truncate max-w-[140px]">{status}</span></>
              : <><Upload size={11} />Upload PDF / TXT</>}
          </Button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={e => onText(e.target.value)}
        placeholder={`Paste nội dung ${label.toLowerCase()} vào đây, hoặc upload file…`}
        className="w-full border rounded-lg p-3 text-xs font-mono min-h-[200px] outline-none focus:ring-2 focus:ring-blue-200 resize-y bg-white"
      />
      <p className="text-[10px] text-gray-400">
        {text.trim() ? `${text.trim().split(/\s+/).length} từ · ${extractArticles(text).size} điều phát hiện` : ''}
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type FilterType = 'all' | ChangeType

export default function LegalDiffPage() {
  const [oldText, setOldText] = useState('')
  const [newText, setNewText] = useState('')
  const [oldStatus, setOldStatus] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [diffs, setDiffs] = useState<ArticleDiff[] | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [error, setError] = useState('')

  function handleCompare() {
    if (!oldText.trim() || !newText.trim()) { setError('Cần nhập cả 2 văn bản'); return }
    const oldArticles = extractArticles(oldText)
    const newArticles = extractArticles(newText)
    if (oldArticles.size === 0 && newArticles.size === 0) {
      setError('Không tìm thấy cấu trúc Điều/Khoản trong cả hai văn bản. Kiểm tra định dạng văn bản có "Điều X..." không.')
      return
    }
    setError('')
    setDiffs(compareDocuments(oldText, newText))
    setFilter('all')
  }

  const counts = diffs ? {
    modified: diffs.filter(d => d.type === 'modified').length,
    added:    diffs.filter(d => d.type === 'added').length,
    removed:  diffs.filter(d => d.type === 'removed').length,
    unchanged:diffs.filter(d => d.type === 'unchanged').length,
  } : null

  const visible = diffs ? (filter === 'all' ? diffs.filter(d => d.type !== 'unchanged') : diffs.filter(d => d.type === filter)) : []

  const FILTERS: { key: FilterType; label: string; count?: number; color: string }[] = [
    { key: 'all',       label: 'Có thay đổi', count: counts ? counts.modified + counts.added + counts.removed : undefined, color: 'bg-gray-900 text-white' },
    { key: 'modified',  label: 'Thay đổi',    count: counts?.modified,   color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    { key: 'added',     label: 'Mới thêm',    count: counts?.added,      color: 'bg-green-100 text-green-700 border-green-200' },
    { key: 'removed',   label: 'Bị xóa',      count: counts?.removed,    color: 'bg-red-100 text-red-600 border-red-200' },
    { key: 'unchanged', label: 'Giữ nguyên',  count: counts?.unchanged,  color: 'bg-gray-100 text-gray-500 border-gray-200' },
  ]

  return (
    <div className="p-6 md:p-8 pb-16">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Đối chiếu văn bản pháp lý</h1>
        <p className="text-sm text-gray-500 mt-0.5">So sánh thông tư / nghị định cũ và mới — highlight từng điểm thay đổi, thêm, xóa</p>
      </div>

      {/* Input panels */}
      {!diffs && (
        <div className="space-y-4">
          <div className="flex gap-4 items-stretch">
            <UploadPanel label="Văn bản CŨ" accent="text-red-500" text={oldText} status={oldStatus} onText={setOldText} onStatus={setOldStatus} />
            <div className="flex items-center pt-8 shrink-0">
              <ArrowLeftRight size={18} className="text-gray-300" />
            </div>
            <UploadPanel label="Văn bản MỚI" accent="text-green-600" text={newText} status={newStatus} onText={setNewText} onStatus={setNewStatus} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <Button onClick={handleCompare} disabled={!!oldStatus || !!newStatus} className="gap-2">
            <ArrowLeftRight size={14} />So sánh thay đổi
          </Button>
        </div>
      )}

      {/* Results */}
      {diffs && counts && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{counts.modified}</p>
                <p className="text-xs text-yellow-500 mt-0.5">Điều thay đổi</p>
              </div>
              <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{counts.added}</p>
                <p className="text-xs text-green-500 mt-0.5">Điều mới thêm</p>
              </div>
              <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{counts.removed}</p>
                <p className="text-xs text-red-500 mt-0.5">Điều bị xóa</p>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-center">
                <p className="text-2xl font-bold text-gray-500">{counts.unchanged}</p>
                <p className="text-xs text-gray-400 mt-0.5">Giữ nguyên</p>
              </div>
            </div>

            {/* Bullet summary of changed articles */}
            {(counts.modified + counts.added + counts.removed) > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 text-sm">
                <p className="font-semibold text-gray-700 mb-2">Tóm tắt thay đổi</p>
                <ul className="space-y-1 text-gray-600">
                  {diffs.filter(d => d.type === 'added').map(d => (
                    <li key={d.key} className="flex items-start gap-2">
                      <span className="text-green-500 font-bold shrink-0">+</span>
                      <span><strong>{d.label}</strong>: điều mới hoàn toàn trong văn bản mới</span>
                    </li>
                  ))}
                  {diffs.filter(d => d.type === 'removed').map(d => (
                    <li key={d.key} className="flex items-start gap-2">
                      <span className="text-red-500 font-bold shrink-0">−</span>
                      <span><strong>{d.label}</strong>: bị xóa khỏi văn bản mới</span>
                    </li>
                  ))}
                  {diffs.filter(d => d.type === 'modified').map(d => (
                    <li key={d.key} className="flex items-start gap-2">
                      <span className="text-yellow-500 font-bold shrink-0">~</span>
                      <span><strong>{d.label}</strong>: nội dung thay đổi {100 - d.similarity}% ({d.similarity}% giữ nguyên)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map(f => (
              <button key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  filter === f.key ? f.color : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                )}>
                {f.label}
                {f.count !== undefined && <span className="font-bold">{f.count}</span>}
              </button>
            ))}
            <button onClick={() => setDiffs(null)}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <RefreshCw size={11} />So sánh lại
            </button>
          </div>

          {/* Article list */}
          <div className="space-y-2">
            {visible.length === 0
              ? <p className="text-sm text-gray-400 py-4 text-center">Không có điều nào trong nhóm này</p>
              : visible.map(d => <ArticleCard key={d.key} diff={d} />)}
          </div>
        </div>
      )}
    </div>
  )
}
