'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Download, Type, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const FLYER_PATH = '/templates/tuyen-dung-vnce.svg'

const TEXT_FIELDS: Array<{ idx: number; label: string }> = [
  { idx: 0,  label: 'Tiêu đề lớn (Header)' },
  { idx: 1,  label: 'Vị trí tuyển dụng' },
  { idx: 2,  label: 'Tên công ty' },
  { idx: 3,  label: 'Địa chỉ công ty' },
  { idx: 4,  label: '"Mô tả công việc" — tiêu đề nhóm' },
  { idx: 5,  label: '"Yêu cầu chung" — tiêu đề nhóm' },
  { idx: 6,  label: '"Quyền lợi" — tiêu đề nhóm' },
  { idx: 7,  label: '"Liên hệ" — tiêu đề nhóm' },
  { idx: 8,  label: 'Nhãn ngày' },
  { idx: 9,  label: 'Thông tin website' },
  { idx: 10, label: 'Email ứng tuyển' },
  { idx: 11, label: 'Số lượng · Độ tuổi · Giới tính' },
  { idx: 13, label: 'Yêu cầu chi tiết' },
  { idx: 14, label: 'Quyền lợi chi tiết' },
  { idx: 15, label: 'Mô tả công việc chi tiết' },
]

const IMAGE_LABELS = [
  { idx: 0, label: 'Ảnh banner chính', size: '1280 × 625' },
  { idx: 1, label: 'Ảnh thứ 2', size: '626 × 417' },
  { idx: 2, label: 'Ảnh thứ 3', size: '725 × 489' },
]

// Extract full text from a <text> SVG element, grouped by y-value (each unique y = one line)
function extractLines(textEl: Element): string {
  const tspans = Array.from(textEl.querySelectorAll('tspan'))
  const yMap = new Map<string, string>()
  tspans.forEach(ts => {
    const y = ts.getAttribute('y') ?? '0'
    yMap.set(y, (yMap.get(y) ?? '') + (ts.textContent ?? ''))
  })
  return Array.from(yMap.entries())
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([, text]) => text.trim())
    .join('\n')
}

// Replace all tspans in a <text> element with simplified ones — one per original y-level
function applyLines(textEl: Element, newText: string) {
  const tspans = Array.from(textEl.querySelectorAll('tspan'))

  // Collect unique y-groups in order (preserving original y, class, x)
  const yGroups: Array<{ y: string; cls: string; x: string }> = []
  const seen = new Set<string>()
  tspans.forEach(ts => {
    const y = ts.getAttribute('y') ?? '0'
    if (!seen.has(y)) {
      seen.add(y)
      yGroups.push({
        y,
        cls: ts.getAttribute('class') ?? '',
        x: ts.getAttribute('x') ?? '0',
      })
    }
  })

  // Remove all existing tspans
  tspans.forEach(ts => ts.remove())

  const lines = newText.split('\n')
  const ns = 'http://www.w3.org/2000/svg'

  yGroups.forEach((g, i) => {
    const ts = textEl.ownerDocument!.createElementNS(ns, 'tspan')
    ts.setAttribute('x', g.x)
    ts.setAttribute('y', g.y)
    if (g.cls) ts.setAttribute('class', g.cls)
    ts.textContent = lines[i] ?? ''
    textEl.appendChild(ts)
  })
}

