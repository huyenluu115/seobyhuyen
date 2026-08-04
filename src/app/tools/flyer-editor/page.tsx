'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Download, Type, Loader2, ChevronDown, Move, Maximize2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

const FLYER_PATH = '/templates/tuyen-dung-vnce.svg'

// One row = one visual line in the SVG (same Y coordinate)
interface TextRow { y: number; idxs: number[] }

// One section = one editable textarea in the panel
interface TextSection {
  id: string
  label: string
  bold: boolean     // whether to render the label as a bold section header
  rows: TextRow[]   // sorted by Y — each row maps to one "\n"-separated line
}

// Hardcoded section boundaries for tuyen-dung-vnce.svg.
// xMin/xMax split the two-column content area (left col: Mô tả, right col: Yêu cầu).
const SECTION_DEFS = [
  { id: 'company',    label: 'Tên công ty',       xMin: 0,   xMax: 9999, yMin: 140,  yMax: 260,  bold: false },
  { id: 'tuyendung',  label: 'TUYỂN DỤNG',        xMin: 0,   xMax: 9999, yMin: 360,  yMax: 400,  bold: true  },
  { id: 'title',      label: 'Vị trí tuyển dụng', xMin: 0,   xMax: 9999, yMin: 400,  yMax: 460,  bold: false },
  { id: 'address',    label: 'Địa chỉ',            xMin: 0,   xMax: 9999, yMin: 630,  yMax: 700,  bold: false },
  { id: 'motacv',     label: 'Mô tả công việc',   xMin: 0,   xMax: 750,  yMin: 1300, yMax: 1600, bold: true  },
  { id: 'yeucau',     label: 'Yêu cầu chung',     xMin: 750, xMax: 9999, yMin: 1300, yMax: 1600, bold: true  },
  { id: 'quyloi',     label: 'Quyền lợi',          xMin: 0,   xMax: 9999, yMin: 1770, yMax: 1970, bold: true  },
  { id: 'lienhe',     label: 'Liên hệ',            xMin: 0,   xMax: 9999, yMin: 2040, yMax: 2100, bold: false },
] as const

function getXY(el: Element): { x: number; y: number } | null {
  const m = el.getAttribute('transform')?.match(/translate\(([-\d.]+)[\s,]+([-\d.]+)\)/)
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null
}

function buildTextSections(doc: Document): TextSection[] {
  const texts = Array.from(doc.querySelectorAll('text'))

  return SECTION_DEFS.map(def => {
    const rowMap = new Map<number, number[]>()

    texts.forEach((el, idx) => {
      const pos = getXY(el)
      if (!pos) return
      if (pos.x < def.xMin || pos.x >= def.xMax) return
      if (pos.y < def.yMin || pos.y >= def.yMax) return

      let key = -1
      for (const [k] of rowMap) { if (Math.abs(k - pos.y) < 5) { key = k; break } }
      if (key < 0) { key = pos.y; rowMap.set(key, []) }
      rowMap.get(key)!.push(idx)
    })

    const rows: TextRow[] = Array.from(rowMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([y, idxs]) => ({ y, idxs }))

    return { id: def.id, label: def.label, bold: def.bold, rows }
  }).filter(s => s.rows.length > 0)
}

function getSectionText(section: TextSection, els: NodeListOf<Element>): string {
  return section.rows
    .map(row => row.idxs.map(i => els[i]?.textContent ?? '').join(''))
    .join('\n')
}

function applySectionText(section: TextSection, els: NodeListOf<Element>, newText: string) {
  const ns = 'http://www.w3.org/2000/svg'
  const lines = newText.split('\n')
  section.rows.forEach((row, rowIdx) => {
    const lineText = lines[rowIdx] ?? ''
    const first = els[row.idxs[0]]; if (!first) return
    let tspan = first.querySelector('tspan')
    if (!tspan) { tspan = (first.ownerDocument ?? document).createElementNS(ns, 'tspan'); first.appendChild(tspan) }
    tspan.textContent = lineText
    for (let i = 1; i < row.idxs.length; i++) {
      const ts = els[row.idxs[i]]?.querySelector('tspan')
      if (ts) ts.textContent = ''
    }
  })
}

