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

// Only ảnh thứ 2 và 3 — banner (idx 0) removed from controls per request
const IMAGE_META = [
  { idx: 1, label: 'Ảnh thứ 2', size: '626 × 417', w: 626, h: 417 },
  { idx: 2, label: 'Ảnh thứ 3', size: '725 × 489', w: 725,  h: 489 },
]

const SVG_W = 1596.17
const SVG_H = 2413.95

interface ImgTransform { tx: number; ty: number; sx: number; sy: number }

function parseTransform(str: string): ImgTransform {
  const t = str.match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/)
  const s = str.match(/scale\(\s*([-\d.]+)(?:[,\s]+([-\d.]+))?\s*\)/)
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
  const yMap = new Map<string, string>()
  textEl.querySelectorAll('tspan').forEach(ts => {
    const y = ts.getAttribute('y') ?? '0'
    yMap.set(y, (yMap.get(y) ?? '') + (ts.textContent ?? ''))
  })
  return Array.from(yMap.entries())
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([, t]) => t.trim()).join('\n')
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
    const ns = 'http://www.w3.org/2000/svg'
    const ts = (textEl.ownerDocument ?? document).createElementNS(ns, 'tspan')
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
      <span className="text-[10px] font-mono text-gray-500 w-12 text-right shrink-0">{value.toFixed(2)}</span>
    </div>
  )
}

