'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, RotateCcw, Upload, Loader2 } from 'lucide-react'

interface KeyPoint {
  id: number
  article: string
  content: string
  importance: 'high' | 'medium' | 'low'
  category: string
}

interface DocumentInfo {
  title: string
  type: string
  number: string
  issued_by: string
  effective_date: string
}

interface ExtractResult {
  document_info: DocumentInfo
  key_points: KeyPoint[]
  summary: string
}

interface ComparisonItem {
  id: number
  key_point: string
  status: 'covered' | 'partial' | 'missing'
  found_in_article: string
  suggestion: string
}

interface CompareResult {
  overall_status: string
  coverage_score: number
  comparison: ComparisonItem[]
  missing_points: { id: number; content: string; suggested_addition: string }[]
}

type Step = 'input' | 'extracted' | 'compare'

const VN_STOP = new Set(['và', 'là', 'của', 'cho', 'trong', 'có', 'không', 'này', 'với', 'các', 'được', 'về', 'theo', 'từ', 'để', 'một', 'những', 'thì', 'khi', 'đó', 'tại', 'đến', 'hoặc', 'vì', 'nếu', 'như', 'cũng', 'đây', 'hay', 'lại', 'đã', 'đang', 'sẽ', 'bị', 'do', 'mà', 'còn', 'mọi', 'rất', 'hơn', 'nhất', 'bạn', 'tôi', 'việc', 'ngày', 'năm', 'sau', 'trên', 'dưới', 'ngoài', 'phải', 'cần', 'nên'])
const REQUIREMENT_WORDS = ['phải', 'cần', 'bắt buộc', 'không được', 'cấm', 'có trách nhiệm', 'có nghĩa vụ', 'quy định', 'yêu cầu', 'bị xử phạt', 'chịu trách nhiệm']
const IMPORTANCE_COLOR = { high: 'bg-red-50 border-red-200', medium: 'bg-yellow-50 border-yellow-200', low: 'bg-gray-50 border-gray-200' }
const STATUS_CFG = {
  covered: { label: 'Có', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  partial: { label: 'Một phần', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  missing: { label: 'Thiếu', color: 'bg-red-100 text-red-600', icon: XCircle },
}

function extractKeyPoints(text: string): ExtractResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Document info
  const titleLine = lines.find(l => /thông tư|nghị định|quyết định|luật|quy định|thông báo/i.test(l)) || lines[0] || ''
  const numLine = lines.find(l => /số[:\s]+[\d/\w-]{3,}/i.test(l)) || ''
  const numMatch = numLine.match(/số[:\s]+([\d/\w-]+)/i)
  const issuedLine = lines.find(l => /bộ|ủy ban|chính phủ|sở|cục|tổng cục|ban/i.test(l) && l.length < 80) || ''
  const dateLine = lines.find(l => /ngày.*tháng.*năm|có hiệu lực/i.test(l)) || ''

  const docType = /thông tư/i.test(titleLine) ? 'Thông tư'
    : /nghị định/i.test(titleLine) ? 'Nghị định'
    : /quyết định/i.test(titleLine) ? 'Quyết định'
    : /luật/i.test(titleLine) ? 'Luật'
    : 'Văn bản'

  const keyPoints: KeyPoint[] = []
  let id = 0
  let currentArticle = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match "Điều X..." pattern
    if (/^điều\s+\d+/i.test(line)) {
      currentArticle = line.match(/^(điều\s+\d+[a-zàáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]*)/i)?.[1] || line.slice(0, 20)
      const content = line.length > 40 ? line : `${line} ${lines[i + 1] || ''}`.trim()
      const hasReq = REQUIREMENT_WORDS.some(w => content.toLowerCase().includes(w))
      if (content.length > 20) {
        id++
        keyPoints.push({
          id,
          article: currentArticle,
          content: content.slice(0, 250),
          importance: hasReq ? 'high' : 'medium',
          category: hasReq ? 'quy định' : 'định nghĩa',
        })
      }
    }
    // Match "1. Nội dung..." with requirement words
    else if (/^\d+\.\s+\S/.test(line) && REQUIREMENT_WORDS.some(w => line.toLowerCase().includes(w))) {
      const khoasn = line.match(/^(\d+)\./)?.[1]
      id++
      keyPoints.push({
        id,
        article: currentArticle ? `${currentArticle}, Khoản ${khoasn}` : `Khoản ${khoasn}`,
        content: line.slice(0, 250),
        importance: 'medium',
        category: 'yêu cầu',
      })
    }
    // Match "a) b) c)" sub-items with requirements
    else if (/^[a-z]\)\s+\S/.test(line) && REQUIREMENT_WORDS.some(w => line.toLowerCase().includes(w))) {
      id++
      keyPoints.push({
        id,
        article: currentArticle || 'Điểm',
        content: line.slice(0, 250),
        importance: 'low',
        category: 'yêu cầu',
      })
    }
  }

  // Fallback: extract sentences with requirement words
  if (keyPoints.length === 0) {
    const sentences = text.split(/[.;]\s+/).filter(s => s.trim().length > 30)
    sentences
      .filter(s => REQUIREMENT_WORDS.some(w => s.toLowerCase().includes(w)))
      .slice(0, 15)
      .forEach(s => {
        id++
        keyPoints.push({ id, article: `Đoạn ${id}`, content: s.trim().slice(0, 250), importance: 'medium', category: 'quy định' })
      })
  }

  const summary = keyPoints.length > 0
    ? `Trích xuất được ${keyPoints.length} ý chính. Kiểm tra và chỉnh sửa danh sách nếu cần trước khi đối chiếu bài viết.`
    : 'Không tìm thấy điều/khoản có cấu trúc rõ ràng. Thử paste văn bản với định dạng "Điều X..." hoặc "1. Quy định..."'

  return {
    document_info: {
      title: titleLine.slice(0, 120),
      type: docType,
      number: numMatch?.[1] || '',
      issued_by: issuedLine.slice(0, 80),
      effective_date: dateLine.replace(/.*ngày\s+/i, '').slice(0, 40),
    },
    key_points: keyPoints,
    summary,
  }
}

