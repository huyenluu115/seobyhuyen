'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Monitor, Smartphone, Eye } from 'lucide-react'

// Google truncates titles at ~600px (desktop) with ~20px Arial/sans-serif
// We measure actual pixel width using a hidden span

function StatusBadge({ val, ok, warn, unit = 'ký tự' }: { val: number; ok: number; warn: number; unit?: string }) {
  const color = val <= ok ? 'text-green-600 bg-green-50 border-green-200'
    : val <= warn ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
    : 'text-red-600 bg-red-50 border-red-200'
  const label = val <= ok ? 'Tốt' : val <= warn ? 'Hơi dài' : 'Quá dài'
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', color)}>
      {val} {unit} — {label}
    </span>
  )
}

export default function TitlePreviewPage() {
  const [title, setTitle] = useState('')
  const [meta, setMeta] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [siteName, setSiteName] = useState('')
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop')
  const [titlePx, setTitlePx] = useState(0)

  const measureRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (measureRef.current) {
      setTitlePx(Math.round(measureRef.current.getBoundingClientRect().width))
    }
  }, [title])

  // Truncate title based on pixel width (simulated)
  const TITLE_LIMIT_PX = view === 'desktop' ? 600 : 520
  const titleOk = titlePx <= TITLE_LIMIT_PX

  // Truncate displayed title at ~TITLE_LIMIT_PX
  function truncateTitle(t: string, maxPx: number) {
    if (!measureRef.current || titlePx <= maxPx) return t
    // Estimate chars per px
    const pxPerChar = titlePx / (t.length || 1)
    const maxChars = Math.floor(maxPx / pxPerChar)
    return t.slice(0, maxChars) + '...'
  }

  const displayTitle = title ? truncateTitle(title, TITLE_LIMIT_PX) : 'Tiêu đề trang của bạn'
  const displayMeta = meta
    ? (view === 'desktop' ? meta.slice(0, 160) : meta.slice(0, 120)) + (meta.length > (view === 'desktop' ? 160 : 120) ? '...' : '')
    : 'Mô tả trang sẽ hiển thị ở đây. Google thường hiển thị 1–2 dòng mô tả bên dưới tiêu đề trong kết quả tìm kiếm.'

  const breadcrumb = siteUrl
    ? siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : 'example.com › danh-muc › trang'

  const displaySiteName = siteName || 'Tên website'

  const titleStatus = titlePx <= 580 ? 'ok' : titlePx <= 620 ? 'warn' : 'fail'
  const metaStatus = meta.length <= 155 ? 'ok' : meta.length <= 170 ? 'warn' : 'fail'

  return (
    <div className="p-6 md:p-8 pb-16 min-h-screen" style={{ background: '#f8f9fb' }}>
      {/* Hidden measure span */}
      <span ref={measureRef} aria-hidden className="absolute opacity-0 pointer-events-none whitespace-nowrap"
        style={{ fontSize: '20px', fontFamily: 'Arial, sans-serif', fontWeight: 400 }}>
        {title}
      </span>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Eye size={20} className="text-blue-500" />
          Title & Meta Previewer
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Xem trước kết quả tìm kiếm Google — desktop & mobile</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Thông tin trang</p>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-600">Title tag *</label>
                {title && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">~{titlePx}px</span>
                    <StatusBadge val={titlePx} ok={580} warn={620} unit="px" />
                  </div>
                )}
              </div>
              <Input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Tiêu đề trang — từ khóa chính ở đầu" className="text-sm" />
              <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', titleStatus === 'ok' ? 'bg-green-400' : titleStatus === 'warn' ? 'bg-yellow-400' : 'bg-red-400')}
                  style={{ width: `${Math.min(titlePx / 700 * 100, 100)}%` }} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Tốt: ≤580px · Hơi dài: ≤620px · Quá dài: bị cắt</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-600">Meta description</label>
                {meta && <StatusBadge val={meta.length} ok={155} warn={170} />}
              </div>
              <textarea value={meta} onChange={e => setMeta(e.target.value)}
                placeholder="Mô tả trang — chứa từ khóa, hấp dẫn người click (70–155 ký tự)"
                rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', metaStatus === 'ok' ? 'bg-green-400' : metaStatus === 'warn' ? 'bg-yellow-400' : 'bg-red-400')}
                  style={{ width: `${Math.min(meta.length / 200 * 100, 100)}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">URL trang</label>
                <Input value={siteUrl} onChange={e => setSiteUrl(e.target.value)}
                  placeholder="https://example.com/page" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Tên website</label>
                <Input value={siteName} onChange={e => setSiteName(e.target.value)}
                  placeholder="Tên thương hiệu" className="text-sm" />
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-blue-800">Checklist Title tốt</p>
            {[
              ['Từ khóa chính ở đầu title', title.length > 0],
              ['Độ dài 50–60 ký tự (~≤580px)', titlePx > 0 && titlePx <= 580],
              ['Title & H1 khác nhau một chút', true],
              ['Meta desc 70–155 ký tự', meta.length >= 70 && meta.length <= 155],
              ['Meta desc có từ khóa chính', meta.length > 0],
            ].map(([text, pass]) => (
              <div key={text as string} className="flex items-center gap-2 text-xs">
                <span className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                  pass ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400')}>
                  {pass ? '✓' : '·'}
                </span>
                <span className={pass ? 'text-blue-800' : 'text-blue-500'}>{text as string}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          {/* View toggle */}
          <div className="flex gap-2">
            {(['desktop', 'mobile'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all',
                  view === v ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50')}>
                {v === 'desktop' ? <Monitor size={13} /> : <Smartphone size={13} />}
                {v === 'desktop' ? 'Desktop' : 'Mobile'}
              </button>
            ))}
          </div>

          {/* SERP Preview card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-4">Preview Google SERP</p>

            <div className={cn('border border-gray-200 rounded-xl p-4 bg-white', view === 'mobile' ? 'max-w-sm' : '')}>
              {/* Google search bar mock */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 via-red-500 to-yellow-400 shrink-0" />
                <div className="flex-1 h-7 bg-gray-100 rounded-full px-3 flex items-center">
                  <span className="text-xs text-gray-400">từ khóa tìm kiếm...</span>
                </div>
              </div>

              {/* Result snippet */}
              <div className="space-y-1">
                {/* Site name + favicon */}
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-sm bg-gray-200 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-gray-700 leading-tight">{displaySiteName}</p>
                    <p className="text-[11px] text-gray-500 leading-tight">{breadcrumb}</p>
                  </div>
                </div>

                {/* Title */}
                <p className={cn('font-medium leading-snug cursor-pointer hover:underline',
                  view === 'desktop' ? 'text-xl' : 'text-lg',
                  !titleOk ? 'text-blue-600' : 'text-blue-700')}
                  style={{ fontFamily: 'Arial, sans-serif' }}>
                  {displayTitle}
                  {!titleOk && <span className="text-gray-400"> ...</span>}
                </p>

                {/* Date + Description */}
                <p className="text-sm text-gray-600 leading-snug" style={{ fontFamily: 'Arial, sans-serif' }}>
                  <span className="text-gray-500">26 thg 5, 2026 — </span>
                  {displayMeta}
                </p>
              </div>
            </div>

            {/* Pixel warning */}
            {title && !titleOk && (
              <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                <span className="text-red-500 text-sm shrink-0">⚠</span>
                <p className="text-xs text-red-700">Title ~{titlePx}px — vượt giới hạn {TITLE_LIMIT_PX}px ({view}). Google sẽ cắt và thêm dấu "..."</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