// Only ảnh thứ 2 và 3 — banner (idx 0) removed from controls per request
const IMAGE_META = [
  { idx: 1, label: 'Ảnh thứ 2', size: '633 × 424', w: 633, h: 424 },
  { idx: 2, label: 'Ảnh thứ 3', size: '724 × 455', w: 724,  h: 455 },
]

const SVG_W = 1690.15
const SVG_H = 2195.16

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


function getSvgString(doc: Document): string {
  const el = doc.documentElement
  el.removeAttribute('width'); el.removeAttribute('height')
  return new XMLSerializer().serializeToString(doc)
}

// Export height equals SVG height — new SVG is already cropped to exact content
const EXPORT_H = SVG_H

// Vietnamese unicode range
const VI_RANGE = 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB'

// Map of PostScript font name → file paths + descriptor
// New SVG uses only Montserrat variants (no Roboto)
const FONT_DEFS = [
  { name: 'Montserrat-SemiBold',        la: '/fonts/montserrat-normal-la.woff2', vi: '/fonts/montserrat-normal-vi.woff2', style: 'normal', weight: '600' },
  { name: 'Montserrat-Bold',            la: '/fonts/montserrat-normal-la.woff2', vi: '/fonts/montserrat-normal-vi.woff2', style: 'normal', weight: '700' },
  { name: 'Montserrat-BoldItalic',      la: '/fonts/montserrat-italic-la.woff2', vi: '/fonts/montserrat-italic-vi.woff2', style: 'italic', weight: '700' },
  { name: 'Montserrat-ExtraBoldItalic', la: '/fonts/montserrat-italic-la.woff2', vi: '/fonts/montserrat-italic-vi.woff2', style: 'italic', weight: '700' },
  { name: 'Montserrat',                 la: '/fonts/montserrat-normal-la.woff2', vi: '/fonts/montserrat-normal-vi.woff2', style: 'normal', weight: '400 900' },
] as const

// ── Font loading: two strategies run in parallel ────────────────────────────
// Strategy A: inject @font-face into the HTML document so canvas can see them
// Strategy B: embed as data:URI in the SVG blob (belt + suspenders)

let docFontsLoaded = false
async function loadDocumentFonts(): Promise<void> {
  if (docFontsLoaded) return
  const loads = FONT_DEFS.flatMap(({ name, la, vi, style, weight }) => {
    const desc: FontFaceDescriptors = { style, weight }
    return [
      new FontFace(name, `url(${la})`          , desc),
      new FontFace(name, `url(${vi})`, { ...desc, unicodeRange: VI_RANGE }),
    ]
  })
  await Promise.all(loads.map(f => f.load().then(f => document.fonts.add(f))))
  await document.fonts.ready
  docFontsLoaded = true
}

let svgFontCSS: string | null = null
async function buildSvgFontCSS(): Promise<string> {
  if (svgFontCSS) return svgFontCSS

  // Fetch font files and convert to data URIs.
  // Must chunk the binary conversion — spread of 37 000+ args hits browser limits
  // and silently produces a corrupt/empty string.
  async function toDataUri(path: string): Promise<string> {
    const buf = await fetch(path).then(r => r.arrayBuffer())
    const bytes = new Uint8Array(buf)
    let binary = ''
    const CHUNK = 8192
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    return `data:font/woff2;base64,${btoa(binary)}`
  }
  const [mnLa, mnVi, miLa, miVi] = await Promise.all([
    toDataUri('/fonts/montserrat-normal-la.woff2'),
    toDataUri('/fonts/montserrat-normal-vi.woff2'),
    toDataUri('/fonts/montserrat-italic-la.woff2'),
    toDataUri('/fonts/montserrat-italic-vi.woff2'),
  ])

  const face = (name: string, laSrc: string, viSrc: string, extra = '') =>
    `@font-face{font-family:'${name}';src:url(${viSrc}) format('woff2');unicode-range:${VI_RANGE};${extra}}` +
    `@font-face{font-family:'${name}';src:url(${laSrc}) format('woff2');${extra}}`

  svgFontCSS = [
    face('Montserrat-SemiBold',        mnLa, mnVi, 'font-weight:600;'),
    face('Montserrat-Bold',            mnLa, mnVi, 'font-weight:700;'),
    face('Montserrat-BoldItalic',      miLa, miVi, 'font-weight:700;font-style:italic;'),
    face('Montserrat-ExtraBoldItalic', miLa, miVi, 'font-weight:700;font-style:italic;'),
    face('Montserrat',                 mnLa, mnVi),
  ].join('')
  return svgFontCSS
}

