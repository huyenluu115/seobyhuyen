'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Upload, Download, Trash2, ImageIcon, Package, Lock, Unlock, Sparkles, ChevronDown } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ImageItem {
  id: string
  file: File
  preview: string
  originalSize: number
  originalW: number
  originalH: number
  compressedBlob: Blob | null
  compressedSize: number
  compressedUrl: string
  outputW: number
  outputH: number
  status: 'pending' | 'processing' | 'done' | 'error'
  outputName: string
}

type Format = 'webp' | 'jpeg' | 'png'

const PRESETS = [
  { label: 'Gốc', w: 0, h: 0 },
  { label: '1920×1080', w: 1920, h: 1080 },
  { label: '1200×630', w: 1200, h: 630 },
  { label: '1200×1200', w: 1200, h: 1200 },
  { label: '800×800', w: 800, h: 800 },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2) }
function fmtSize(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(2)} MB`
}
function ext(format: Format) { return format === 'jpeg' ? 'jpg' : format }
function outputName(name: string, format: Format) {
  return name.replace(/\.[^.]+$/, '') + '.' + ext(format)
}

async function getImageDimensions(file: File): Promise<{ w: number; h: number }> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }) }
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ w: 0, h: 0 }) }
    img.src = url
  })
}

async function compressImage(
  file: File, format: Format, quality: number,
  targetW: number, targetH: number, lockRatio: boolean,
): Promise<{ blob: Blob; outW: number; outH: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.naturalWidth
      let h = img.naturalHeight

      if (lockRatio) {
        // Proportional — fit within targetW × targetH
        if (targetW > 0 && targetH > 0) {
          const scale = Math.min(targetW / w, targetH / h)
          if (scale < 1) { w = Math.round(w * scale); h = Math.round(h * scale) }
        } else if (targetW > 0 && targetW < w) {
          h = Math.round(h * targetW / w); w = targetW
        } else if (targetH > 0 && targetH < h) {
          w = Math.round(w * targetH / h); h = targetH
        }
      } else {
        // Exact dimensions
        if (targetW > 0) w = targetW
        if (targetH > 0) h = targetH
      }

      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        blob => blob ? resolve({ blob, outW: w, outH: h }) : reject(new Error('toBlob failed')),
        `image/${format}`, quality / 100,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Load failed')) }
    img.src = url
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ImageToolPage() {
  const [items, setItems] = useState<ImageItem[]>([])
  const [format, setFormat] = useState<Format>('webp')
  const [quality, setQuality] = useState(82)
  const [targetW, setTargetW] = useState<number>(1200)
  const [targetH, setTargetH] = useState<number>(0)
  const [lockRatio, setLockRatio] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Add files ────────────────────────────────────────────────────────────────
  async function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!arr.length) return
    const newItems: ImageItem[] = await Promise.all(arr.map(async f => {
      const { w, h } = await getImageDimensions(f)
      return {
        id: uid(), file: f, preview: URL.createObjectURL(f),
        originalSize: f.size, originalW: w, originalH: h,
        compressedBlob: null, compressedSize: 0, compressedUrl: '',
        outputW: 0, outputH: 0, status: 'pending' as const,
        outputName: outputName(f.name, format),
      }
    }))
    setItems(prev => [...prev, ...newItems])
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files)
  }, [format])

  // ── Compress ─────────────────────────────────────────────────────────────────
  async function handleCompress() {
    const todo = items.filter(i => i.status !== 'done')
    if (!todo.length) return
    setProcessing(true)
    for (const item of todo) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i))
      try {
        const { blob, outW, outH } = await compressImage(item.file, format, quality, targetW, targetH, lockRatio)
        const url = URL.createObjectURL(blob)
        setItems(prev => prev.map(i => i.id === item.id ? {
          ...i, status: 'done', compressedBlob: blob, compressedSize: blob.size,
          compressedUrl: url, outputW: outW, outputH: outH,
          outputName: outputName(item.file.name, format),
        } : i))
      } catch {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error' } : i))
      }
    }
    setProcessing(false)
  }

  // ── Download ─────────────────────────────────────────────────────────────────
  function downloadOne(item: ImageItem) {
    if (!item.compressedBlob) return
    const a = document.createElement('a'); a.href = item.compressedUrl; a.download = item.outputName; a.click()
  }

  async function downloadAll() {
    const done = items.filter(i => i.status === 'done' && i.compressedBlob)
    if (!done.length) return
    if (done.length === 1) { downloadOne(done[0]); return }
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    done.forEach(item => zip.file(item.outputName, item.compressedBlob!))
    const blob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'compressed.zip'; a.click()
  }

  function removeItem(id: string) {
    setItems(prev => {
      const item = prev.find(i => i.id === id)
      if (item) { URL.revokeObjectURL(item.preview); if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl) }
      return prev.filter(i => i.id !== id)
    })
  }

  function clearAll() {
    items.forEach(i => { URL.revokeObjectURL(i.preview); if (i.compressedUrl) URL.revokeObjectURL(i.compressedUrl) })
    setItems([])
  }

  function applyPreset(w: number, h: number) {
    setTargetW(w); setTargetH(h)
    setLockRatio(w === 0 || h === 0 || w === h)
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const doneItems = items.filter(i => i.status === 'done')
  const totalOrig = doneItems.reduce((s, i) => s + i.originalSize, 0)
  const totalComp = doneItems.reduce((s, i) => s + i.compressedSize, 0)
  const savedPct = totalOrig > 0 ? Math.round((1 - totalComp / totalOrig) * 100) : 0

  const qLabel = quality >= 85 ? 'Cao' : quality >= 70 ? 'Cân bằng' : quality >= 55 ? 'Nhỏ' : 'Tối thiểu'
  const qColor = quality >= 85 ? 'text-green-600' : quality >= 70 ? 'text-blue-600' : quality >= 55 ? 'text-yellow-600' : 'text-red-500'

  return (
    <div className="p-6 md:p-8 pb-16 min-h-screen" style={{ background: '#f8f9fb' }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ImageIcon size={20} className="text-violet-500" />
            Image Compressor
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Nén & resize ảnh ngay trong trình duyệt — không upload lên server</p>
        </div>
        {items.length > 0 && (
          <button onClick={clearAll} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={13} />Xóa tất cả
          </button>
        )}
      </div>

      {/* Settings card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Format */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Định dạng</p>
            <div className="flex gap-2">
              {(['webp', 'jpeg', 'png'] as Format[]).map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  className={cn('relative flex-1 py-2.5 text-xs font-semibold rounded-xl border transition-all',
                    format === f
                      ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-200'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100')}>
                  {f === 'jpeg' ? 'JPG' : f.toUpperCase()}
                  {f === 'webp' && (
                    <span className={cn('absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded-full',
                      format === 'webp' ? 'bg-white text-violet-600' : 'bg-violet-100 text-violet-600')}>
                      ✦
                    </span>
                  )}
                </button>
              ))}
            </div>
            {format === 'webp' && <p className="text-[11px] text-violet-500 mt-1.5 font-medium">✦ Nhỏ hơn JPG ~30–50%</p>}
          </div>

          {/* Quality */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Chất lượng</p>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-bold text-gray-900">{quality}%</span>
              <span className={cn('text-xs font-semibold', qColor)}>{qLabel}</span>
            </div>
            <input type="range" min={40} max={95} step={1} value={quality}
              onChange={e => setQuality(+e.target.value)}
              className="w-full h-1.5 rounded-full accent-violet-600 cursor-pointer" />
            <div className="flex justify-between text-[10px] text-gray-300 mt-1">
              <span>40 — Tối thiểu</span><span>95 — Cao</span>
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Kích thước (px)</p>

            {/* W × H inputs */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 font-medium">Rộng (W)</label>
                <input type="number" value={targetW || ''} onChange={e => setTargetW(+e.target.value || 0)}
                  placeholder="tự động"
                  className="w-full mt-0.5 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>

              <button onClick={() => setLockRatio(v => !v)}
                className={cn('mt-5 p-2 rounded-lg border transition-all shrink-0',
                  lockRatio ? 'bg-violet-50 border-violet-200 text-violet-600' : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100')}>
                {lockRatio ? <Lock size={13} /> : <Unlock size={13} />}
              </button>

              <div className="flex-1">
                <label className="text-[10px] text-gray-400 font-medium">Cao (H)</label>
                <input type="number" value={targetH || ''} onChange={e => setTargetH(+e.target.value || 0)}
                  placeholder={lockRatio ? 'auto' : 'tự động'}
                  disabled={lockRatio && targetW > 0 && targetH === 0}
                  className={cn('w-full mt-0.5 border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300',
                    lockRatio && targetW > 0 && targetH === 0
                      ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-gray-200 text-gray-800')} />
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => applyPreset(p.w, p.h)}
                  className={cn('px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all',
                    targetW === p.w && targetH === p.h
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700')}>
                  {p.label}
                </button>
              ))}
            </div>
            {!lockRatio && (
              <p className="text-[11px] text-amber-600 mt-1.5">⚠ Tỷ lệ tự do — ảnh có thể bị méo</p>
            )}
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-2xl transition-all cursor-pointer mb-5',
          items.length === 0 ? 'py-14' : 'py-5',
          dragging ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50/30',
        )}>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => e.target.files && addFiles(e.target.files)} />
        <div className="flex flex-col items-center gap-2 text-center">
          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center transition-colors',
            dragging ? 'bg-violet-100' : 'bg-gray-100')}>
            <Upload size={20} className={dragging ? 'text-violet-500' : 'text-gray-400'} />
          </div>
          <div>
            <p className={cn('text-sm font-semibold', dragging ? 'text-violet-600' : 'text-gray-600')}>
              {dragging ? 'Thả ảnh vào đây' : items.length === 0 ? 'Kéo thả ảnh hoặc click để chọn' : 'Thêm ảnh khác'}
            </p>
            {items.length === 0 && <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WebP, GIF • Batch upload</p>}
          </div>
        </div>
      </div>

      {/* Action bar */}
      {items.length > 0 && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Button onClick={handleCompress}
            disabled={processing || items.every(i => i.status === 'done')}
            className="gap-2 bg-violet-600 hover:bg-violet-700 shadow-sm shadow-violet-200">
            <Sparkles size={14} />
            {processing ? 'Đang xử lý...' : `Nén ${items.filter(i => i.status !== 'done').length} ảnh`}
          </Button>

          {doneItems.length > 0 && (
            <Button variant="outline" onClick={downloadAll} className="gap-2 border-gray-200">
              {doneItems.length > 1 ? <Package size={14} /> : <Download size={14} />}
              {doneItems.length > 1 ? `Tải ZIP (${doneItems.length} ảnh)` : 'Tải xuống'}
            </Button>
          )}

          {doneItems.length > 0 && (
            <div className="ml-auto flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-gray-500">Tiết kiệm</p>
                <p className="text-sm font-bold text-green-600">
                  {fmtSize(totalOrig - totalComp)} <span className="font-normal text-green-500">({savedPct}%)</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Sau nén</p>
                <p className="text-sm font-bold text-gray-700">{fmtSize(totalComp)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {items.map(item => {
            const pct = item.status === 'done'
              ? Math.round((1 - item.compressedSize / item.originalSize) * 100) : 0
            const isGood = pct >= 20
            return (
              <div key={item.id}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">

                {/* Thumbnail */}
                <div className="relative aspect-square bg-gray-50 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.status === 'done' ? item.compressedUrl : item.preview}
                    alt={item.file.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Processing spinner */}
                  {item.status === 'processing' && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                      <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {/* Done badge */}
                  {item.status === 'done' && (
                    <div className={cn('absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white',
                      isGood ? 'bg-green-500' : 'bg-blue-500')}>
                      -{pct}%
                    </div>
                  )}

                  {/* Error badge */}
                  {item.status === 'error' && (
                    <div className="absolute inset-0 bg-red-50/90 flex items-center justify-center">
                      <p className="text-xs text-red-500 font-medium">Lỗi</p>
                    </div>
                  )}

                  {/* Remove button */}
                  <button onClick={() => removeItem(item.id)}
                    className="absolute top-2 left-2 w-6 h-6 bg-black/40 hover:bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={10} />
                  </button>

                  {/* Dimension overlay */}
                  {item.status === 'done' && item.outputW > 0 && (
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                      {item.outputW}×{item.outputH}
                    </div>
                  )}
                  {item.status === 'pending' && item.originalW > 0 && (
                    <div className="absolute bottom-2 left-2 bg-black/30 text-white text-[10px] px-1.5 py-0.5 rounded-md">
                      {item.originalW}×{item.originalH}
                    </div>
                  )}
                </div>

                {/* Info row */}
                <div className="px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-gray-700 truncate leading-tight" title={item.file.name}>
                    {item.status === 'done' ? item.outputName : item.file.name}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="text-[11px] text-gray-400 leading-tight">
                      {item.status === 'done' ? (
                        <>
                          <span className="line-through">{fmtSize(item.originalSize)}</span>
                          <span className="text-green-600 font-medium ml-1">{fmtSize(item.compressedSize)}</span>
                        </>
                      ) : (
                        <span>{fmtSize(item.originalSize)}</span>
                      )}
                    </div>
                    {item.status === 'done' && (
                      <button onClick={() => downloadOne(item)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-800 transition-colors">
                        <Download size={11} />Tải
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
