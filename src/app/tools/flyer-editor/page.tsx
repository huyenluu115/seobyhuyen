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
interface TextStyle { fontSize: number; fontWeight: 'normal' | 'bold' }

function readTextStyle(textEl: Element): TextStyle {
  // font-size may be on <text> or the first <tspan>
  const fsRaw = textEl.getAttribute('font-size')
    ?? textEl.querySelector('tspan')?.getAttribute('font-size')
    ?? ''
  const fontSize = parseFloat(fsRaw)
  const fwRaw = textEl.getAttribute('font-weight')
    ?? textEl.querySelector('tspan')?.getAttribute('font-weight')
    ?? 'normal'
  const fontWeight: 'normal' | 'bold' =
    (fwRaw === 'bold' || Number(fwRaw) >= 700) ? 'bold' : 'normal'
  return { fontSize: isNaN(fontSize) ? 24 : fontSize, fontWeight }
}

function applyTextStyle(textEl: Element, style: TextStyle) {
  textEl.setAttribute('font-size', String(style.fontSize))
  textEl.setAttribute('font-weight', style.fontWeight)
}

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

// Actual design content height — the background rect ends at 65.26+2129.9=2195.16.
// The viewBox is 2413.95, leaving ~219 empty units below. We crop to this.
const EXPORT_H = 2195.16

// Vietnamese unicode range
const VI_RANGE = 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB'

