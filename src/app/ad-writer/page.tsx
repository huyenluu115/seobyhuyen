'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Copy, Check, Loader2, RefreshCw, AlertCircle, Sparkles } from 'lucide-react'

interface AdResult {
  headlines: string[]
  descriptions: string[]
  urlPaths: string[]
  tips: string[]
}

function charColor(len: number, max: number) {
  const pct = len / max
  if (pct > 1) return 'text-red-600 font-bold'
  if (pct > 0.9) return 'text-orange-500'
  return 'text-gray-400'
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
    </button>
  )
}

function AdPreview({ headlines, descriptions, urlPaths, domain }: {
  headlines: string[]; descriptions: string[]; urlPaths: string[]; domain: string
}) {
  const h1 = headlines[0] || 'Headline 1'
  const h2 = headlines[1] || 'Headline 2'
  const h3 = headlines[2] || 'Headline 3'
  const desc = descriptions[0] || ''
  const path = urlPaths.filter(Boolean).join('/')
  const displayUrl = `${domain}${path ? '/' + path : ''}`

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm">
      <p className="text-[11px] text-gray-400 mb-2 font-medium">Preview quảng cáo (Google Search)</p>
      <div className="space-y-0.5">
        <p className="text-xs text-green-700">{displayUrl}</p>
        <p className="text-base text-blue-700 font-medium leading-snug">
          {h1} | {h2} | {h3}
        </p>
        <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

export default function AdWriterPage() {
  const [keyword, setKeyword] = useState('')
  const [url, setUrl] = useState('')
  const [usp, setUsp] = useState('')
  const [industry, setIndustry] = useState('')
  const [language, setLanguage] = useState<'vi' | 'en'>('vi')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AdResult | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const domain = (() => { try { return new URL(url).hostname } catch { return 'example.com' } })()

  async function generate() {
    if (!keyword.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/generate-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim(), url: url.trim(), usp: usp.trim(), industry: industry.trim(), language }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResult(data)
    } catch { setError('Không kết nối được. Thử lại.') }
    finally { setLoading(false) }
  }

  function copyAll() {
    if (!result) return
    const text = [
      '=== HEADLINES ===',
      ...result.headlines.map((h, i) => `${i + 1}. ${h}`),
      '',
      '=== DESCRIPTIONS ===',
      ...result.descriptions.map((d, i) => `${i + 1}. ${d}`),
      '',
      '=== DISPLAY URL PATHS ===',
      result.urlPaths.join(' / '),
    ].join('\n')
    navigator.clipboard.writeText(text)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  const overLimitH = result?.headlines.filter(h => h.length > 30).length || 0
  const overLimitD = result?.descriptions.filter(d => d.length > 90).length || 0

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={18} className="text-purple-500" />
            Ad Copy Writer
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Tự động viết 15 headlines + 4 descriptions chuẩn RSA bằng AI</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input form */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Từ khóa chính <span className="text-red-500">*</span></label>
              <input value={keyword} onChange={e => setKeyword(e.target.value)}
                placeholder="vd: quan trắc môi trường lao động"
                className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">URL landing page</label>
              <input value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/dich-vu"
                className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Điểm khác biệt / USP</label>
              <textarea value={usp} onChange={e => setUsp(e.target.value)} rows={2}
                placeholder="vd: 15 năm kinh nghiệm, có chứng nhận ISO, tư vấn miễn phí, giao hàng trong 24h..."
                className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Ngành</label>
                <input value={industry} onChange={e => setIndustry(e.target.value)}
                  placeholder="vd: môi trường, y tế..."
                  className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Ngôn ngữ</label>
                <div className="flex rounded-lg border overflow-hidden text-xs">
                  <button onClick={() => setLanguage('vi')} className={cn('flex-1 py-2 font-medium transition-colors', language === 'vi' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>Tiếng Việt</button>
                  <button onClick={() => setLanguage('en')} className={cn('flex-1 py-2 font-medium transition-colors', language === 'en' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>English</button>
                </div>
              </div>
            </div>
            <Button onClick={generate} disabled={loading || !keyword.trim()} className="w-full gap-2 bg-purple-600 hover:bg-purple-700">
              {loading ? <><Loader2 size={14} className="animate-spin" />Đang viết quảng cáo...</> : <><Sparkles size={14} />Tạo Ad Copy</>}
            </Button>
          </div>

          {/* Tips */}
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-xs text-purple-800 space-y-1.5">
            <p className="font-semibold text-purple-900">Để ra copy tốt nhất:</p>
            <p>→ Điền USP càng cụ thể càng tốt (con số, chứng chỉ, ưu đãi)</p>
            <p>→ Nhập URL thật để AI đọc context ngành</p>
            <p>→ Có thể nhấn <strong>Tạo lại</strong> vài lần để chọn version hay nhất</p>
          </div>
        </div>

        {/* Result */}
        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {!result && !loading && !error && (
            <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">
              <Sparkles size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Điền thông tin và nhấn <strong>Tạo Ad Copy</strong></p>
            </div>
          )}

          {result && (
            <>
              {/* Ad preview */}
              <AdPreview headlines={result.headlines} descriptions={result.descriptions} urlPaths={result.urlPaths} domain={domain} />

              {(overLimitH > 0 || overLimitD > 0) && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                  <AlertCircle size={13} />
                  {overLimitH > 0 && <span>{overLimitH} headline vượt 30 ký tự</span>}
                  {overLimitD > 0 && <span>{overLimitD} description vượt 90 ký tự</span>}
                  <span className="text-red-500">— nhấn Tạo lại để fix</span>
                </div>
              )}

              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                  <span className="text-xs font-semibold text-gray-700">15 Headlines <span className="text-gray-400 font-normal">(max 30 ký tự)</span></span>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={generate}>
                      <RefreshCw size={11} />Tạo lại
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={copyAll}>
                      {copiedAll ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                      {copiedAll ? 'Đã copy' : 'Copy tất cả'}
                    </Button>
                  </div>
                </div>
                <div className="divide-y">
                  {result.headlines.map((h, i) => (
                    <div key={i} className={cn('flex items-center gap-2 px-4 py-2.5', h.length > 30 ? 'bg-red-50' : '')}>
                      <span className="text-[11px] text-gray-300 w-5 shrink-0">{i + 1}</span>
                      <span className={cn('flex-1 text-sm', h.length > 30 ? 'text-red-700' : 'text-gray-800')}>{h}</span>
                      <span className={cn('text-[11px] w-8 text-right shrink-0', charColor(h.length, 30))}>{h.length}/30</span>
                      <CopyBtn text={h} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="flex items-center px-4 py-3 border-b bg-gray-50">
                  <span className="text-xs font-semibold text-gray-700">4 Descriptions <span className="text-gray-400 font-normal">(max 90 ký tự)</span></span>
                </div>
                <div className="divide-y">
                  {result.descriptions.map((d, i) => (
                    <div key={i} className={cn('flex items-start gap-2 px-4 py-3', d.length > 90 ? 'bg-red-50' : '')}>
                      <span className="text-[11px] text-gray-300 w-5 shrink-0 mt-0.5">{i + 1}</span>
                      <span className={cn('flex-1 text-sm leading-relaxed', d.length > 90 ? 'text-red-700' : 'text-gray-800')}>{d}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={cn('text-[11px] w-12 text-right', charColor(d.length, 90))}>{d.length}/90</span>
                        <CopyBtn text={d} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {result.urlPaths.length > 0 && (
                <div className="bg-white rounded-xl border shadow-sm p-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Display URL Paths</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">{domain}/</span>
                    {result.urlPaths.map((p, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className="bg-purple-100 text-purple-700 rounded px-2 py-0.5 font-medium">{p}</span>
                        {i < result.urlPaths.length - 1 && <span className="text-gray-300">/</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.tips.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-800">Gợi ý từ AI:</p>
                  {result.tips.map((tip, i) => (
                    <p key={i} className="text-xs text-amber-700 flex gap-2">
                      <span className="shrink-0">→</span>{tip}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
