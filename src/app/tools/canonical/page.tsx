'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Link, ExternalLink } from 'lucide-react'

interface Result {
  url: string
  finalUrl: string
  redirectHops: number
  canonical: string
  canonicalMatchesFinal: boolean
  title: string
  ogType: string
  error?: string
}

type Status = 'self' | 'other' | 'missing' | 'mismatch'

function getCanonicalStatus(r: Result): { status: Status; label: string; color: string; bg: string; Icon: typeof CheckCircle2 } {
  if (!r.canonical) return { status: 'missing', label: 'Thiếu canonical tag', color: 'text-red-600', bg: 'bg-red-50 border-red-200', Icon: XCircle }
  if (r.canonicalMatchesFinal) return { status: 'self', label: 'Self-canonical — Chuẩn', color: 'text-green-600', bg: 'bg-green-50 border-green-200', Icon: CheckCircle2 }
  // Canonical points elsewhere
  const sameHost = (() => { try { return new URL(r.canonical).hostname === new URL(r.finalUrl).hostname } catch { return false } })()
  if (sameHost) return { status: 'mismatch', label: 'Canonical trỏ sang URL khác cùng domain', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', Icon: AlertTriangle }
  return { status: 'other', label: 'Canonical trỏ sang domain khác', color: 'text-red-600', bg: 'bg-red-50 border-red-200', Icon: XCircle }
}

export default function CanonicalCheckerPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  async function handleCheck() {
    const u = url.trim()
    if (!u) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/seo/audit-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u.startsWith('http') ? u : 'https://' + u }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'Không fetch được trang'); return }
      setResult(data)
    } catch (e) {
      setError('Lỗi kết nối: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  const cs = result ? getCanonicalStatus(result) : null

  return (
    <div className="p-6 md:p-8 pb-16 min-h-screen" style={{ background: '#f8f9fb' }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Link size={20} className="text-teal-500" />
          Canonical Tag Checker
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Kiểm tra canonical tag, redirect chain và các tín hiệu kỹ thuật SEO</p>
      </div>

      {/* Input */}
      <div className="max-w-2xl mb-6">
        <div className="flex gap-2">
          <Input value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCheck()}
            placeholder="https://example.com/bai-viet" className="text-sm bg-white" />
          <Button onClick={handleCheck} disabled={loading || !url.trim()} className="shrink-0 gap-2 bg-teal-600 hover:bg-teal-700">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
            {loading ? 'Đang kiểm tra...' : 'Kiểm tra'}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mt-3">{error}</p>}
      </div>

      {result && cs && (
        <div className="max-w-2xl space-y-4">
          {/* Main canonical status */}
          <div className={cn('rounded-2xl border p-5', cs.bg)}>
            <div className="flex items-start gap-3">
              <cs.Icon size={20} className={cn('shrink-0 mt-0.5', cs.color)} />
              <div className="flex-1">
                <p className={cn('font-semibold text-sm', cs.color)}>{cs.label}</p>
                {result.canonical && (
                  <a href={result.canonical} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1 break-all">
                    {result.canonical}
                    <ExternalLink size={10} className="shrink-0" />
                  </a>
                )}
                {!result.canonical && (
                  <p className="text-xs text-red-700 mt-1">Không tìm thấy <code className="bg-red-100 px-1 rounded">&lt;link rel=&quot;canonical&quot;&gt;</code> trong &lt;head&gt;</p>
                )}
              </div>
            </div>

            {/* Fix suggestion */}
            {cs.status === 'missing' && (
              <div className="mt-3 bg-white/70 rounded-xl p-3">
                <p className="text-xs font-semibold text-red-700 mb-1">Cách sửa</p>
                <p className="text-xs text-red-800 font-mono bg-red-50 rounded-lg p-2 break-all">
                  {`<link rel="canonical" href="${result.finalUrl}" />`}
                </p>
                <p className="text-xs text-red-700 mt-1.5">Thêm vào thẻ &lt;head&gt; trong WordPress (Yoast/RankMath tự thêm) hoặc CMS của bạn.</p>
              </div>
            )}
            {cs.status === 'mismatch' && (
              <div className="mt-3 bg-white/70 rounded-xl p-3">
                <p className="text-xs font-semibold text-yellow-700 mb-1">Cần kiểm tra</p>
                <p className="text-xs text-yellow-800">Canonical đang trỏ sang URL khác trong cùng domain — có thể là intentional (trang có parameter) hoặc cấu hình nhầm. Đảm bảo canonical trỏ đúng URL chuẩn.</p>
              </div>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Redirect */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Redirect Chain</p>
              <div className="flex items-center gap-2">
                {result.redirectHops === 0
                  ? <CheckCircle2 size={16} className="text-green-500" />
                  : result.redirectHops === 1
                  ? <AlertTriangle size={16} className="text-yellow-500" />
                  : <XCircle size={16} className="text-red-500" />}
                <span className={cn('text-sm font-semibold',
                  result.redirectHops === 0 ? 'text-green-700' : result.redirectHops === 1 ? 'text-yellow-700' : 'text-red-700')}>
                  {result.redirectHops === 0 ? 'Không có redirect' : `${result.redirectHops} redirect hop`}
                </span>
              </div>
              {result.redirectHops > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">Từ: <span className="text-gray-700 break-all">{result.url}</span></p>
                  <p className="text-xs text-gray-500">Đến: <span className="text-gray-700 break-all">{result.finalUrl}</span></p>
                </div>
              )}
              {result.redirectHops > 1 && (
                <p className="text-xs text-red-600 mt-2">⚠ Redirect chain dài — mỗi hop mất ~100–200ms và pha loãng PageRank</p>
              )}
            </div>

            {/* Page info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Thông tin trang</p>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Title</p>
                  <p className="text-xs text-gray-700 font-medium leading-snug">{result.title || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Final URL</p>
                  <a href={result.finalUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline break-all flex items-center gap-1">
                    {result.finalUrl} <ExternalLink size={9} className="shrink-0" />
                  </a>
                </div>
                {result.ogType && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase">OG Type</p>
                    <p className="text-xs text-gray-700">{result.ogType}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary checklist */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-4">Tổng hợp kỹ thuật</p>
            <div className="space-y-2.5">
              {[
                { label: 'Canonical tag tồn tại', pass: !!result.canonical },
                { label: 'Canonical self-referencing (trỏ đúng trang)', pass: result.canonicalMatchesFinal },
                { label: 'Không có redirect chain (0 hop)', pass: result.redirectHops === 0 },
                { label: 'Redirect ≤1 hop', pass: result.redirectHops <= 1 },
                { label: 'Có title tag', pass: !!result.title },
              ].map(({ label, pass }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                    pass ? 'bg-green-100' : 'bg-red-100')}>
                    {pass
                      ? <CheckCircle2 size={13} className="text-green-600" />
                      : <XCircle size={13} className="text-red-500" />}
                  </div>
                  <span className={cn('text-sm', pass ? 'text-gray-700' : 'text-red-700 font-medium')}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
