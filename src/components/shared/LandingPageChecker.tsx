'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, AlertCircle, Loader2, Globe } from 'lucide-react'

interface CheckItem {
  label: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
  fix?: string
}

function scoreColor(s: number) {
  return s >= 70 ? 'text-green-600' : s >= 50 ? 'text-yellow-600' : 'text-red-600'
}
function scoreBar(s: number) {
  return s >= 70 ? 'bg-green-400' : s >= 50 ? 'bg-yellow-400' : 'bg-red-400'
}
function scoreLabel(s: number) {
  return s >= 70 ? 'Tốt' : s >= 50 ? 'Cần cải thiện' : 'Chậm — cần fix'
}

function StatusIcon({ status }: { status: CheckItem['status'] }) {
  if (status === 'ok') return <CheckCircle size={15} className="text-green-500 shrink-0 mt-0.5" />
  if (status === 'warn') return <AlertCircle size={15} className="text-yellow-500 shrink-0 mt-0.5" />
  return <XCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
}

function buildChecklist(html: NonNullable<ReturnType<typeof parseResult>['html']>, kw: string): CheckItem[] {
  const items: CheckItem[] = []

  items.push({
    label: 'HTTPS (bảo mật)',
    status: html.https ? 'ok' : 'fail',
    detail: html.https ? 'Trang dùng HTTPS' : 'Trang không có HTTPS',
    fix: html.https ? undefined : 'Cài SSL certificate. Google ưu tiên trang HTTPS trong kết quả tìm kiếm.',
  })

  // Title
  if (!html.title) {
    items.push({ label: 'Thẻ Title', status: 'fail', detail: 'Không có thẻ <title>', fix: 'Thêm thẻ <title> chứa từ khóa chính, độ dài 50–60 ký tự.' })
  } else if (html.titleLen < 30 || html.titleLen > 65) {
    items.push({ label: 'Thẻ Title', status: 'warn', detail: `Title hiện tại: "${html.title}" (${html.titleLen} ký tự)`, fix: `Độ dài lý tưởng 50–60 ký tự. Hiện đang ${html.titleLen < 30 ? 'quá ngắn' : 'quá dài'}.` })
  } else {
    items.push({ label: 'Thẻ Title', status: 'ok', detail: `"${html.title}" (${html.titleLen} ký tự)` })
  }

  if (kw && !html.titleHasKeyword) {
    items.push({ label: `Từ khóa trong Title`, status: 'warn', detail: `"${kw}" không có trong title`, fix: `Thêm "${kw}" vào đầu title để tăng Ad Relevance và QS.` })
  }

  // Meta desc
  if (!html.metaDesc) {
    items.push({ label: 'Meta Description', status: 'fail', detail: 'Không có meta description', fix: 'Thêm <meta name="description"> dài 150–160 ký tự, chứa từ khóa và CTA.' })
  } else if (html.metaDescLen < 70 || html.metaDescLen > 165) {
    items.push({ label: 'Meta Description', status: 'warn', detail: `${html.metaDescLen} ký tự — lý tưởng 150–160`, fix: `Viết lại meta description dài ${html.metaDescLen < 70 ? 'hơn' : 'ngắn hơn'}, chứa từ khóa và call-to-action.` })
  } else {
    items.push({ label: 'Meta Description', status: 'ok', detail: `${html.metaDescLen} ký tự` })
  }

  if (kw && !html.metaDescHasKeyword && html.metaDesc) {
    items.push({ label: 'Từ khóa trong Meta Description', status: 'warn', detail: `"${kw}" không xuất hiện trong meta description`, fix: `Thêm "${kw}" vào meta description để tăng relevance.` })
  }

  // H1
  if (html.h1s.length === 0) {
    items.push({ label: 'Thẻ H1', status: 'fail', detail: 'Không có thẻ H1', fix: 'Thêm đúng 1 thẻ H1 chứa từ khóa chính. H1 là tín hiệu relevance quan trọng nhất trên trang.' })
  } else if (html.h1s.length > 1) {
    items.push({ label: 'Thẻ H1', status: 'warn', detail: `Có ${html.h1s.length} thẻ H1: "${html.h1s.join('", "')}"`, fix: 'Chỉ nên có đúng 1 thẻ H1 mỗi trang. Chuyển các H1 thừa sang H2.' })
  } else {
    items.push({ label: 'Thẻ H1', status: 'ok', detail: `"${html.h1s[0]}"` })
  }

  if (kw && html.h1s.length > 0 && !html.h1HasKeyword) {
    items.push({ label: 'Từ khóa trong H1', status: 'warn', detail: `"${kw}" không có trong H1`, fix: `Thêm "${kw}" vào H1. Đây là yếu tố quan trọng nhất để Google đánh giá Landing Page Experience.` })
  }

  // Mobile
  items.push({
    label: 'Mobile Viewport',
    status: html.hasViewport ? 'ok' : 'fail',
    detail: html.hasViewport ? 'Trang có meta viewport' : 'Thiếu meta viewport — trang không responsive',
    fix: html.hasViewport ? undefined : 'Thêm <meta name="viewport" content="width=device-width, initial-scale=1"> vào <head>.',
  })

  // Images
  if (html.imagesWithoutAlt > 0) {
    items.push({
      label: `Alt text ảnh`,
      status: html.imagesWithoutAlt > html.totalImages / 2 ? 'fail' : 'warn',
      detail: `${html.imagesWithoutAlt}/${html.totalImages} ảnh không có alt text`,
      fix: 'Thêm alt text mô tả ảnh, bao gồm từ khóa khi phù hợp. Giúp SEO và tăng điểm Landing Page.',
    })
  } else if (html.totalImages > 0) {
    items.push({ label: 'Alt text ảnh', status: 'ok', detail: `${html.totalImages} ảnh đều có alt text` })
  }

  // CTA
  items.push({
    label: 'Call-to-Action (CTA)',
    status: html.hasCta ? 'ok' : 'warn',
    detail: html.hasCta ? `Tìm thấy CTA: "${html.ctaWords.join('", "')}"` : 'Không tìm thấy CTA rõ ràng',
    fix: html.hasCta ? undefined : 'Thêm CTA nổi bật (nút "Liên hệ ngay", "Nhận báo giá", "Tư vấn miễn phí") above-the-fold.',
  })

  // Schema
  items.push({
    label: 'Schema Markup',
    status: html.hasSchemaMarkup ? 'ok' : 'warn',
    detail: html.hasSchemaMarkup ? 'Có JSON-LD Schema markup' : 'Chưa có Schema markup',
    fix: html.hasSchemaMarkup ? undefined : 'Thêm JSON-LD Schema (Organization, LocalBusiness, FAQ...) để tăng rich snippet và CTR.',
  })

  return items
}

