'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Layers, Download, Upload, ZoomIn, ZoomOut, RotateCcw, Loader2, Check, Type, Bold, Italic } from 'lucide-react'

const FRAME_W = 650
const FRAME_H = 371

const PRESET_FRAMES = [
  { id: 'vnce',        label: 'VNCE',         src: '/frames/vnce-frame.png' },
  { id: 'daotao',     label: 'Đào tạo',       src: '/frames/daotao.png' },
  { id: 'daotao-text', label: 'Đào tạo + text', src: '/frames/daotao-text.png' },
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
      setDisplayScale(Math.min(1, containerRef.current.offsetWidth / FRAME_W))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, FRAME_W, FRAME_H)
    ctx.fillStyle = '#e8e8e8'
    ctx.fillRect(0, 0, FRAME_W, FRAME_H)
    if (photoImg) {
      ctx.drawImage(photoImg, pos.x, pos.y, photoImg.width * scale, photoImg.height * scale)
    }
    if (frameImg) {
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
      // Highlight active
      if (t.id === activeText) {
        const w = ctx.measureText(t.text).width
        ctx.strokeStyle = '#6d28d9'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        ctx.strokeRect(t.x - 4, t.y - 4, w + 8, t.fontSize + 8)
        ctx.setLineDash([])
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
      setFrameImg(img); setSelectedPreset(preset.id)
    } catch { alert('Không tải được khung. Hãy đảm bảo file ảnh đã được đặt vào thư mục public/frames/') }
  }

  async function handleFrameUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setFrameImg(await loadImageFromFile(file)); setSelectedPreset(null)
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

  // Hit-test: which text layer did the user click?
  function hitTestText(cx: number, cy: number): string | null {
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
    const hit = hitTestText(cx, cy)
    if (hit) {
      setActiveText(hit)
      setDragTarget(hit)
      const t = textLayers.find(x => x.id === hit)!
      dragStart.current = { mx: e.clientX, my: e.clientY, px: t.x, py: t.y }
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
    <div className="p-6 md:p-8 pb-16 min-h-screen" style={{ background: '#f8f9fb' }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Layers size={20} className="text-violet-500" />Frame Composer
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Ghép ảnh vào khung, thêm chữ — 650×371px</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start max-w-5xl">
        {/* Canvas */}
        <div ref={containerRef} className="flex-1 min-w-0 space-y-2">
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm bg-white"
            style={{ width: '100%', height: FRAME_H * displayScale }}>
            <canvas ref={canvasRef} width={FRAME_W} height={FRAME_H}
              style={{
                display: 'block', width: FRAME_W * displayScale, height: FRAME_H * displayScale,
                cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none',
              }}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove}
              onPointerUp={onPointerUp} onPointerLeave={onPointerUp} onWheel={onWheel}
            />
          </div>
          <p className="text-xs text-gray-400 text-center">
            {ready ? `Kéo ảnh/chữ để di chuyển · Cuộn chuột để zoom ảnh · ${Math.round(scale * 100)}%` : 'Chọn khung và upload ảnh để bắt đầu'}
          </p>
        </div>

        {/* Controls */}
        <div className="space-y-3 w-full lg:w-64 shrink-0">

          {/* 1. Frame */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">1. Khung</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_FRAMES.map(p => (
                <button key={p.id} onClick={() => handlePresetSelect(p)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all',
                    selectedPreset === p.id ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 hover:border-violet-300 text-gray-600')}>
                  {selectedPreset === p.id && <Check size={11} />}{p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2"><div className="flex-1 h-px bg-gray-100" /><span className="text-[11px] text-gray-400">hoặc</span><div className="flex-1 h-px bg-gray-100" /></div>
            <label className={cn('flex items-center gap-2 p-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-xs',
              frameImg && !selectedPreset ? 'border-violet-300 bg-violet-50 text-violet-600' : 'border-gray-200 hover:border-violet-300 text-gray-500')}>
              <Upload size={13} />
              {frameImg && !selectedPreset ? '✓ Đã upload khung' : 'Upload khung (PNG)'}
              <input type="file" accept="image/png,image/*" className="hidden" onChange={handleFrameUpload} />
            </label>
          </div>

          {/* 2. Photo */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">2. Ảnh</p>
            <label className={cn('flex items-center gap-2 p-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-xs',
              photoImg ? 'border-violet-300 bg-violet-50 text-violet-600' : 'border-gray-200 hover:border-violet-300 text-gray-500')}>
              <Upload size={13} />
              {photoImg ? '✓ Đã tải ảnh' : 'JPG, PNG, WebP'}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
            {photoImg && (
              <div className="flex items-center gap-1.5 pt-1">
                <button onClick={() => setScale(s => Math.max(0.05, s - 0.05))} className="p-1 rounded hover:bg-gray-100"><ZoomOut size={13} className="text-gray-500" /></button>
                <input type="range" min={0.05} max={10} step={0.01} value={scale} onChange={e => setScale(parseFloat(e.target.value))} className="flex-1 accent-violet-500" />
                <button onClick={() => setScale(s => Math.min(10, s + 0.05))} className="p-1 rounded hover:bg-gray-100"><ZoomIn size={13} className="text-gray-500" /></button>
                <button onClick={handleReset} className="p-1 rounded hover:bg-gray-100"><RotateCcw size={13} className="text-gray-500" /></button>
              </div>
            )}
          </div>

          {/* 3. Text */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">3. Chữ (Roboto)</p>

            {/* Add text */}
            <div className="flex gap-2">
              <input value={newText} onChange={e => setNewText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addText()}
                placeholder="Nhập chữ..."
                className="flex-1 text-xs border rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-violet-200" />
              <button onClick={addText}
                className="px-3 py-2 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 flex items-center gap-1">
                <Type size={12} />Thêm
              </button>
            </div>

            {/* Style controls for new text */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Cỡ chữ: {fontSize}px</p>
                <input type="range" min={10} max={60} value={fontSize}
                  onChange={e => { setFontSize(+e.target.value); updateActiveText({ fontSize: +e.target.value }) }}
                  className="w-full accent-violet-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Màu chữ</p>
                <input type="color" value={textColor}
                  onChange={e => { setTextColor(e.target.value); updateActiveText({ color: e.target.value }) }}
                  className="w-full h-8 rounded cursor-pointer border border-gray-200" />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setBold(b => !b); updateActiveText({ bold: !bold }) }}
                className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                  bold ? 'bg-violet-100 border-violet-400 text-violet-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}>
                <Bold size={13} className="inline" /> Bold
              </button>
              <button onClick={() => { setItalic(i => !i); updateActiveText({ italic: !italic }) }}
                className={cn('flex-1 py-1.5 rounded-lg text-xs border transition-colors italic',
                  italic ? 'bg-violet-100 border-violet-400 text-violet-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}>
                <Italic size={13} className="inline" /> Italic
              </button>
            </div>

            {/* Text layers list */}
            {textLayers.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-gray-100">
                <p className="text-[10px] text-gray-400">Click để chọn · kéo trên canvas để di chuyển</p>
                {textLayers.map(t => (
                  <div key={t.id}
                    onClick={() => { setActiveText(t.id); setFontSize(t.fontSize); setTextColor(t.color); setBold(t.bold); setItalic(t.italic) }}
                    className={cn('flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors',
                      activeText === t.id ? 'bg-violet-50 border border-violet-200' : 'hover:bg-gray-50 border border-transparent')}>
                    <span className="flex-1 truncate font-medium" style={{ color: t.color === '#ffffff' ? '#6b7280' : t.color }}>{t.text}</span>
                    <span className="text-gray-400 text-[10px]">{t.fontSize}px</span>
                    {activeText === t.id && (
                      <button onClick={e => { e.stopPropagation(); deleteActiveText() }}
                        className="text-red-400 hover:text-red-600 text-[10px] px-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeLayer && (
              <p className="text-[10px] text-violet-600 bg-violet-50 rounded px-2 py-1">
                Đang chỉnh: <strong>{activeLayer.text}</strong> — kéo trên canvas để đặt vị trí
              </p>
            )}
          </div>

          {/* Download */}
          <div className="space-y-2">
            <Button onClick={handleDownloadJPG} disabled={!ready || downloading} className="w-full gap-2 bg-violet-600 hover:bg-violet-700">
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? 'Đang nén...' : 'Tải JPG < 100KB'}
            </Button>
            {jpgSize && <p className="text-xs text-center text-gray-500">✓ {jpgSize}KB</p>}
            <Button onClick={handleDownloadPNG} disabled={!ready} variant="outline" className="w-full gap-2 text-gray-600">
              <Download size={14} />Tải PNG (gốc)
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