function compareArticle(keyPoints: KeyPoint[], articleContent: string): CompareResult {
  const artLower = articleContent.toLowerCase()

  const comparison: ComparisonItem[] = keyPoints.map(pt => {
    const ptWords = pt.content.toLowerCase().split(/\s+/)
      .filter(w => w.length > 3 && !VN_STOP.has(w))
      .map(w => w.replace(/[^a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/gi, ''))
      .filter(w => w.length > 2)
    const unique = [...new Set(ptWords)].slice(0, 6)

    const foundWords = unique.filter(w => artLower.includes(w))
    const coverage = unique.length > 0 ? foundWords.length / unique.length : 0

    const status: 'covered' | 'partial' | 'missing' =
      coverage >= 0.65 ? 'covered' : coverage >= 0.3 ? 'partial' : 'missing'

    let foundInArticle = ''
    for (const w of foundWords) {
      const idx = artLower.indexOf(w)
      if (idx !== -1) {
        foundInArticle = articleContent.slice(Math.max(0, idx - 40), idx + 120).trim().replace(/\s+/g, ' ')
        break
      }
    }

    return {
      id: pt.id,
      key_point: pt.content,
      status,
      found_in_article: foundInArticle,
      suggestion: status !== 'covered' ? `Bổ sung nội dung về: "${pt.content.slice(0, 100)}..."` : '',
    }
  })

  const covered = comparison.filter(c => c.status === 'covered').length
  const partial = comparison.filter(c => c.status === 'partial').length
  const coverageScore = comparison.length > 0
    ? Math.round((covered + partial * 0.5) / comparison.length * 100) : 0

  const missing = comparison.filter(c => c.status === 'missing')

  return {
    overall_status: coverageScore >= 80 ? 'Đầy đủ' : coverageScore >= 50 ? 'Thiếu một số điểm' : 'Thiếu nhiều điểm',
    coverage_score: coverageScore,
    comparison,
    missing_points: missing.map((c, i) => ({
      id: i + 1,
      content: c.key_point,
      suggested_addition: `Thêm đoạn giải thích về: ${c.key_point.slice(0, 120)}`,
    })),
  }
}

// ------- UI -------

const STEPS: { key: Step; label: string }[] = [
  { key: 'input', label: '1. Paste văn bản' },
  { key: 'extracted', label: '2. Xem ý chính' },
  { key: 'compare', label: '3. Đối chiếu bài' },
]

// ── PDF helpers ───────────────────────────────────────────────────────────────

function sampleGarbledRatio(chunk: string): number {
  if (!chunk) return 1
  let valid = 0
  for (const ch of chunk) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp >= 0x20 && cp <= 0x7E) { valid++; continue }
    if (cp >= 0xC0 && cp <= 0x024F) { valid++; continue }
    if (cp >= 0x1E00 && cp <= 0x1EFF) { valid++; continue }
    if (cp >= 0x2000 && cp <= 0x206F) { valid++; continue }
  }
  return 1 - valid / chunk.length
}

