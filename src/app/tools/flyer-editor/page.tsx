'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Download, Type, Loader2, ChevronDown } from 'lucide-react'
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

// native SVG viewBox dimensions
const SVG_W = 1596.17
const SVG_H = 2413.95

function extractLines(textEl: Element): string {
  const tspans = Array.from(textEl.querySelectorAll('tspan'))
  const yMap = new Map<string, string>()
  tspans.forEach(ts => {
    const y = ts.getAttribute('y') ?? '0'
    yMap.set(y, (yMap.get(y) ?? '') + (ts.textContent ?? ''))
  })
  return Array.from(yMap.entries())
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([, t]) => t.trim())
    .join('\n')
}

function applyLines(textEl: Element, newText: string) {
  const tspans = Array.from(textEl.querySelectorAll('tspan'))
  const yGroups: Array<{ y: string; cls: string; x: string }> = []
  const seen = new Set<string>()
  tspans.forEach(ts => {
    const y = ts.getAttribute('y') ?? '0'
    if (!seen.has(y)) {
      seen.add(y)
      yGroups.push({ y, cls: ts.getAttribute('class') ?? '', x: ts.getAttribute('x') ?? '0' })
    }
  })
  tspans.forEach(ts => ts.remove())
  const lines = newText.split('\n')
  yGroups.forEach((g, i) => {
    const ts = textEl.ownerDocument!.createElementNS('http://www.w3.org/2000/svg', 'tspan')
    ts.setAttribute('x', g.x)
    ts.setAttribute('y', g.y)
    if (g.cls) ts.setAttribute('class', g.cls)
    ts.textContent = lines[i] ?? ''
    textEl.appendChild(ts)
  })
}

function serializeFull(doc: Document): string {
  const el = doc.documentElement
  el.removeAttribute('width')
  el.removeAttribute('height')
  const str = new XMLSerializer().serializeToString(doc)
  return str
}

