'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Download, Type, Loader2, ChevronDown, Move, Maximize2, RotateCcw } from 'lucide-react'
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

// native SVG dimensions from viewBox
const SVG_W = 1596.17
const SVG_H = 2413.95

// original image element natural sizes
const IMAGE_META = [
  { idx: 0, label: 'Ảnh banner chính', size: '1280 × 625', w: 1280, h: 625 },
  { idx: 1, label: 'Ảnh thứ 2',        size: '626 × 417',  w: 626,  h: 417 },
  { idx: 2, label: 'Ảnh thứ 3',        size: '725 × 489',  w: 725,  h: 489 },
]

interface ImgTransform { tx: number; ty: number; sx: number; sy: number }

function parseTransform(str: string): ImgTransform {
  const t = str.match(/translate\(\s*([\d.+-]+)[,\s]+([\d.+-]+)\s*\)/)
  const s = str.match(/scale\(\s*([\d.+-]+)(?:[,\s]+([\d.+-]+))?\s*\)/)
  return {
    tx: t ? parseFloat(t[1]) : 0,
    ty: t ? parseFloat(t[2]) : 0,
    sx: s ? parseFloat(s[1]) : 1,
    sy: s ? (s[2] !== undefined ? parseFloat(s[2]) : parseFloat(s[1])) : 1,
  }
}