function isGarbled(text: string): boolean {
  const s = text.replace(/\s/g, '')
  if (s.length < 30) return true
  const len = s.length
  // Sample 4 points spread across the document
  const chunks = [
    s.slice(0, 300),
    s.slice(Math.floor(len * 0.25), Math.floor(len * 0.25) + 300),
    s.slice(Math.floor(len * 0.55), Math.floor(len * 0.55) + 300),
    s.slice(Math.max(0, len - 300)),
  ]
  // Garbled if ANY chunk has >35% invalid chars (catches partial-encoding PDFs)
  return chunks.some(c => c.length > 20 && sampleGarbledRatio(c) > 0.35)
}

async function ocrPdf(
  file: File,
  onProgress: (msg: string) => void,
): Promise<string> {
  onProgress('Đang tải thư viện OCR (lần đầu ~30s)…')
  const [pdfjsLib, { createWorker }] = await Promise.all([
    import('pdfjs-dist'),
    import('tesseract.js'),
  ])
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  onProgress('Đang khởi động OCR tiếng Việt…')
  const worker = await createWorker('vie', 1, { logger: () => {} })
  await worker.setParameters({ tessedit_pageseg_mode: '3' } as Parameters<typeof worker.setParameters>[0])

  const buffer = await file.arrayBuffer()
  onProgress('Đang đọc cấu trúc PDF…')
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  const pages: string[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress(`OCR trang ${p}/${pdf.numPages}…`)
    const page = await pdf.getPage(p)
    const viewport = page.getViewport({ scale: 3 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise
    const { data: { text } } = await worker.recognize(canvas)
    pages.push(text)
    page.cleanup()
  }

  await worker.terminate()
  return pages.join('\n\n')
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LegalAnalyzerPage() {
  const [step, setStep] = useState<Step>('input')
  const [legalText, setLegalText] = useState('')
  const [articleContent, setArticleContent] = useState('')
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null)
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null)
  const [error, setError] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [fileStatus, setFileStatus] = useState('')   // '' = idle, any string = loading msg
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError('')

    if (file.name.toLowerCase().endsWith('.txt')) {
      const reader = new FileReader()
      reader.onload = ev => { setLegalText(ev.target?.result as string) }
      reader.readAsText(file, 'UTF-8')
      return
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Chỉ hỗ trợ file .pdf hoặc .txt')
      return
    }

    setFileStatus('Đang đọc PDF…')
    try {
      // Step 1: try fast server-side text extraction
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/seo/extract-pdf', { method: 'POST', body: form })
      const data = await res.json()

      if (res.ok && data.text && !isGarbled(data.text)) {
        // Clean text — done
        setLegalText(data.text)
        setFileStatus('')
        return
      }

      // Step 2: font encoding issue → fall back to OCR
      setFileStatus('Font bị mã hóa, chuyển sang OCR…')
      const ocrText = await ocrPdf(file, msg => setFileStatus(msg))
      if (!ocrText.trim()) {
        setError('Không đọc được text. PDF này có thể là bản scan ảnh mờ.')
      } else {
        setLegalText(ocrText)
      }
    } catch (err: unknown) {
      setError('Lỗi: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setFileStatus('')
    }
  }

  function handleExtract() {
    if (!legalText.trim()) { setError('Vui lòng paste nội dung văn bản pháp lý'); return }
    if (legalText.trim().length < 100) { setError('Văn bản quá ngắn'); return }
    setError('')
    setExtractResult(extractKeyPoints(legalText))
    setStep('extracted')
  }

  function handleCompare() {
    if (!articleContent.trim()) { setError('Vui lòng paste bài viết'); return }
    if (!extractResult) return
    setError('')
    setCompareResult(compareArticle(extractResult.key_points, articleContent))
    setStep('compare')
  }

  function reset() {
    setStep('input')
    setLegalText('')
    setArticleContent('')
    setExtractResult(null)
    setCompareResult(null)
    setError('')
    setExpandedIds(new Set())
    setFileStatus('')
  }

  function toggleExpand(id: number) {
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const scoreColor = compareResult
    ? compareResult.coverage_score >= 80 ? 'text-green-600'
      : compareResult.coverage_score >= 60 ? 'text-yellow-600'
      : 'text-red-500'
    : ''

  return (
    <div className="p-6 md:p-8 pb-16">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Legal Document Analyzer</h1>
          <p className="text-sm text-gray-500 mt-0.5">Paste văn bản pháp lý → Trích xuất ý chính → Đối chiếu bài viết</p>
        </div>
        {step !== 'input' && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={reset}>
            <RotateCcw size={13} />Làm lại
          </Button>
        )}
      </div>

      {/* Stepper — fixed key on Fragment */}
      <div className="flex items-center gap-2 mb-7 text-sm">
        {STEPS.map((s, i) => {
          const stepIndex = STEPS.findIndex(x => x.key === step)
          const done = i < stepIndex
          const active = step === s.key
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                active ? 'bg-gray-900 text-white' : done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
              )}>{s.label}</div>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-gray-200" />}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Step 1: Paste legal text */}
      {step === 'input' && (
        <div className="max-w-2xl space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
            <strong>Cách dùng:</strong> Upload file PDF hoặc TXT trực tiếp — tool tự đọc text. Hoặc mở PDF, chọn tất cả (Ctrl+A), copy và paste vào đây. Tool sẽ tự nhận dạng Điều/Khoản và trích xuất ý chính.
          </div>
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept=".pdf,.txt" className="hidden" onChange={handleFileUpload} />
            <Button variant="outline" size="sm" className="gap-1.5 min-w-[160px]" disabled={!!fileStatus}
              onClick={() => fileInputRef.current?.click()}>
              {fileStatus
                ? <><Loader2 size={13} className="animate-spin shrink-0" /><span className="truncate max-w-[180px]">{fileStatus}</span></>
                : <><Upload size={13} />Upload PDF / TXT</>}
            </Button>
            {!fileStatus && <span className="text-xs text-gray-400">hoặc paste nội dung bên dưới</span>}
          </div>
          <Textarea
            value={legalText}
            onChange={e => setLegalText(e.target.value)}
            placeholder={'Paste nội dung văn bản pháp lý vào đây...\n\nVí dụ:\nĐiều 1. Phạm vi điều chỉnh\nThông tư này quy định về...\n\nĐiều 2. Đối tượng áp dụng\n1. Thông tư này áp dụng cho...\n2. Tổ chức, cá nhân phải thực hiện...'}
            className="min-h-[300px] text-sm font-mono"
          />
          <p className="text-xs text-gray-400">
            {legalText.trim() ? `${legalText.trim().split(/\s+/).filter(Boolean).length} từ` : ''}
          </p>
          <Button onClick={handleExtract}>Trích xuất ý chính</Button>
        </div>
      )}

      {/* Step 2: Show extracted key points */}
      {step === 'extracted' && extractResult && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <p className="font-semibold text-gray-900">{extractResult.document_info.title || 'Văn bản pháp lý'}</p>
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
              <span>{extractResult.document_info.type}</span>
              {extractResult.document_info.number && <span>· Số {extractResult.document_info.number}</span>}
              {extractResult.document_info.issued_by && <span>· {extractResult.document_info.issued_by}</span>}
            </div>
            <p className="text-sm text-gray-600 mt-2">{extractResult.summary}</p>
          </div>

          {extractResult.key_points.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-sm text-yellow-800">
              Không trích xuất được ý chính tự động. Văn bản của bạn có thể không có cấu trúc Điều/Khoản rõ ràng. Hãy thử định dạng lại với "Điều 1..." hoặc "1. ..."
            </div>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-gray-700">{extractResult.key_points.length} ý chính được trích xuất</h2>
              <div className="space-y-2">
                {extractResult.key_points.map(pt => (
                  <div key={pt.id} className={cn('border rounded-lg p-3 text-sm', IMPORTANCE_COLOR[pt.importance])}>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-gray-400 text-xs mt-0.5 shrink-0">#{pt.id}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-xs text-gray-500 font-medium">{pt.article}</span>
                          <span className="text-[10px] bg-white border rounded px-1.5 py-0.5 text-gray-500">{pt.category}</span>
                          {pt.importance === 'high' && <span className="text-[10px] bg-red-100 text-red-600 rounded px-1.5 py-0.5 font-medium">Quan trọng</span>}
                        </div>
                        <p className="text-gray-800 leading-relaxed">{pt.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Bước 2: Paste bài viết cần đối chiếu</h2>
            <Textarea
              value={articleContent}
              onChange={e => setArticleContent(e.target.value)}
              placeholder="Paste toàn bộ nội dung bài viết vào đây..."
              className="min-h-[180px] text-sm"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-400">
                {articleContent.trim() ? `${articleContent.trim().split(/\s+/).filter(Boolean).length} từ` : ''}
              </span>
              <Button onClick={handleCompare} disabled={!articleContent.trim() || extractResult.key_points.length === 0}>
                Đối chiếu ngay
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Compare results */}
      {step === 'compare' && compareResult && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">Độ phủ</p>
              <p className={cn('text-4xl font-bold', scoreColor)}>{compareResult.coverage_score}%</p>
              <p className="text-sm text-gray-600 mt-1">{compareResult.overall_status}</p>
            </div>
            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">Điểm thiếu</p>
              <p className="text-4xl font-bold text-red-500">{compareResult.missing_points.length}</p>
              <p className="text-sm text-gray-600 mt-1">ý chính chưa có trong bài</p>
            </div>
            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">Có đề cập</p>
              <p className="text-4xl font-bold text-green-600">{compareResult.comparison.filter(c => c.status === 'covered').length}</p>
              <p className="text-sm text-gray-600 mt-1">ý chính bài đã bao phủ</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Chi tiết đối chiếu từng ý</h2>
            </div>
            <div className="divide-y">
              {compareResult.comparison.map(item => {
                const cfg = STATUS_CFG[item.status]
                const Icon = cfg.icon
                const isOpen = expandedIds.has(item.id)
                return (
                  <div key={item.id} className="px-4 py-3">
                    <button className="w-full flex items-start gap-3 text-left" onClick={() => toggleExpand(item.id)}>
                      <Icon size={16} className={cn('shrink-0 mt-0.5',
                        item.status === 'covered' ? 'text-green-500' : item.status === 'partial' ? 'text-yellow-500' : 'text-red-500')} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('text-[10px] font-medium rounded px-1.5 py-0.5', cfg.color)}>{cfg.label}</span>
                          <span className="text-xs text-gray-500">Ý #{item.id}</span>
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5 line-clamp-2">{item.key_point}</p>
                      </div>
                      {isOpen ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
                    </button>
                    {isOpen && (
                      <div className="mt-3 ml-7 space-y-2 text-sm">
                        {item.found_in_article && (
                          <div className="bg-green-50 border border-green-100 rounded p-2.5">
                            <p className="text-xs font-medium text-green-700 mb-1">Tìm thấy trong bài:</p>
                            <p className="text-green-800 italic">"{item.found_in_article}"</p>
                          </div>
                        )}
                        {item.suggestion && (
                          <div className="bg-blue-50 border border-blue-100 rounded p-2.5">
                            <p className="text-xs font-medium text-blue-700 mb-1">Gợi ý:</p>
                            <p className="text-blue-800">{item.suggestion}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {compareResult.missing_points.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-red-50">
                <h2 className="text-sm font-semibold text-red-700">Ý chính còn thiếu trong bài ({compareResult.missing_points.length})</h2>
              </div>
              <div className="divide-y">
                {compareResult.missing_points.map(pt => (
                  <div key={pt.id} className="px-4 py-4 space-y-2">
                    <p className="text-sm font-medium text-gray-800">{pt.content}</p>
                    <div className="bg-gray-50 rounded p-2.5 text-xs text-gray-500">{pt.suggested_addition}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Đối chiếu với bài viết khác</h3>
            <Textarea value={articleContent} onChange={e => setArticleContent(e.target.value)}
              placeholder="Paste bài viết mới..." className="min-h-[100px] text-sm" />
            <div className="flex justify-end mt-3">
              <Button onClick={handleCompare} size="sm" disabled={!articleContent.trim()}>Phân tích lại</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