export default function FlyerEditorPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [textValues, setTextValues] = useState<Record<number, string>>({})
  const [imgReplaced, setImgReplaced] = useState<Record<number, boolean>>({})
  const [activeSection, setActiveSection] = useState<'text' | 'images'>('text')
  const [previewSrc, setPreviewSrc] = useState('')
  const [dlOpen, setDlOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const svgDocRef = useRef<Document | null>(null)
  const blobRef = useRef('')

  function makeBlob(doc: Document): string {
    const str = serializeFull(doc)
    const blob = new Blob([str], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    if (blobRef.current) URL.revokeObjectURL(blobRef.current)
    blobRef.current = url
    return url
  }

  useEffect(() => {
    fetch(FLYER_PATH)
      .then(r => { if (!r.ok) throw new Error('Không tải được file SVG'); return r.text() })
      .then(text => {
        const parser = new DOMParser()
        const doc = parser.parseFromString(text, 'image/svg+xml')
        if (doc.querySelector('parsererror')) throw new Error('SVG không hợp lệ')
        svgDocRef.current = doc
        const textEls = doc.querySelectorAll('text')
        const vals: Record<number, string> = {}
        textEls.forEach((el, i) => { vals[i] = extractLines(el) })
        setTextValues(vals)
        setPreviewSrc(makeBlob(doc))
        setLoading(false)
      })
      .catch(e => { setLoadError((e as Error).message); setLoading(false) })
    return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleTextChange(idx: number, val: string) {
    setTextValues(prev => ({ ...prev, [idx]: val }))
    const doc = svgDocRef.current; if (!doc) return
    const el = doc.querySelectorAll('text')[idx]
    if (el) applyLines(el, val)
    setPreviewSrc(makeBlob(doc))
  }

  function handleImageReplace(imgIdx: number, file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      const doc = svgDocRef.current; if (!doc) return
      const el = doc.querySelectorAll('image')[imgIdx]
      if (!el) return
      el.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl)
      el.setAttribute('href', dataUrl)
      setImgReplaced(prev => ({ ...prev, [imgIdx]: true }))
      setPreviewSrc(makeBlob(doc))
    }
    reader.readAsDataURL(file)
  }

  function downloadSvg() {
    const doc = svgDocRef.current; if (!doc) return
    const str = serializeFull(doc)
    const blob = new Blob([str], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'tuyen-dung.svg'; a.click()
    URL.revokeObjectURL(url)
    setDlOpen(false)
  }

  async function downloadRaster(format: 'png' | 'jpg') {
    const doc = svgDocRef.current; if (!doc) return
    setExporting(true); setDlOpen(false)
    try {
      const str = serializeFull(doc)
      const blob = new Blob([str], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)

      const exportW = Math.round(SVG_W)
      const exportH = Math.round(SVG_H)

      const img = new Image()
      img.width = exportW; img.height = exportH
      await new Promise<void>((res, rej) => {
        img.onload = () => res(); img.onerror = rej; img.src = url
      })
      URL.revokeObjectURL(url)

      const canvas = document.createElement('canvas')
      canvas.width = exportW; canvas.height = exportH
      const ctx = canvas.getContext('2d')!
      if (format === 'jpg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, exportW, exportH) }
      ctx.drawImage(img, 0, 0, exportW, exportH)

      const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
      const quality = format === 'jpg' ? 0.92 : undefined
      const dataUrl = canvas.toDataURL(mime, quality)
      const a = document.createElement('a'); a.href = dataUrl; a.download = `tuyen-dung.${format}`; a.click()
    } catch {
      alert('Không thể xuất ảnh. Thử dùng tùy chọn SVG.')
    }
    setExporting(false)
  }

  return (
    // overflow-hidden here prevents the outer main from scrolling and creating blank space
    <div className="flex flex-col overflow-hidden" style={{ height: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <Type size={18} className="text-violet-500" />
          <span className="font-semibold text-gray-800 text-sm">Flyer Editor</span>
          <span className="text-gray-300 text-xs">|</span>
          <span className="text-gray-400 text-xs">Tờ rơi tuyển dụng VNCE</span>
        </div>

        {/* Download dropdown */}
        <div className="relative">
          <button
            onClick={() => setDlOpen(o => !o)}
            disabled={loading || !!loadError || exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-medium h-8"
          >
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {exporting ? 'Đang xuất…' : 'Tải xuống'}
            <ChevronDown size={12} className={cn('transition-transform', dlOpen && 'rotate-180')} />
          </button>
          {dlOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDlOpen(false)} />
              <div className="absolute right-0 top-9 z-20 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-36">
                {[
                  { label: 'SVG', fn: downloadSvg },
                  { label: 'PNG', fn: () => downloadRaster('png') },
                  { label: 'JPG', fn: () => downloadRaster('jpg') },
                ].map(({ label, fn }) => (
                  <button key={label} onClick={fn}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors">
                    <Download size={11} className="text-gray-400" />{label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 size={32} className="animate-spin text-violet-500 mx-auto" />
            <p className="text-sm text-gray-500">Đang tải tờ rơi (2.6 MB)…</p>
          </div>
        </div>
      )}

      {loadError && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-500 text-sm">{loadError}</p>
        </div>
      )}

      {/* Body — min-h-0 is critical: lets flex children shrink properly */}
      {!loading && !loadError && (
        <div className="flex flex-1 min-h-0">
          {/* Preview — scrolls only within this column */}
          <div className="flex-1 min-w-0 overflow-auto bg-gray-100 flex justify-center p-6 pt-8">
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt="Xem trước tờ rơi"
                className="rounded-2xl shadow-2xl h-auto"
                style={{ width: '100%', maxWidth: '680px' }}
              />
            ) : (
              <div className="w-full max-w-[680px] rounded-2xl bg-gray-200 animate-pulse" style={{ aspectRatio: `${SVG_W}/${SVG_H}` }} />
            )}
          </div>

          {/* Editor panel — fixed width, scrolls internally */}
          <div className="w-72 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
            <div className="flex border-b border-gray-200 shrink-0">
              {(['text', 'images'] as const).map(s => (
                <button key={s} onClick={() => setActiveSection(s)}
                  className={cn('flex-1 py-2.5 text-xs font-medium transition-colors',
                    activeSection === s ? 'text-violet-600 border-b-2 border-violet-500 bg-violet-50/40' : 'text-gray-500 hover:text-gray-700')}>
                  {s === 'text' ? `Văn bản (${TEXT_FIELDS.length})` : `Hình ảnh (${IMAGE_LABELS.length})`}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {activeSection === 'text' && TEXT_FIELDS.map(f => {
                const val = textValues[f.idx] ?? ''
                return (
                  <div key={f.idx}>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{f.label}</label>
                    <textarea
                      value={val}
                      rows={Math.max(1, Math.min(5, val.split('\n').length + 1))}
                      onChange={e => handleTextChange(f.idx, e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 resize-none leading-relaxed"
                    />
                  </div>
                )
              })}

              {activeSection === 'images' && IMAGE_LABELS.map(({ idx, label, size }) => (
                <div key={idx} className="p-3 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                    <p className="text-[10px] text-gray-300 mt-0.5">{size} px</p>
                  </div>
                  {imgReplaced[idx] && <p className="text-[10px] text-green-600 font-medium">✓ Đã thay ảnh mới</p>}
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 hover:border-violet-400 hover:bg-violet-50 cursor-pointer text-xs text-gray-500 transition-colors w-full">
                    <Upload size={12} className="shrink-0" />
                    <span>{imgReplaced[idx] ? 'Thay ảnh khác' : 'Chọn ảnh thay thế'}</span>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleImageReplace(idx, f) }} />
                  </label>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-gray-100 shrink-0">
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Chỉnh sửa xong nhấn <span className="font-semibold text-gray-500">Tải xuống</span> để chọn định dạng SVG · PNG · JPG.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