// Map of PostScript font name → file paths + descriptor
const FONT_DEFS = [
  { name: 'Montserrat-SemiBold',        la: '/fonts/montserrat-normal-la.woff2', vi: '/fonts/montserrat-normal-vi.woff2', style: 'normal',  weight: '600' },
  { name: 'Montserrat-Bold',            la: '/fonts/montserrat-normal-la.woff2', vi: '/fonts/montserrat-normal-vi.woff2', style: 'normal',  weight: '700' },
  { name: 'Montserrat-BoldItalic',      la: '/fonts/montserrat-italic-la.woff2', vi: '/fonts/montserrat-italic-vi.woff2', style: 'italic', weight: '700' },
  { name: 'Montserrat-ExtraBoldItalic', la: '/fonts/montserrat-italic-la.woff2', vi: '/fonts/montserrat-italic-vi.woff2', style: 'italic', weight: '800' },
  { name: 'Montserrat-BlackItalic',     la: '/fonts/montserrat-italic-la.woff2', vi: '/fonts/montserrat-italic-vi.woff2', style: 'italic', weight: '900' },
  { name: 'Roboto-Regular',             la: '/fonts/roboto-la.woff2',            vi: '/fonts/roboto-vi.woff2',            style: 'normal',  weight: '400' },
  { name: 'Roboto-Bold',                la: '/fonts/roboto-la.woff2',            vi: '/fonts/roboto-vi.woff2',            style: 'normal',  weight: '700' },
  { name: 'Montserrat',                 la: '/fonts/montserrat-normal-la.woff2', vi: '/fonts/montserrat-normal-vi.woff2', style: 'normal',  weight: '400 900' },
  { name: 'Roboto',                     la: '/fonts/roboto-la.woff2',            vi: '/fonts/roboto-vi.woff2',            style: 'normal',  weight: '400 700' },
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
  const [mnLa, mnVi, miLa, miVi, rLa, rVi] = await Promise.all([
    toDataUri('/fonts/montserrat-normal-la.woff2'),
    toDataUri('/fonts/montserrat-normal-vi.woff2'),
    toDataUri('/fonts/montserrat-italic-la.woff2'),
    toDataUri('/fonts/montserrat-italic-vi.woff2'),
    toDataUri('/fonts/roboto-la.woff2'),
    toDataUri('/fonts/roboto-vi.woff2'),
  ])

  const face = (name: string, laSrc: string, viSrc: string, extra = '') =>
    `@font-face{font-family:'${name}';src:url(${viSrc}) format('woff2');unicode-range:${VI_RANGE};${extra}}` +
    `@font-face{font-family:'${name}';src:url(${laSrc}) format('woff2');${extra}}`

  svgFontCSS = [
    face('Montserrat-SemiBold',        mnLa, mnVi, 'font-weight:600;'),
    face('Montserrat-Bold',            mnLa, mnVi, 'font-weight:700;'),
    face('Montserrat-BoldItalic',      miLa, miVi, 'font-weight:700;font-style:italic;'),
    face('Montserrat-ExtraBoldItalic', miLa, miVi, 'font-weight:800;font-style:italic;'),
    face('Montserrat-BlackItalic',     miLa, miVi, 'font-weight:900;font-style:italic;'),
    face('Roboto-Regular',             rLa,  rVi,  'font-weight:400;'),
    face('Roboto-Bold',                rLa,  rVi,  'font-weight:700;'),
    face('Montserrat',                 mnLa, mnVi),
    face('Roboto',                     rLa,  rVi),
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
  const [textValues, setTextValues] = useState<Record<number, string>>({})
  const [textStyles, setTextStyles] = useState<Record<number, TextStyle>>({})
  const [origTextStyles, setOrigTextStyles] = useState<Record<number, TextStyle>>({})
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

        const textEls = doc.querySelectorAll('text')
        const vals: Record<number, string> = {}
        const styles: Record<number, TextStyle> = {}
        textEls.forEach((el, i) => {
          vals[i] = extractLines(el)
          styles[i] = readTextStyle(el)
        })
        setTextValues(vals)
        setTextStyles(styles)
        setOrigTextStyles(styles)

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

  function handleTextChange(idx: number, val: string) {
    setTextValues(prev => ({ ...prev, [idx]: val }))
    const doc = svgDocRef.current; if (!doc) return
    // Patch both the source doc and the live preview element
    const srcEl = doc.querySelectorAll('text')[idx]
    if (srcEl) applyLines(srcEl, val)
    const liveEl = liveSvgRef.current?.querySelectorAll('text')[idx]
    if (liveEl) applyLines(liveEl, val)
  }

  function handleStyleChange(idx: number, patch: Partial<TextStyle>) {
    setTextStyles(prev => {
      const next = { ...prev[idx], ...patch } as TextStyle
      // Patch svgDocRef
      const srcEl = svgDocRef.current?.querySelectorAll('text')[idx]
      if (srcEl) applyTextStyle(srcEl, next)
      // Patch live preview
      const liveEl = liveSvgRef.current?.querySelectorAll('text')[idx]
      if (liveEl) applyTextStyle(liveEl, next)
      return { ...prev, [idx]: next }
    })
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
                    const st = textStyles[f.idx] ?? { fontSize: 24, fontWeight: 'normal' as const }
                    const isBold = st.fontWeight === 'bold'
                    return (
                      <div key={f.idx}>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{f.label}</label>
                        <textarea value={val} rows={Math.max(1, Math.min(5, val.split('\n').length + 1))}
                          onChange={e => handleTextChange(f.idx, e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-violet-200 resize-none leading-relaxed" />
                        {/* Style controls */}
                        <div className="flex items-center gap-2 mt-1.5">
                          {/* Bold toggle */}
                          <button
                            onClick={() => handleStyleChange(f.idx, { fontWeight: isBold ? 'normal' : 'bold' })}
                            title={isBold ? 'Đang đậm — nhấn để bỏ' : 'Nhấn để in đậm'}
                            className={cn(
                              'shrink-0 w-6 h-6 rounded text-xs font-black border transition-colors',
                              isBold
                                ? 'bg-gray-800 text-white border-gray-800'
                                : 'bg-white text-gray-500 border-gray-300 hover:border-gray-600 hover:text-gray-700'
                            )}>B</button>
                          {/* Font size number */}
                          <input
                            type="number" value={st.fontSize} min={4} max={300} step={1}
                            onChange={e => {
                              const v = parseFloat(e.target.value)
                              if (!isNaN(v) && v > 0) handleStyleChange(f.idx, { fontSize: v })
                            }}
                            className="w-14 shrink-0 text-[11px] border border-gray-200 rounded px-1.5 py-0.5 text-center outline-none focus:ring-1 focus:ring-violet-300" />
                          {/* Font size slider */}
                          <input
                            type="range" value={st.fontSize} min={4} max={200} step={1}
                            onChange={e => handleStyleChange(f.idx, { fontSize: parseFloat(e.target.value) })}
                            className="flex-1 h-1 accent-violet-500" />
                          {/* Reset style */}
                          {(origTextStyles[f.idx] &&
                            (origTextStyles[f.idx].fontSize !== st.fontSize || origTextStyles[f.idx].fontWeight !== st.fontWeight)) && (
                            <button
                              onClick={() => handleStyleChange(f.idx, origTextStyles[f.idx])}
                              title="Khôi phục style gốc"
                              className="shrink-0 text-[10px] text-violet-500 hover:text-violet-700">↺</button>
                          )}
                        </div>
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