async function injectFonts(svgStr: string): Promise<string> {
  const css = await buildSvgFontCSS()
  return svgStr.includes('<style>')
    ? svgStr.replace('<style>', `<style>${css}`)
    : svgStr.replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`)
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
  const [textSections, setTextSections] = useState<TextSection[]>([])
  const [textValues, setTextValues] = useState<Record<string, string>>({})
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
      'max-width:900px',
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

        const sections = buildTextSections(doc)
        const textEls = doc.querySelectorAll('text')
        const vals: Record<string, string> = {}
        sections.forEach(s => { vals[s.id] = getSectionText(s, textEls) })
        setTextSections(sections)
        setTextValues(vals)

        const transforms: Record<number, ImgTransform> = {}
        doc.querySelectorAll('image').forEach((el, i) => {
          transforms[i] = parseTransform(el.getAttribute('transform') ?? '')
        })
        setImgTransforms(transforms)
        setOrigTransforms(transforms)

        setLoading(false)
      })
      .catch(e => { setLoadError((e as Error).message); setLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mount inline SVG only AFTER loading=false so previewRef.current is in the DOM
  useEffect(() => {
    if (loading || loadError || !svgDocRef.current) return
    mountSvg(svgDocRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  function handleTextChange(sectionId: string, val: string) {
    setTextValues(prev => ({ ...prev, [sectionId]: val }))
    const section = textSections.find(s => s.id === sectionId); if (!section) return
    const doc = svgDocRef.current; if (!doc) return
    applySectionText(section, doc.querySelectorAll('text'), val)
    if (liveSvgRef.current) applySectionText(section, liveSvgRef.current.querySelectorAll('text'), val)
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

  async function svgToCanvas(): Promise<HTMLCanvasElement> {
    const doc = svgDocRef.current!

    // Strategy A: load fonts into document so canvas can use them
    await loadDocumentFonts()

    const W = Math.round(SVG_W), H = Math.round(EXPORT_H)

    // Crop viewBox to actual content height and set explicit pixel dimensions.
    // SVG without explicit width/height gets default CSS intrinsic size (300×150)
    // which causes browsers to render into a tiny buffer then stretch — wrong size.
    let svgStr = getSvgString(doc)
      .replace(/viewBox="[^"]+"/, `viewBox="0 0 ${SVG_W} ${EXPORT_H}"`)
      .replace(/<svg /, `<svg width="${W}" height="${H}" `)

    // Strategy B: embed fonts as data-URIs inside the SVG blob
    svgStr = await injectFonts(svgStr)

    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    // Add img to DOM (offscreen, natural size) so canvas can access document.fonts
    img.style.cssText = 'position:fixed;top:-99999px;left:-99999px;opacity:0;pointer-events:none'
    document.body.appendChild(img)

    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url })
    URL.revokeObjectURL(url)

    // img.decode() ensures the image is fully rasterized (including SVG's
    // internal @font-face fonts which load asynchronously after onload).
    // The extra RAF + 200ms gives the isolated SVG context time to finish
    // font loading before we draw to canvas.
    try { await img.decode() } catch { /* ignore decode errors on older Safari */ }
    await document.fonts.ready
    await new Promise(res => requestAnimationFrame(res))
    await new Promise(res => setTimeout(res, 200))

    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, W, H)

    img.remove()
    return canvas
  }

  async function downloadRaster(format: 'png' | 'jpg') {
    if (!svgDocRef.current) return
    setExporting(true); setDlOpen(false)
    try {
      const canvas = await svgToCanvas()
      let dataUrl: string
      if (format === 'jpg') {
        const out = document.createElement('canvas')
        out.width = canvas.width; out.height = canvas.height
        const c = out.getContext('2d')!
        c.fillStyle = '#fff'; c.fillRect(0, 0, out.width, out.height)
        c.drawImage(canvas, 0, 0)
        dataUrl = out.toDataURL('image/jpeg', 0.92)
      } else {
        dataUrl = canvas.toDataURL('image/png')
      }
      const a = document.createElement('a'); a.href = dataUrl; a.download = `tuyen-dung.${format}`; a.click()
    } catch { alert('Không thể xuất ảnh. Thử dùng SVG.') }
    setExporting(false)
  }

  async function downloadPdf() {
    if (!svgDocRef.current) return
    setExporting(true); setDlOpen(false)
    try {
      const canvas = await svgToCanvas()
      const out = document.createElement('canvas')
      out.width = canvas.width; out.height = canvas.height
      const c = out.getContext('2d')!
      c.fillStyle = '#fff'; c.fillRect(0, 0, out.width, out.height)
      c.drawImage(canvas, 0, 0)
      const dataUrl = out.toDataURL('image/png')
      const win = window.open('', '_blank')
      if (!win) { alert('Trình duyệt chặn popup. Vui lòng cho phép popup.'); setExporting(false); return }
      win.document.write(`<!DOCTYPE html><html><head><style>
        *{margin:0;padding:0;box-sizing:border-box}
        @page{size:A4 portrait;margin:0}
        html,body{width:210mm;height:297mm;overflow:hidden}
        img{width:100%;height:100%;object-fit:contain;display:block}
      </style></head><body>
        <img src="${dataUrl}"/>
        <script>window.onload=()=>{setTimeout(()=>{window.print()},200)}<\/script>
      </body></html>`)
      win.document.close()
    } catch { alert('Không thể xuất PDF.') }
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
                  { label: 'PDF (in / lưu)', fn: downloadPdf },
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
            style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: '12px 8px' }}
          />

          {/* Editor panel */}
          <div className="w-80 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
            <div className="flex border-b border-gray-200 shrink-0">
              {(['text', 'images'] as const).map(s => (
                <button key={s} onClick={() => setActiveSection(s)}
                  className={cn('flex-1 py-2.5 text-xs font-medium transition-colors',
                    activeSection === s ? 'text-violet-600 border-b-2 border-violet-500 bg-violet-50/40' : 'text-gray-500 hover:text-gray-700')}>
                  {s === 'text' ? `Văn bản (${textSections.length})` : `Hình ảnh (${IMAGE_META.length})`}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* TEXT TAB */}
              {activeSection === 'text' && (
                <div className="p-3 space-y-4">
                  {textSections.map(s => {
                    const val = textValues[s.id] ?? ''
                    const lineCount = val.split('\n').length
                    return (
                      <div key={s.id} className={s.bold ? 'rounded-lg border border-violet-100 bg-violet-50/40 p-3' : ''}>
                        <label className={cn(
                          'block mb-1.5',
                          s.bold
                            ? 'text-sm font-extrabold text-violet-700'
                            : 'text-[10px] font-bold uppercase tracking-widest text-gray-400'
                        )}>
                          {s.label}
                        </label>
                        <textarea
                          value={val}
                          rows={Math.max(2, Math.min(20, lineCount + 1))}
                          onChange={e => handleTextChange(s.id, e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-violet-200 resize-none leading-relaxed bg-white"
                        />
                        <p className="text-[9px] text-gray-300 mt-0.5">{lineCount} dòng · {s.rows.length} dòng trong mẫu</p>
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
