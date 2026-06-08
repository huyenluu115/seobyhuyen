'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Layers, Download, Upload, ZoomIn, ZoomOut, RotateCcw, Loader2, Check } from 'lucide-react'

const FRAME_W = 650
const FRAME_H = 371

const PRESET_FRAMES = [
  {
    id: 'vnce',
    label: 'VNCE',
    src: '/frames/vnce-frame.png',
    preview: '/frames/vnce-frame.png',
  },
]

export default function FrameComposerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [frameImg, setFrameImg] = useState<HTMLImageElement | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [jpgSize, setJpgSize] = useState<number | null>(null)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const [displayScale, setDisplayScale] = useState(1)

  useEffect(() => {
    function update() {
      if (!containerRef.current) return
      const w = containerRef.current.offsetWidth
      setDisplayScale(Math.min(1, w / FRAME_W))
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
  }, [frameImg, photoImg, scale, pos])

  useEffect(() => { draw() }, [draw])

  function loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
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
    if (selectedPreset === preset.id) {
      setSelectedPreset(null)
      setFrameImg(null)
      return
    }
    try {
      const img = await loadImageFromUrl(preset.src)
      setFrameImg(img)
      setSelectedPreset(preset.id)
    } catch {
      alert('Không tải được khung. Hãy đảm bảo file ảnh đã được đặt vào thư mục public/frames/')
    }
  }

  async function handleFrameUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const img = await loadImageFromFile(file)
    setFrameImg(img)
    setSelectedPreset(null)
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const img = await loadImageFromFile(file)
    const s = Math.max(FRAME_W / img.width, FRAME_H / img.height)
    setScale(s)
    setPos({ x: (FRAME_W - img.width * s) / 2, y: (FRAME_H - img.height * s) / 2 })
    setPhotoImg(img)
    setJpgSize(null)
  }

  function toCanvasCoords(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    if (!canvas) return { cx: clientX, cy: clientY }
    const rect = canvas.getBoundingClientRect()
    return {
      cx: (clientX - rect.left) / displayScale,
      cy: (clientY - rect.top) / displayScale,
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!photoImg) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return
    const dx = (e.clientX - dragStart.current.mx) / displayScale
    const dy = (e.clientY - dragStart.current.my) / displayScale
    setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy })
  }

  function onPointerUp() { setDragging(false) }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    if (!photoImg) return
    const { cx, cy } = toCanvasCoords(e.clientX, e.clientY)
    const delta = -e.deltaY * 0.001
    setScale(prev => {
      const next = Math.max(0.05, Math.min(10, prev + delta))
      setPos(p => ({
        x: cx - (cx - p.x) * (next / prev),
        y: cy - (cy - p.y) * (next / prev),
      }))
      return next
    })
  }

  function handleReset() {
    if (!photoImg) return
    const s = Math.max(FRAME_W / photoImg.width, FRAME_H / photoImg.height)
    setScale(s)
    setPos({ x: (FRAME_W - photoImg.width * s) / 2, y: (FRAME_H - photoImg.height * s) / 2 })
  }

  function handleDownloadPNG() {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = 'framed-image.png'
    a.click()
  }

  async function handleDownloadJPG() {
    const canvas = canvasRef.current
    if (!canvas) return
    setDownloading(true)
    const off = document.createElement('canvas')
    off.width = FRAME_W; off.height = FRAME_H
    const ctx = off.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, FRAME_W, FRAME_H)
    ctx.drawImage(canvas, 0, 0)
    let lo = 0.05, hi = 0.95, bestBlob: Blob | null = null
    for (let i = 0; i < 14; i++) {
      const q = (lo + hi) / 2
      const blob = await new Promise<Blob | null>(r => off.toBlob(r, 'image/jpeg', q))
      if (!blob) break
      if (blob.size <= 100 * 1024) { bestBlob = blob; lo = q }
      else hi = q
    }
    setDownloading(false)
    if (!bestBlob) return
    setJpgSize(Math.round(bestBlob.size / 1024))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(bestBlob)
    a.download = 'framed-image.jpg'
    a.click()
  }

  const ready = !!(frameImg || photoImg)

  return (
    <div className="p-6 md:p-8 pb-16 min-h-screen" style={{ background: '#f8f9fb' }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Layers size={20} className="text-violet-500" />Frame Composer
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Ghép ảnh vào khung — 650×371px. Kéo để di chuyển, cuộn chuột để zoom.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start max-w-5xl">
        {/* Canvas */}
        <div ref={containerRef} className="flex-1 min-w-0 space-y-2">
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm bg-white"
            style={{ width: '100%', height: FRAME_H * displayScale }}>
            <canvas
              ref={canvasRef}
              width={FRAME_W}
              height={FRAME_H}
              style={{
                display: 'block',
                width: FRAME_W * displayScale,
                height: FRAME_H * displayScale,
                cursor: dragging ? 'grabbing' : photoImg ? 'grab' : 'default',
                touchAction: 'none',
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onWheel={onWheel}
            />
          </div>
          {!ready && <p className="text-xs text-gray-400 text-center">Chọn khung và upload ảnh để bắt đầu</p>}
          {ready && (
            <p className="text-xs text-gray-400 text-center">
              Kéo để di chuyển ảnh · Cuộn chuột để zoom · {Math.round(scale * 100)}%
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4 w-full lg:w-60 shrink-0">

          {/* Step 1: Frame */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">1. Chọn khung</p>

            {/* Preset frames */}
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500 font-medium">Khung có sẵn:</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_FRAMES.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    className={cn(
                      'relative flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-medium transition-all',
                      selectedPreset === preset.id
                        ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : 'border-gray-200 hover:border-violet-300 text-gray-600 hover:bg-violet-50'
                    )}
                  >
                    {selectedPreset === preset.id && (
                      <Check size={12} className="text-violet-600" />
                    )}
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] text-gray-400">hoặc</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Upload custom frame */}
            <label className={cn(
              'flex items-center gap-2 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
              frameImg && !selectedPreset
                ? 'border-violet-300 bg-violet-50'
                : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50'
            )}>
              <Upload size={14} className={frameImg && !selectedPreset ? 'text-violet-500' : 'text-gray-400'} />
              <span className="text-xs text-gray-500">
                {frameImg && !selectedPreset
                  ? <span className="text-violet-600 font-semibold">✓ Đã upload khung</span>
                  : 'Upload khung của bạn (PNG)'}
              </span>
              <input type="file" accept="image/png,image/*" className="hidden" onChange={handleFrameUpload} />
            </label>
          </div>

          {/* Step 2: Photo */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">2. Ảnh của bạn</p>
            <label className={cn(
              'flex items-center gap-2 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
              photoImg ? 'border-violet-300 bg-violet-50' : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50'
            )}>
              <Upload size={14} className={photoImg ? 'text-violet-500' : 'text-gray-400'} />
              <span className="text-xs text-gray-500">
                {photoImg ? <span className="text-violet-600 font-semibold">✓ Đã tải ảnh</span> : 'JPG, PNG, WebP'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          </div>

          {/* Zoom controls */}
          {photoImg && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Zoom ảnh</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setScale(s => Math.max(0.05, s - 0.05))}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ZoomOut size={15} className="text-gray-600" />
                </button>
                <input type="range" min={0.05} max={10} step={0.01} value={scale}
                  onChange={e => setScale(parseFloat(e.target.value))}
                  className="flex-1 accent-violet-500" />
                <button onClick={() => setScale(s => Math.min(10, s + 0.05))}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ZoomIn size={15} className="text-gray-600" />
                </button>
              </div>
              <button onClick={handleReset}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-violet-600 py-1.5 rounded-lg hover:bg-violet-50 transition-colors">
                <RotateCcw size={12} />Căn giữa & reset
              </button>
            </div>
          )}

          {/* Download */}
          <div className="space-y-2">
            <Button onClick={handleDownloadJPG} disabled={!ready || downloading}
              className="w-full gap-2 bg-violet-600 hover:bg-violet-700">
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? 'Đang nén...' : 'Tải JPG < 100KB'}
            </Button>
            {jpgSize && <p className="text-xs text-center text-gray-500">✓ {jpgSize}KB</p>}
            <Button onClick={handleDownloadPNG} disabled={!ready} variant="outline"
              className="w-full gap-2 text-gray-600">
              <Download size={14} />Tải PNG (gốc)
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