export default function FlyerEditorPage() {
  // Prevent outer layout from scrolling
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
  const [origTransforms, setOrigTransforms] = useState<Record<number, ImgTransform>>({})
  const [expandedImg, setExpandedImg] = useState<number | null>(1)
  const [activeSection, setActiveSection] = useState<'text' | 'images'>('images')
  const [dlOpen, setDlOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)

  const svgDocRef = useRef<Document | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  // Live reference to the imported SVG element for direct patching
  const liveSvgRef = useRef<SVGSVGElement | null>(null)

  // Mount SVG inline via importNode — preserves namespaces (xlink:href renders correctly)
  function mountSvg(doc: Document) {
    if (!previewRef.current) return
    previewRef.current.innerHTML = ''
    const svgEl = document.importNode(doc.documentElement, true) as unknown as SVGSVGElement
    svgEl.style.cssText = [
      'width:100%',
      'max-width:820px',
      'height:auto',
      'display:block',
      'margin:0 auto',
      'border-radius:16px',
      'box-shadow:0 20px 60px rgba(0,0,0,.2)',
    ].join(';')
    previewRef.current.appendChild(svgEl)
    liveSvgRef.current = svgEl
    attachDragHandlers(svgEl)
  }

  function attachDragHandlers(svgEl: SVGSVGElement) {
    svgEl.querySelectorAll('image').forEach((el, rawIdx) => {
      // Only attach drag to images that are in the controls panel (idx 1 and 2)
      if (rawIdx === 0) return

      el.style.cursor = 'grab'
      let startMX = 0, startMY = 0, startTx = 0, startTy = 0

      el.addEventListener('pointerdown', (e: Event) => {
        const pe = e as PointerEvent
        pe.preventDefault(); pe.stopPropagation()
        el.setPointerCapture(pe.pointerId)
        el.style.cursor = 'grabbing'
        startMX = pe.clientX; startMY = pe.clientY
        const t = parseTransform(el.getAttribute('transform') ?? '')
        startTx = t.tx; startTy = t.ty
        setDraggingIdx(rawIdx)
      })

      el.addEventListener('pointermove', (e: Event) => {
        const pe = e as PointerEvent
        if (!el.hasPointerCapture(pe.pointerId)) return
        const rect = svgEl.getBoundingClientRect()
        const vb = svgEl.viewBox.baseVal
        const scX = vb.width / rect.width
        const scY = vb.height / rect.height
        const newTx = startTx + (pe.clientX - startMX) * scX
        const newTy = startTy + (pe.clientY - startMY) * scY
        const cur = parseTransform(el.getAttribute('transform') ?? '')
        const str = buildTransform({ ...cur, tx: newTx, ty: newTy })
        // Patch preview directly (no re-render)
        el.setAttribute('transform', str)
        // Keep svgDoc in sync for download
        svgDocRef.current?.querySelectorAll('image')[rawIdx]?.setAttribute('transform', str)
      })

      el.addEventListener('pointerup', (e: Event) => {
        const pe = e as PointerEvent
        if (!el.hasPointerCapture(pe.pointerId)) return
        el.releasePointerCapture(pe.pointerId)
        el.style.cursor = 'grab'
        const finalT = parseTransform(el.getAttribute('transform') ?? '')
        setImgTransforms(prev => ({ ...prev, [rawIdx]: finalT }))
        setDraggingIdx(null)
      })
    })
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

        const transforms: Record<number, ImgTransform> = {}
        doc.querySelectorAll('image').forEach((el, i) => {
          transforms[i] = parseTransform(el.getAttribute('transform') ?? '')
        })
        setImgTransforms(transforms)
        setOrigTransforms(transforms)

        mountSvg(doc)
        setLoading(false)
      })
      .catch(e => { setLoadError((e as Error).message); setLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleTextChange(idx: number, val: string) {
    setTextValues(prev => ({ ...prev, [idx]: val }))
    const doc = svgDocRef.current; if (!doc) return
    // Patch both the source doc and the live preview element
    const srcEl = doc.querySelectorAll('text')[idx]
    if (srcEl) applyLines(srcEl, val)
    const liveEl = liveSvgRef.current?.querySelectorAll('text')[idx]
    if (liveEl) applyLines(liveEl, val)
  }

  function handleImageReplace(imgIdx: number, file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      const XLINK = 'http://www.w3.org/1999/xlink'
      // Patch source doc
      const srcEl = svgDocRef.current?.querySelectorAll('image')[imgIdx]
      if (srcEl) { srcEl.setAttributeNS(XLINK, 'href', dataUrl); srcEl.setAttribute('href', dataUrl) }
      // Patch live preview
      const liveEl = liveSvgRef.current?.querySelectorAll('image')[imgIdx]
      if (liveEl) { liveEl.setAttributeNS(XLINK, 'href', dataUrl); liveEl.setAttribute('href', dataUrl) }
      setImgReplaced(prev => ({ ...prev, [imgIdx]: true }))
    }
    reader.readAsDataURL(file)
  }

  function patchTransform(imgIdx: number, t: ImgTransform) {
    const str = buildTransform(t)
    svgDocRef.current?.querySelectorAll('image')[imgIdx]?.setAttribute('transform', str)
    liveSvgRef.current?.querySelectorAll('image')[imgIdx]?.setAttribute('transform', str)
  }

  function handleTransformChange(imgIdx: number, patch: Partial<ImgTransform>) {
    setImgTransforms(prev => {
      const next = { ...prev[imgIdx], ...patch }
      patchTransform(imgIdx, next)
      return { ...prev, [imgIdx]: next }
    })
  }

  function handleFillWidth(imgIdx: number) {
    const meta = IMAGE_META.find(m => m.idx === imgIdx); if (!meta) return
    const s = SVG_W / meta.w
    const t: ImgTransform = { tx: 0, ty: imgTransforms[imgIdx]?.ty ?? 0, sx: s, sy: s }
    setImgTransforms(prev => ({ ...prev, [imgIdx]: t }))
    patchTransform(imgIdx, t)
  }

  function handleFillCanvas(imgIdx: number) {
    const meta = IMAGE_META.find(m => m.idx === imgIdx); if (!meta) return
    const t: ImgTransform = { tx: 0, ty: 0, sx: SVG_W / meta.w, sy: SVG_H / meta.h }
    setImgTransforms(prev => ({ ...prev, [imgIdx]: t }))
    patchTransform(imgIdx, t)
  }

  function handleReset(imgIdx: number) {
    const orig = origTransforms[imgIdx]; if (!orig) return
    setImgTransforms(prev => ({ ...prev, [imgIdx]: { ...orig } }))
    patchTransform(imgIdx, orig)
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
      const blob = new Blob([getSvgString(doc)], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.width = Math.round(SVG_W); img.height = Math.round(SVG_H)
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url })
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(SVG_W); canvas.height = Math.round(SVG_H)
      const ctx = canvas.getContext('2d')!
      if (format === 'jpg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
      ctx.drawImage(img, 0, 0)
      const dataUrl = canvas.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', format === 'jpg' ? 0.92 : undefined)
      const a = document.createElement('a'); a.href = dataUrl; a.download = `tuyen-dung.${format}`; a.click()
    } catch { alert('Không thể xuất ảnh. Thử dùng SVG.') }
    setExporting(false)
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: '14rem', right: 0, bottom: 0, display: 'flex', flexDirection: 'column', background: '#f0f0f2', zIndex: 5 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <Type size={18} className="text-violet-500" />
          <span className="font-semibold text-gray-800 text-sm">Flyer Editor</span>
          <span className="text-gray-300 text-xs">|</span>
          <span className="text-gray-400 text-xs">
            {draggingIdx !== null ? `Đang di chuyển ảnh ${draggingIdx}…` : 'Tờ rơi tuyển dụng VNCE'}
          </span>
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
          {/* Preview — inline SVG mounted here */}
          <div
            ref={previewRef}
            style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: 32 }}
          />

          {/* Editor panel */}
          <div className="w-80 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
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
              {/* TEXT TAB */}
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

              {/* IMAGES TAB — only ảnh 2 and 3 */}
              {activeSection === 'images' && (
                <div className="divide-y divide-gray-100">
                  <div className="px-4 py-2.5 bg-blue-50/60">
                    <p className="text-[10px] text-blue-600 flex items-center gap-1">
                      <Move size={10} />
                      Kéo thả ảnh trực tiếp trên tờ rơi để di chuyển
                    </p>
                  </div>
                  {IMAGE_META.map(({ idx, label, size, w, h }) => {
                    const tr = imgTransforms[idx]
                    const isOpen = expandedImg === idx
                    return (
                      <div key={idx}>
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

                            {tr && (
                              <div className="space-y-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Vị trí tinh chỉnh</p>
                                <SliderRow label="X (ngang)" value={tr.tx} min={-SVG_W} max={SVG_W} step={1}
                                  onChange={v => handleTransformChange(idx, { tx: v })} />
                                <SliderRow label="Y (dọc)" value={tr.ty} min={-SVG_H} max={SVG_H} step={1}
                                  onChange={v => handleTransformChange(idx, { ty: v })} />

                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pt-1">Kéo giãn</p>
                                <SliderRow label="Scale X" value={tr.sx} min={0.1} max={6} step={0.01}
                                  onChange={v => handleTransformChange(idx, { sx: v })} />
                                <SliderRow label="Scale Y" value={tr.sy} min={0.1} max={6} step={0.01}
                                  onChange={v => handleTransformChange(idx, { sy: v })} />
                                <button onClick={() => handleTransformChange(idx, { sy: tr.sx })}
                                  className="text-[10px] text-violet-600 hover:underline">
                                  Đồng bộ Scale Y = Scale X (giữ tỷ lệ)
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
                Chỉnh sửa xong → <span className="font-semibold text-gray-500">Tải xuống</span> SVG / PNG / JPG.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