function buildTransform({ tx, ty, sx, sy }: ImgTransform) {
  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})`
}

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
    ts.setAttribute('x', g.x); ts.setAttribute('y', g.y)
    if (g.cls) ts.setAttribute('class', g.cls)
    ts.textContent = lines[i] ?? ''
    textEl.appendChild(ts)
  })
}

function getSvgString(doc: Document): string {
  const el = doc.documentElement
  el.removeAttribute('width'); el.removeAttribute('height')
  return new XMLSerializer().serializeToString(doc)
}

// Slider row component
function SliderRow({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 w-14 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-violet-500" />
      <span className="text-[10px] text-gray-500 w-10 text-right shrink-0 font-mono">{value.toFixed(2)}</span>
    </div>
  )
}

export default function FlyerEditorPage() {
  useEffect(() => {
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => { document.documentElement.style.overflow = prev }
  }, [])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [textValues, setTextValues] = useState<Record<number, string>>({})
  const [imgReplaced, setImgReplaced] = useState<Record<number, boolean>>({})
  const [imgTransforms, setImgTransforms] = useState<Record<number, ImgTransform>>({})
  const [originalTransforms, setOriginalTransforms] = useState<Record<number, ImgTransform>>({})
  const [expandedImg, setExpandedImg] = useState<number | null>(1) // default open img 1
  const [activeSection, setActiveSection] = useState<'text' | 'images'>('images') // default images
  const [previewSrc, setPreviewSrc] = useState('')
  const [dlOpen, setDlOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const svgDocRef = useRef<Document | null>(null)
  const blobRef = useRef('')

  function updatePreview(doc: Document) {
    const str = getSvgString(doc)
    const blob = new Blob([str], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    if (blobRef.current) URL.revokeObjectURL(blobRef.current)
    blobRef.current = url
    setPreviewSrc(url)
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

        // Parse image transforms
        const imgEls = doc.querySelectorAll('image')
        const transforms: Record<number, ImgTransform> = {}
        imgEls.forEach((el, i) => {
          transforms[i] = parseTransform(el.getAttribute('transform') ?? '')
        })
        setImgTransforms(transforms)
        setOriginalTransforms(transforms)

        updatePreview(doc)
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
    updatePreview(doc)
  }

  function applyImgTransform(imgIdx: number, t: ImgTransform) {
    const doc = svgDocRef.current; if (!doc) return
    const el = doc.querySelectorAll('image')[imgIdx]; if (!el) return
    el.setAttribute('transform', buildTransform(t))
    updatePreview(doc)
  }

  function handleTransformChange(imgIdx: number, patch: Partial<ImgTransform>) {
    setImgTransforms(prev => {
      const next = { ...prev[imgIdx], ...patch }
      applyImgTransform(imgIdx, next)
      return { ...prev, [imgIdx]: next }
    })
  }

  function handleImageReplace(imgIdx: number, file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      const doc = svgDocRef.current; if (!doc) return
      const el = doc.querySelectorAll('image')[imgIdx]; if (!el) return
      el.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl)
      el.setAttribute('href', dataUrl)
      setImgReplaced(prev => ({ ...prev, [imgIdx]: true }))
      updatePreview(doc)
    }
    reader.readAsDataURL(file)
  }

  // "Phủ toàn canvas" — scale image to cover the SVG canvas completely
  function handleFillCanvas(imgIdx: number) {
    const meta = IMAGE_META[imgIdx]; if (!meta) return
    const sx = SVG_W / meta.w
    const sy = SVG_H / meta.h
    const t: ImgTransform = { tx: 0, ty: 0, sx, sy }
    setImgTransforms(prev => ({ ...prev, [imgIdx]: t }))
    applyImgTransform(imgIdx, t)
  }

  // "Phủ chiều rộng" — fit width
  function handleFillWidth(imgIdx: number) {
    const meta = IMAGE_META[imgIdx]; if (!meta) return
    const s = SVG_W / meta.w
    const cur = imgTransforms[imgIdx] ?? { tx: 0, ty: 0, sx: s, sy: s }
    const t: ImgTransform = { ...cur, sx: s, sy: s }
    setImgTransforms(prev => ({ ...prev, [imgIdx]: t }))
    applyImgTransform(imgIdx, t)
  }

  // Reset transform to original
  function handleReset(imgIdx: number) {
    const orig = originalTransforms[imgIdx]; if (!orig) return
    setImgTransforms(prev => ({ ...prev, [imgIdx]: { ...orig } }))
    applyImgTransform(imgIdx, orig)
  }

  function downloadSvg() {
    const doc = svgDocRef.current; if (!doc) return
    const blob = new Blob([getSvgString(doc)], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'tuyen-dung.svg'; a.click()
    URL.revokeObjectURL(url); setDlOpen(false)
  }

  async function downloadRaster(format: 'png' | 'jpg') {
    const doc = svgDocRef.current; if (!doc) return
    setExporting(true); setDlOpen(false)
    try {
      const str = getSvgString(doc)
      const blob = new Blob([str], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.width = Math.round(SVG_W); img.height = Math.round(SVG_H)
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url })
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(SVG_W); canvas.height = Math.round(SVG_H)
      const ctx = canvas.getContext('2d')!
      if (format === 'jpg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
      ctx.drawImage(img, 0, 0)
      const dataUrl = canvas.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', format === 'jpg' ? 0.92 : undefined)
      const a = document.createElement('a'); a.href = dataUrl; a.download = `tuyen-dung.${format}`; a.click()
    } catch { alert('Không thể xuất ảnh. Thử dùng SVG.') }
    setExporting(false)
  }

  const t1 = imgTransforms[1]

  return (
    <div style={{ position: 'fixed', top: 0, left: '14rem', right: 0, bottom: 0, display: 'flex', flexDirection: 'column', background: '#f0f0f2', zIndex: 5 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <Type size={18} className="text-violet-500" />
          <span className="font-semibold text-gray-800 text-sm">Flyer Editor</span>
          <span className="text-gray-300 text-xs">|</span>
          <span className="text-gray-400 text-xs">Tờ rơi tuyển dụng VNCE</span>
        </div>
        <div className="relative">
          <button onClick={() => setDlOpen(o => !o)} disabled={loading || !!loadError || exporting}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-medium">
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {exporting ? 'Đang xuất…' : 'Tải xuống'}
            <ChevronDown size={12} className={cn('transition-transform', dlOpen && 'rotate-180')} />
          </button>
          {dlOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDlOpen(false)} />
              <div className="absolute right-0 top-9 z-20 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-36">
                {[
                  { label: 'SVG (vector)', fn: downloadSvg },
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

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 size={32} className="animate-spin text-violet-500 mx-auto" />
            <p className="text-sm text-gray-500">Đang tải tờ rơi (2.6 MB)…</p>
          </div>
        </div>
      )}
      {loadError && <div className="flex-1 flex items-center justify-center"><p className="text-red-500 text-sm">{loadError}</p></div>}

      {!loading && !loadError && (
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Preview */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: '32px' }}>
            {previewSrc
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={previewSrc} alt="Xem trước tờ rơi"
                  style={{ display: 'block', width: '100%', maxWidth: 820, height: 'auto', margin: '0 auto', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} />
              : <div style={{ width: '100%', maxWidth: 820, margin: '0 auto', aspectRatio: `${SVG_W}/${SVG_H}`, borderRadius: 16, background: '#e5e7eb' }} />
            }
          </div>

          {/* Editor panel */}
          <div className="w-80 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 shrink-0">
              {(['text', 'images'] as const).map(s => (
                <button key={s} onClick={() => setActiveSection(s)}
                  className={cn('flex-1 py-2.5 text-xs font-medium transition-colors',
                    activeSection === s ? 'text-violet-600 border-b-2 border-violet-500 bg-violet-50/40' : 'text-gray-500 hover:text-gray-700')}>
                  {s === 'text' ? `Văn bản (${TEXT_FIELDS.length})` : `Hình ảnh (${IMAGE_META.length})`}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* ── TEXT TAB ── */}
              {activeSection === 'text' && (
                <div className="p-4 space-y-5">
                  {TEXT_FIELDS.map(f => {
                    const val = textValues[f.idx] ?? ''
                    return (
                      <div key={f.idx}>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{f.label}</label>
                        <textarea value={val} rows={Math.max(1, Math.min(5, val.split('\n').length + 1))}
                          onChange={e => handleTextChange(f.idx, e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-violet-200 resize-none leading-relaxed" />
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── IMAGES TAB ── */}
              {activeSection === 'images' && (
                <div className="divide-y divide-gray-100">
                  {IMAGE_META.map(({ idx, label, size }) => {
                    const tr = imgTransforms[idx]
                    const isOpen = expandedImg === idx
                    return (
                      <div key={idx} className="bg-white">
                        {/* Image header — click to expand */}
                        <button onClick={() => setExpandedImg(isOpen ? null : idx)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{label}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{size} px{imgReplaced[idx] ? ' · ✓ đã thay' : ''}</p>
                          </div>
                          <ChevronDown size={14} className={cn('text-gray-400 transition-transform shrink-0', isOpen && 'rotate-180')} />
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-4 space-y-4 bg-gray-50/50">
                            {/* Upload */}
                            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 hover:border-violet-400 hover:bg-violet-50 cursor-pointer text-xs text-gray-500 transition-colors w-full">
                              <Upload size={12} className="shrink-0" />
                              <span>{imgReplaced[idx] ? 'Thay ảnh khác' : 'Tải ảnh thay thế lên'}</span>
                              <input type="file" accept="image/*" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageReplace(idx, f) }} />
                            </label>

                            {/* Quick actions */}
                            <div className="flex gap-1.5 flex-wrap">
                              <button onClick={() => handleFillWidth(idx)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-700 text-[10px] font-medium transition-colors">
                                <Maximize2 size={10} />Vừa rộng
                              </button>
                              <button onClick={() => handleFillCanvas(idx)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-700 text-[10px] font-medium transition-colors">
                                <Maximize2 size={10} />Phủ toàn bộ
                              </button>
                              <button onClick={() => handleReset(idx)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-medium transition-colors">
                                <RotateCcw size={10} />Reset
                              </button>
                            </div>

                            {/* Transform sliders */}
                            {tr && (
                              <div className="space-y-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
                                  <Move size={9} />Vị trí
                                </p>
                                <SliderRow label="X (ngang)" value={tr.tx} min={-SVG_W} max={SVG_W} step={1}
                                  onChange={v => handleTransformChange(idx, { tx: v })} />
                                <SliderRow label="Y (dọc)" value={tr.ty} min={-SVG_H} max={SVG_H} step={1}
                                  onChange={v => handleTransformChange(idx, { ty: v })} />

                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1 pt-1">
                                  <Maximize2 size={9} />Kéo giãn
                                </p>
                                <SliderRow label="Scale X" value={tr.sx} min={0.1} max={6} step={0.01}
                                  onChange={v => handleTransformChange(idx, { sx: v })} />
                                <SliderRow label="Scale Y" value={tr.sy} min={0.1} max={6} step={0.01}
                                  onChange={v => handleTransformChange(idx, { sy: v })} />
                                <button onClick={() => handleTransformChange(idx, { sy: tr.sx })}
                                  className="text-[10px] text-violet-600 hover:underline">
                                  Đồng bộ Scale Y = Scale X
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-100 shrink-0">
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Chỉnh sửa xong nhấn <span className="font-semibold text-gray-500">Tải xuống</span> → SVG / PNG / JPG.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