function parseResult(data: Record<string, unknown>) {
  return {
    html: data.htmlAnalysis as {
      https: boolean; title: string | null; titleLen: number; titleHasKeyword: boolean
      metaDesc: string | null; metaDescLen: number; metaDescHasKeyword: boolean
      h1s: string[]; h1HasKeyword: boolean; hasViewport: boolean
      imagesWithoutAlt: number; totalImages: number; hasCta: boolean; ctaWords: string[]
      contentLength: number; hasSchemaMarkup: boolean
    } | null,
    speed: data.speedData as {
      mobileScore: number; desktopScore: number; lcp: string; fcp: string
      tbt: string; cls: string; speedIndex: string
      opportunities: { title: string; savings: string }[]
    } | null,
  }
}

export function LandingPageChecker({ defaultKeyword = '' }: { defaultKeyword?: string }) {
  const [url, setUrl] = useState('')
  const [keyword, setKeyword] = useState(defaultKeyword)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ReturnType<typeof parseResult> | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState('')

  async function check() {
    if (!url.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      setStep('Đang fetch trang...')
      const res = await fetch(`/api/check-landing?url=${encodeURIComponent(url.trim())}&keyword=${encodeURIComponent(keyword.trim())}`)
      setStep('Đang chạy PageSpeed...')
      const data = await res.json()
      if (data.error && !data.htmlAnalysis) { setError(data.error); return }
      setResult(parseResult(data))
    } catch { setError('Không kiểm tra được. Thử lại.') }
    finally { setLoading(false); setStep('') }
  }

  const checklist = result?.html ? buildChecklist(result.html, keyword.trim()) : []
  const failCount = checklist.filter(c => c.status === 'fail').length
  const warnCount = checklist.filter(c => c.status === 'warn').length
  const fixItems = checklist.filter(c => c.status !== 'ok')

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b bg-gray-50">
        <div className="flex items-center gap-2 mb-1">
          <Globe size={15} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-800">Kiểm tra Landing Page</h3>
        </div>
        <p className="text-xs text-gray-500">Phân tích tốc độ, SEO on-page và gợi ý cải thiện điểm Landing Page Experience</p>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex gap-2">
          <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()}
            placeholder="https://example.com/landing-page"
            className="flex-1 text-xs border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200" />
          <input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()}
            placeholder="Từ khóa (tuỳ chọn)"
            className="w-48 text-xs border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200" />
          <Button size="sm" onClick={check} disabled={loading || !url.trim()} className="gap-1.5 shrink-0">
            {loading ? <><Loader2 size={12} className="animate-spin" />{step || 'Đang kiểm tra...'}</> : 'Kiểm tra'}
          </Button>
        </div>
        <p className="text-[11px] text-gray-400">Nhập từ khóa để kiểm tra xem keyword có xuất hiện đúng chỗ trên trang không (ảnh hưởng trực tiếp QS Landing Page)</p>

        {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        {result && (
          <div className="space-y-5 pt-1">
            {/* Speed scores */}
            {result.speed && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-3">Tốc độ tải trang (Google PageSpeed)</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'Mobile', score: result.speed.mobileScore },
                    { label: 'Desktop', score: result.speed.desktopScore },
                  ].map(({ label, score }) => (
                    <div key={label} className="border rounded-xl p-3">
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs text-gray-500">{label}</span>
                        <span className={cn('text-2xl font-bold', scoreColor(score))}>{score}<span className="text-xs text-gray-400">/100</span></span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', scoreBar(score))} style={{ width: `${score}%` }} />
                      </div>
                      <p className={cn('text-[11px] mt-1', scoreColor(score))}>{scoreLabel(score)}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'LCP', value: result.speed.lcp, tip: 'Largest Contentful Paint — tải phần tử lớn nhất' },
                    { label: 'FCP', value: result.speed.fcp, tip: 'First Contentful Paint — hiển thị nội dung đầu tiên' },
                    { label: 'TBT', value: result.speed.tbt, tip: 'Total Blocking Time — thời gian bị block' },
                    { label: 'CLS', value: result.speed.cls, tip: 'Cumulative Layout Shift — độ ổn định bố cục' },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-50 rounded-lg p-2" title={m.tip}>
                      <p className="text-[10px] text-gray-400">{m.label}</p>
                      <p className="text-sm font-semibold text-gray-800">{m.value}</p>
                    </div>
                  ))}
                </div>
                {result.speed.opportunities.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[11px] font-medium text-gray-500">PageSpeed gợi ý tối ưu:</p>
                    {result.speed.opportunities.map((op, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="text-red-400 shrink-0">→</span>
                        <span><strong>{op.title}</strong>{op.savings ? ` — tiết kiệm ${op.savings}` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            {result.html && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-semibold text-gray-700">Kiểm tra On-page</p>
                  {failCount > 0 && <span className="text-[11px] bg-red-100 text-red-600 rounded-full px-2 py-0.5 font-medium">{failCount} lỗi cần fix</span>}
                  {warnCount > 0 && <span className="text-[11px] bg-yellow-100 text-yellow-600 rounded-full px-2 py-0.5 font-medium">{warnCount} cần cải thiện</span>}
                </div>
                <div className="space-y-2">
                  {checklist.map((item, i) => (
                    <div key={i} className={cn('rounded-lg px-3 py-2.5',
                      item.status === 'ok' ? 'bg-green-50' : item.status === 'warn' ? 'bg-yellow-50' : 'bg-red-50'
                    )}>
                      <div className="flex items-start gap-2">
                        <StatusIcon status={item.status} />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-gray-700">{item.label}: </span>
                          <span className="text-xs text-gray-500">{item.detail}</span>
                          {item.fix && <p className="text-xs text-gray-600 mt-1"><strong>Cách fix:</strong> {item.fix}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Priority fix list */}
            {fixItems.length > 0 && (
              <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-orange-800 mb-2">Danh sách ưu tiên cần làm ({fixItems.length} mục)</p>
                <ol className="space-y-1.5">
                  {fixItems.map((item, i) => (
                    <li key={i} className="text-xs text-orange-700 flex gap-2">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-orange-200 flex items-center justify-center font-bold text-[10px] text-orange-800">{i + 1}</span>
                      <span><strong>{item.label}</strong> — {item.fix || item.detail}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {fixItems.length === 0 && result.html && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-xs text-green-700 font-medium text-center">
                ✓ Landing page đang tốt! Tiếp tục theo dõi định kỳ.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
