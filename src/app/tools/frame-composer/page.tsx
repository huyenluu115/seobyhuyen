'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Layers, Download, Upload, ZoomIn, ZoomOut, RotateCcw, Loader2, Check, Type, Bold, Italic } from 'lucide-react'

const FRAME_W = 650
const FRAME_H = 371

const PRESET_FRAMES = [
  { id: 'vnce',        label: 'VNCE',           src: '/frames/vnce-frame.png', overlay: true  },
  { id: 'daotao',     label: 'Đào tạo',         src: '/frames/daotao.png',     overlay: false },
  { id: 'daotao-text', label: 'Đào tạo + text', src: '/frames/daotao-text.png', overlay: false },
]

interface TextLayer {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
}

function loadFont(): Promise<void> {
  if ((document as Document & { __robotoLoaded?: boolean }).__robotoLoaded) return Promise.resolve()
  return new FontFace('Roboto', 'url(https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2)')
    .load()
    .then(font => {
      document.fonts.add(font)
      ;(document as Document & { __robotoLoaded?: boolean }).__robotoLoaded = true
    })
}

export default function FrameComposerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [frameImg, setFrameImg] = useState<HTMLImageElement | null>(null)
  const [frameOverlay, setFrameOverlay] = useState(true) // true=frame on top, false=frame as background
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragTarget, setDragTarget] = useState<'photo' | string>('photo')
  const [downloading, setDownloading] = useState(false)
  const [jpgSize, setJpgSize] = useState<number | null>(null)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const [displayScale, setDisplayScale] = useState(1)

  // Text layers
  const [textLayers, setTextLayers] = useState<TextLayer[]>([])
  const [activeText, setActiveText] = useState<string | null>(null)
  const [newText, setNewText] = useState('')
  const [fontSize, setFontSize] = useState(20)
  const [textColor, setTextColor] = useState('#ffffff')
  const [bold, setBold] = useState(false)
  const [italic, setItalic] = useState(false)
  const [fontReady, setFontReady] = useState(false)

  useEffect(() => {
    loadFont().then(() => setFontReady(true)).catch(() => setFontReady(true))
  }, [])

  useEffect(() => {
    function update() {
      if (!containerRef.current) return
      const padW = 48, padH = 48
      const scaleW = (containerRef.current.offsetWidth - padW) / FRAME_W
      const scaleH = (containerRef.current.offsetHeight - padH) / FRAME_H
      setDisplayScale(Math.min(scaleW, scaleH))
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, FRAME_W, FRAME_H)
    ctx.fillStyle = '#e8e8e8'
    ctx.fillRect(0, 0, FRAME_W, FRAME_H)
    if (!frameOverlay && frameImg) {
      // RGB frame (white bg): draw frame first, photo on top
      ctx.drawImage(frameImg, 0, 0, FRAME_W, FRAME_H)
    }
    if (photoImg) {
      ctx.drawImage(photoImg, pos.x, pos.y, photoImg.width * scale, photoImg.height * scale)
    }
    if (frameOverlay && frameImg) {
      // RGBA frame (transparent): draw frame on top of photo
      ctx.drawImage(frameImg, 0, 0, FRAME_W, FRAME_H)
    }
    // Draw text layers
    textLayers.forEach(t => {
      const weight = t.bold ? 'bold' : 'normal'
      const style = t.italic ? 'italic' : 'normal'
      ctx.font = `${style} ${weight} ${t.fontSize}px Roboto, sans-serif`
      ctx.fillStyle = t.color
      ctx.textBaseline = 'top'
      // Shadow for readability
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 3
      ctx.fillText(t.text, t.x, t.y)
      ctx.shadowBlur = 0
      // Highlight active + resize handle
      if (t.id === activeText) {
        const w = ctx.measureText(t.text).width
        const H = 8
        ctx.strokeStyle = '#7c3aed'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        ctx.strokeRect(t.x - 4, t.y - 4, w + 8 + H, t.fontSize + 12)
        ctx.setLineDash([])
        // Resize handle (right-center)
        ctx.fillStyle = '#7c3aed'
        ctx.fillRect(t.x + w + 4, t.y + (t.fontSize - H) / 2, H, H)
        // Move indicator dots
        ctx.fillStyle = 'rgba(124,58,237,0.5)'
        for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
          ctx.fillRect(t.x - 2 + c * 4, t.y + r * 5, 2, 2)
        }
      }
    })
  }, [frameImg, photoImg, scale, pos, textLayers, activeText])

  useEffect(() => { draw() }, [draw, fontReady])

  function loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise(resolve => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.src = URL.createObjectURL(file)
    })
  }

  function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
  }

  async function handlePresetSelect(preset: typeof PRESET_FRAMES[0]) {
    if (selectedPreset === preset.id) { setSelectedPreset(null); setFrameImg(null); return }
    try {
      const img = await loadImageFromUrl(preset.src)
      setFrameImg(img)
      setFrameOverlay(preset.overlay)
      setSelectedPreset(preset.id)
    } catch { alert('Không tải được khung. Hãy đảm bảo file ảnh đã được đặt vào thư mục public/frames/') }
  }

  async function handleFrameUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const img = await loadImageFromFile(file)
    // Auto-detect: check if image has transparency by drawing to offscreen canvas
    const off = document.createElement('canvas')
    off.width = 10; off.height = 10
    const ctx = off.getContext('2d')!
    ctx.drawImage(img, 0, 0, 10, 10)
    const px = ctx.getImageData(0, 0, 10, 10).data
    const hasAlpha = Array.from(px).some((v, i) => i % 4 === 3 && v < 255)
    setFrameImg(img)
    setFrameOverlay(hasAlpha)
    setSelectedPreset(null)
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const img = await loadImageFromFile(file)
    const s = Math.max(FRAME_W / img.width, FRAME_H / img.height)
    setScale(s); setPos({ x: (FRAME_W - img.width * s) / 2, y: (FRAME_H - img.height * s) / 2 })
    setPhotoImg(img); setJpgSize(null)
  }

  function addText() {
    if (!newText.trim()) return
    const id = Date.now().toString()
    setTextLayers(prev => [...prev, {
      id, text: newText.trim(),
      x: 20, y: FRAME_H / 2,
      fontSize, color: textColor, bold, italic,
    }])
    setActiveText(id)
    setNewText('')
  }

  function updateActiveText(patch: Partial<TextLayer>) {
    if (!activeText) return
    setTextLayers(prev => prev.map(t => t.id === activeText ? { ...t, ...patch } : t))
  }

  function deleteActiveText() {
    if (!activeText) return
    setTextLayers(prev => prev.filter(t => t.id !== activeText))
    setActiveText(null)
  }

  const HANDLE_SIZE = 12

  function getTextMetrics(t: TextLayer) {
    const canvas = canvasRef.current; if (!canvas) return null
    const ctx = canvas.getContext('2d'); if (!ctx) return null
    ctx.font = `${t.italic ? 'italic' : 'normal'} ${t.bold ? 'bold' : 'normal'} ${t.fontSize}px Roboto, sans-serif`
    return { w: ctx.measureText(t.text).width }
  }

  // Returns 'resize:{id}' or '{id}' or null
  function hitTest(cx: number, cy: number): string | null {
    // Check resize handle of active text first
    if (activeText) {
      const t = textLayers.find(x => x.id === activeText)
      if (t) {
        const m = getTextMetrics(t)
        if (m) {
          const hx = t.x + m.w + 4
          const hy = t.y + (t.fontSize - HANDLE_SIZE) / 2
          if (cx >= hx - 4 && cx <= hx + HANDLE_SIZE + 4 && cy >= hy - 4 && cy <= hy + HANDLE_SIZE + 4)
            return `resize:${t.id}`
        }
      }
    }
    // Check text body
    const canvas = canvasRef.current; if (!canvas) return null
    const ctx = canvas.getContext('2d'); if (!ctx) return null
    for (let i = textLayers.length - 1; i >= 0; i--) {
      const t = textLayers[i]
      ctx.font = `${t.italic ? 'italic' : 'normal'} ${t.bold ? 'bold' : 'normal'} ${t.fontSize}px Roboto, sans-serif`
      const w = ctx.measureText(t.text).width
      if (cx >= t.x - 4 && cx <= t.x + w + 4 && cy >= t.y - 4 && cy <= t.y + t.fontSize + 8)
        return t.id
    }
    return null
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = (e.clientX - rect.left) / displayScale
    const cy = (e.clientY - rect.top) / displayScale
    const hit = hitTest(cx, cy)
    if (hit) {
      if (hit.startsWith('resize:')) {
        const id = hit.replace('resize:', '')
        const t = textLayers.find(x => x.id === id)!
        setDragTarget(hit)
        dragStart.current = { mx: e.clientX, my: e.clientY, px: t.fontSize, py: 0 }
      } else {
        setActiveText(hit)
        setDragTarget(hit)
        const t = textLayers.find(x => x.id === hit)!
        dragStart.current = { mx: e.clientX, my: e.clientY, px: t.x, py: t.y }
        setFontSize(t.fontSize); setTextColor(t.color); setBold(t.bold); setItalic(t.italic)
      }
    } else {
      setActiveText(null)
      if (!photoImg) return
      setDragTarget('photo')
      dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    }
    setDragging(true)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return
    const dx = (e.clientX - dragStart.current.mx) / displayScale
    const dy = (e.clientY - dragStart.current.my) / displayScale
    if (dragTarget === 'photo') {
      setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy })
    } else if (dragTarget.startsWith('resize:')) {
      const id = dragTarget.replace('resize:', '')
      const rawSize = dragStart.current.px + dx * 0.6
      const newSize = Math.max(8, Math.min(120, Math.round(rawSize)))
      setTextLayers(prev => prev.map(t => t.id === id ? { ...t, fontSize: newSize } : t))
      setFontSize(newSize)
    } else {
      setTextLayers(prev => prev.map(t =>
        t.id === dragTarget ? { ...t, x: dragStart.current.px + dx, y: dragStart.current.py + dy } : t
      ))
    }
  }

  function onPointerUp() { setDragging(false) }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    if (!photoImg) return
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = (e.clientX - rect.left) / displayScale
    const cy = (e.clientY - rect.top) / displayScale
    const delta = -e.deltaY * 0.001
    setScale(prev => {
      const next = Math.max(0.05, Math.min(10, prev + delta))
      setPos(p => ({ x: cx - (cx - p.x) * (next / prev), y: cy - (cy - p.y) * (next / prev) }))
      return next
    })
  }

  function handleReset() {
    if (!photoImg) return
    const s = Math.max(FRAME_W / photoImg.width, FRAME_H / photoImg.height)
    setScale(s); setPos({ x: (FRAME_W - photoImg.width * s) / 2, y: (FRAME_H - photoImg.height * s) / 2 })
  }

  function handleDownloadPNG() {
    const canvas = canvasRef.current; if (!canvas) return
    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'framed-image.png'; a.click()
  }

  async function handleDownloadJPG() {
    const canvas = canvasRef.current; if (!canvas) return
    setDownloading(true)
    const off = document.createElement('canvas')
    off.width = FRAME_W; off.height = FRAME_H
    const ctx = off.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, FRAME_W, FRAME_H); ctx.drawImage(canvas, 0, 0)
    let lo = 0.05, hi = 0.95, bestBlob: Blob | null = null
    for (let i = 0; i < 14; i++) {
      const q = (lo + hi) / 2
      const blob = await new Promise<Blob | null>(r => off.toBlob(r, 'image/jpeg', q))
      if (!blob) break
      if (blob.size <= 100 * 1024) { bestBlob = blob; lo = q } else hi = q
    }
    setDownloading(false)
    if (!bestBlob) return
    setJpgSize(Math.round(bestBlob.size / 1024))
    const a = document.createElement('a'); a.href = URL.createObjectURL(bestBlob); a.download = 'framed-image.jpg'; a.click()
  }

  const activeLayer = textLayers.find(t => t.id === activeText)
  const ready = !!(frameImg || photoImg || textLayers.length > 0)

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col" style={{ background: '#f0f0f2' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-violet-500" />
          <span className="font-semibold text-gray-800 text-sm">Frame Composer</span>
          <span className="text-gray-300 text-xs">|</span>
          <span className="text-gray-400 text-xs">650 × 371 px</span>
        </div>
        <div className="flex items-center gap-2">
          {ready && <span className="text-xs text-gray-400">{Math.round(scale * 100)}%</span>}
          <Button onClick={handleDownloadJPG} disabled={!ready || downloading} size="sm"
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 h-8 text-xs">
            {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {downloading ? 'Đang nén...' : 'Tải JPG'}
          </Button>
          <Button onClick={handleDownloadPNG} disabled={!ready} size="sm" variant="outline"
            className="gap-1.5 h-8 text-xs text-gray-600">
            <Download size={12} />PNG
          </Button>
          {jpgSize && <span className="text-xs text-green-600 font-medium">✓ {jpgSize}KB</span>}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div ref={containerRef} className="flex-1 flex items-center justify-center p-6 overflow-hidden" style={{ height: '100%' }}>
          <div style={{
            width: FRAME_W * displayScale,
            height: FRAME_H * displayScale,
            flexShrink: 0,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
            <canvas ref={canvasRef} width={FRAME_W} height={FRAME_H}
              style={{
                display: 'block',
                width: FRAME_W * displayScale,
                height: FRAME_H * displayScale,
                cursor: dragging ? 'grabbing' : 'grab',
                touchAction: 'none',
              }}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove}
              onPointerUp={onPointerUp} onPointerLeave={onPointerUp} onWheel={onWheel}
            />
          </div>
        </div>

        {/* Right panel */}
        <div className="w-64 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">

          {/* 1. Frame */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Khung</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {PRESET_FRAMES.map(p => (
                <button key={p.id} onClick={() => handlePresetSelect(p)}
                  className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
                    selectedPreset === p.id
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-gray-200 hover:border-violet-300 text-gray-600 bg-gray-50')}>
                  {selectedPreset === p.id && <Check size={10} />}{p.label}
                </button>
              ))}
            </div>
            <label className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-colors text-xs w-full',
              frameImg && !selectedPreset ? 'border-violet-400 bg-violet-50 text-violet-600' : 'border-gray-300 text-gray-400 hover:border-violet-300 hover:text-violet-500'
            )}>
              <Upload size={12} />
              {frameImg && !selectedPreset ? '✓ Đã upload khung' : 'Upload khung khác'}
              <input type="file" accept="image/png,image/*" className="hidden" onChange={handleFrameUpload} />
            </label>
          </div>

          {/* 2. Photo */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Ảnh</p>
            <label className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-colors text-xs w-full mb-2',
              photoImg ? 'border-violet-400 bg-violet-50 text-violet-600' : 'border-gray-300 text-gray-400 hover:border-violet-300 hover:text-violet-500'
            )}>
              <Upload size={12} />
              {photoImg ? '✓ Ảnh đã tải' : 'Upload ảnh (JPG/PNG)'}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
            {photoImg && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <button onClick={() => setScale(s => Math.max(0.05, s - 0.05))} className="p-1 rounded hover:bg-gray-100"><ZoomOut size={12} className="text-gray-500" /></button>
                  <input type="range" min={0.05} max={10} step={0.01} value={scale}
                    onChange={e => setScale(parseFloat(e.target.value))} className="flex-1 accent-violet-500 h-1" />
                  <button onClick={() => setScale(s => Math.min(10, s + 0.05))} className="p-1 rounded hover:bg-gray-100"><ZoomIn size={12} className="text-gray-500" /></button>
                </div>
                <button onClick={handleReset}
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-violet-600 transition-colors">
                  <RotateCcw size={10} />Căn giữa
                </button>
              </div>
            )}
          </div>

          {/* 3. Text */}
          <div className="p-4 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Chữ · Roboto</p>
            <div className="flex gap-1.5 mb-3">
              <input value={newText} onChange={e => setNewText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addText()}
                placeholder="Nhập chữ rồi Enter..."
                className="flex-1 text-xs border rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-violet-200 min-w-0" />
              <button onClick={addText}
                className="px-2.5 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 shrink-0">
                <Type size={12} />
              </button>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-12 shrink-0">Cỡ {fontSize}px</span>
                <input type="range" min={10} max={60} value={fontSize}
                  onChange={e => { setFontSize(+e.target.value); updateActiveText({ fontSize: +e.target.value }) }}
                  className="flex-1 accent-violet-500 h-1" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-12 shrink-0">Màu</span>
                <input type="color" value={textColor}
                  onChange={e => { setTextColor(e.target.value); updateActiveText({ color: e.target.value }) }}
                  className="w-8 h-6 rounded cursor-pointer border border-gray-200 p-0" />
                <button onClick={() => { setBold(b => !b); updateActiveText({ bold: !bold }) }}
                  className={cn('px-2 py-1 rounded text-xs font-bold border transition-colors',
                    bold ? 'bg-violet-100 border-violet-400 text-violet-700' : 'border-gray-200 text-gray-500')}>B</button>
                <button onClick={() => { setItalic(i => !i); updateActiveText({ italic: !italic }) }}
                  className={cn('px-2 py-1 rounded text-xs italic border transition-colors',
                    italic ? 'bg-violet-100 border-violet-400 text-violet-700' : 'border-gray-200 text-gray-500')}>I</button>
              </div>
            </div>

            {textLayers.length > 0 && (
              <div className="space-y-1 border-t border-gray-100 pt-2">
                {textLayers.map(t => (
                  <div key={t.id} onClick={() => { setActiveText(t.id); setFontSize(t.fontSize); setTextColor(t.color); setBold(t.bold); setItalic(t.italic) }}
                    className={cn('flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors group',
                      activeText === t.id ? 'bg-violet-50 border border-violet-200' : 'hover:bg-gray-50 border border-transparent')}>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 border border-gray-200" style={{ background: t.color }} />
                    <span className="flex-1 truncate text-gray-700">{t.text}</span>
                    <span className="text-gray-300 text-[10px] shrink-0">{t.fontSize}px</span>
                    {activeText === t.id && (
                      <button onClick={e => { e.stopPropagation(); deleteActiveText() }}
                        className="text-red-400 hover:text-red-600 text-[10px] shrink-0">✕</button>
                    )}
                  </div>
                ))}
                <p className="text-[10px] text-gray-400 pt-1">Kéo chữ trên canvas để đặt vị trí</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