export default function FlyerEditorPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [textValues, setTextValues] = useState<Record<number, string>>({})
  const [imgReplaced, setImgReplaced] = useState<Record<number, boolean>>({})
  const [activeSection, setActiveSection] = useState<'text' | 'images'>('text')
  const previewRef = useRef<HTMLDivElement>(null)
  const previewWidthRef = useRef(400)

  function getSvg(): SVGSVGElement | null {
    return (previewRef.current?.querySelector('svg') as SVGSVGElement) ?? null
  }

  useEffect(() => {
    fetch(FLYER_PATH)
      .then(r => {
        if (!r.ok) throw new Error('Không tải được file SVG')
        return r.text()
      })
      .then(text => {
        const parser = new DOMParser()
        const doc = parser.parseFromString(text, 'image/svg+xml')
        if (doc.querySelector('parsererror')) throw new Error('SVG không hợp lệ')

        // Extract initial text values
        const textEls = doc.querySelectorAll('text')
        const vals: Record<number, string> = {}
        textEls.forEach((el, i) => { vals[i] = extractLines(el) })
        setTextValues(vals)

        // Set display width and inject into preview div
        const svgEl = doc.documentElement as unknown as SVGSVGElement
        svgEl.setAttribute('width', String(previewWidthRef.current))
        svgEl.removeAttribute('height')

        if (previewRef.current) {
          previewRef.current.innerHTML = new XMLSerializer().serializeToString(svgEl)
        }

        setLoading(false)
      })
      .catch(e => {
        setLoadError((e as Error).message)
        setLoading(false)
      })
  }, [])

  function handleTextChange(idx: number, val: string) {
    setTextValues(prev => ({ ...prev, [idx]: val }))
    const svg = getSvg()
    if (!svg) return
    const el = svg.querySelectorAll('text')[idx]
    if (el) applyLines(el, val)
  }

  function handleImageReplace(imgIdx: number, file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      const svg = getSvg()
      if (!svg) return
      const el = svg.querySelectorAll('image')[imgIdx]
      if (!el) return
      el.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl)
      el.setAttribute('href', dataUrl)
      setImgReplaced(prev => ({ ...prev, [imgIdx]: true }))
    }
    reader.readAsDataURL(file)
  }

  function handleDownload() {
    const svg = getSvg()
    if (!svg) return
    // Remove display width override so the SVG exports at native resolution
    const savedW = svg.getAttribute('width')
    svg.removeAttribute('width')
    const svgStr = new XMLSerializer().serializeToString(svg)
    if (savedW) svg.setAttribute('width', savedW)

    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tuyen-dung-edited.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh)', background: '#f0f0f2' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <Type size={18} className="text-violet-500" />
          <span className="font-semibold text-gray-800 text-sm">Flyer Editor</span>
          <span className="text-gray-300 text-xs">|</span>
          <span className="text-gray-400 text-xs">Tờ rơi tuyển dụng VNCE</span>
        </div>
        <Button
          onClick={handleDownload}
          disabled={loading || !!loadError}
          size="sm"
          className="gap-1.5 bg-violet-600 hover:bg-violet-700 h-8 text-xs"
        >
          <Download size={12} />Tải SVG
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 size={32} className="animate-spin text-violet-500 mx-auto" />
            <p className="text-sm text-gray-500">Đang tải tờ rơi (2.6 MB)…</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {loadError && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-red-500 text-sm font-medium">{loadError}</p>
            <p className="text-gray-400 text-xs">Đảm bảo file SVG đã được đặt trong public/templates/</p>
          </div>
        </div>
      )}

      {/* Main editor */}
      {!loading && !loadError && (
        <div className="flex flex-1 overflow-hidden">
          {/* SVG Preview */}
          <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
            <div
              ref={previewRef}
              className="bg-white rounded-xl shadow-2xl overflow-hidden shrink-0"
              style={{ maxWidth: '100%' }}
            />
          </div>

          {/* Editor panel */}
          <div className="w-72 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
            {/* Section tabs */}
            <div className="flex border-b border-gray-200 shrink-0">
              <button
                onClick={() => setActiveSection('text')}
                className={cn(
                  'flex-1 py-2.5 text-xs font-medium transition-colors',
                  activeSection === 'text'
                    ? 'text-violet-600 border-b-2 border-violet-500 bg-violet-50/40'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                Văn bản ({TEXT_FIELDS.length})
              </button>
              <button
                onClick={() => setActiveSection('images')}
                className={cn(
                  'flex-1 py-2.5 text-xs font-medium transition-colors',
                  activeSection === 'images'
                    ? 'text-violet-600 border-b-2 border-violet-500 bg-violet-50/40'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                Hình ảnh ({IMAGE_LABELS.length})
              </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* ── Text tab ── */}
              {activeSection === 'text' && TEXT_FIELDS.map(f => {
                const val = textValues[f.idx] ?? ''
                const rows = Math.max(1, Math.min(5, val.split('\n').length + 1))
                return (
                  <div key={f.idx}>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                      {f.label}
                    </label>
                    <textarea
                      value={val}
                      rows={rows}
                      onChange={e => handleTextChange(f.idx, e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 resize-none leading-relaxed"
                      placeholder="Nhập nội dung..."
                    />
                  </div>
                )
              })}

              {/* ── Images tab ── */}
              {activeSection === 'images' && IMAGE_LABELS.map(({ idx, label, size }) => (
                <div key={idx} className="p-3 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                    <p className="text-[10px] text-gray-300 mt-0.5">{size} px</p>
                  </div>
                  {imgReplaced[idx] && (
                    <p className="text-[10px] text-green-600 font-medium">✓ Đã thay ảnh mới</p>
                  )}
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 hover:border-violet-400 hover:bg-violet-50 cursor-pointer text-xs text-gray-500 transition-colors w-full">
                    <Upload size={12} className="shrink-0" />
                    <span>{imgReplaced[idx] ? 'Thay ảnh khác' : 'Chọn ảnh thay thế (JPG/PNG)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) handleImageReplace(idx, f)
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-3 border-t border-gray-100 shrink-0">
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Chỉnh sửa văn bản hoặc thay ảnh, sau đó nhấn <span className="font-semibold">Tải SVG</span> để xuất file.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
