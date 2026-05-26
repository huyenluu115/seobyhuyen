'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Share2, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

interface OGData {
  url: string; finalUrl: string; title: string; description: string
  ogTitle: string; ogDescription: string; ogImageUrl: string; ogType: string
  twitterCard: boolean; twitterTitle: string; twitterDescription: string; twitterImageUrl: string
  canonical: string; slug: string
}

type Platform = 'facebook' | 'twitter' | 'linkedin'

const PLATFORMS: { key: Platform; label: string; color: string }[] = [
  { key: 'facebook', label: 'Facebook', color: '#1877f2' },
  { key: 'twitter', label: 'X / Twitter', color: '#000' },
  { key: 'linkedin', label: 'LinkedIn', color: '#0a66c2' },
]

function Tag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? <CheckCircle2 size={13} className="text-green-500 shrink-0" /> : <XCircle size={13} className="text-red-500 shrink-0" />}
      <span className={ok ? 'text-gray-700' : 'text-red-700 font-medium'}>{label}</span>
    </div>
  )
}

function FacebookCard({ d }: { d: OGData }) {
  const img = d.ogImageUrl
  const t = d.ogTitle || d.title
  const desc = d.ogDescription || d.description
  const domain = (() => { try { return new URL(d.finalUrl).hostname.replace('www.', '') } catch { return d.finalUrl } })()
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-white" style={{ maxWidth: 500 }}>
      {img
        ? <img src={img} alt="" className="w-full aspect-[1.91/1] object-cover bg-gray-100" onError={e => (e.currentTarget.style.display = 'none')} />
        : <div className="w-full aspect-[1.91/1] bg-gray-100 flex items-center justify-center text-gray-400 text-sm">Không có OG Image</div>}
      <div className="p-3 border-t border-gray-200" style={{ background: '#f2f3f5' }}>
        <p className="text-[11px] text-gray-500 uppercase tracking-wide">{domain}</p>
        <p className="text-sm font-semibold text-gray-900 mt-0.5 leading-snug line-clamp-2">{t || 'Không có tiêu đề'}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{desc || 'Không có mô tả'}</p>
      </div>
    </div>
  )
}

function TwitterCard({ d }: { d: OGData }) {
  const img = d.twitterImageUrl || d.ogImageUrl
  const t = d.twitterTitle || d.ogTitle || d.title
  const desc = d.twitterDescription || d.ogDescription || d.description
  const domain = (() => { try { return new URL(d.finalUrl).hostname.replace('www.', '') } catch { return d.finalUrl } })()
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white" style={{ maxWidth: 500 }}>
      {img
        ? <img src={img} alt="" className="w-full aspect-[1.91/1] object-cover bg-gray-100" onError={e => (e.currentTarget.style.display = 'none')} />
        : <div className="w-full aspect-[1.91/1] bg-gray-100 flex items-center justify-center text-gray-400 text-sm">Không có ảnh</div>}
      <div className="p-3">
        <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug">{t || 'Không có tiêu đề'}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{desc}</p>
        <p className="text-xs text-gray-400 mt-1">🔗 {domain}</p>
      </div>
    </div>
  )
}

function LinkedInCard({ d }: { d: OGData }) {
  const img = d.ogImageUrl
  const t = d.ogTitle || d.title
  const desc = d.ogDescription || d.description
  const domain = (() => { try { return new URL(d.finalUrl).hostname.replace('www.', '') } catch { return d.finalUrl } })()
  return (
    <div className="rounded-lg overflow-hidden border border-gray-300 bg-white" style={{ maxWidth: 500 }}>
      {img
        ? <img src={img} alt="" className="w-full aspect-[1.91/1] object-cover bg-gray-100" onError={e => (e.currentTarget.style.display = 'none')} />
        : <div className="w-full aspect-[1.91/1] bg-gray-100 flex items-center justify-center text-gray-400 text-sm">Không có OG Image</div>}
      <div className="px-3 py-2.5" style={{ background: '#eef3f8' }}>
        <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{t || 'Không có tiêu đề'}</p>
        <p className="text-xs text-gray-500 mt-0.5">{domain}</p>
      </div>
    </div>
  )
}

export default function SocialPreviewPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<OGData | null>(null)
  const [error, setError] = useState('')
  const [platform, setPlatform] = useState<Platform>('facebook')

  async function handleFetch() {
    const u = url.trim()
    if (!u) return
    setLoading(true); setError(''); setData(null)
    try {
      const res = await fetch('/api/seo/audit-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u.startsWith('http') ? u : 'https://' + u }),
      })
      const d = await res.json()
      if (!res.ok || d.error) { setError(d.error || 'Không fetch được trang'); return }
      setData(d)
    } catch (e) { setError('Lỗi: ' + String(e)) }
    finally { setLoading(false) }
  }

  return (
    <div className="p-6 md:p-8 pb-16 min-h-screen" style={{ background: '#f8f9fb' }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Share2 size={20} className="text-pink-500" />Social Preview
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Xem trước link khi share lên Facebook, X/Twitter, LinkedIn</p>
      </div>

      <div className="max-w-2xl mb-6 flex gap-2">
        <Input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleFetch()}
          placeholder="https://example.com/bai-viet" className="bg-white" />
        <Button onClick={handleFetch} disabled={loading || !url.trim()} className="shrink-0 gap-2 bg-pink-500 hover:bg-pink-600">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
          {loading ? 'Đang tải...' : 'Xem preview'}
        </Button>
      </div>

      {error && <p className="max-w-2xl text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">{error}</p>}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
          {/* Left: preview */}
          <div className="space-y-4">
            {/* Platform tabs */}
            <div className="flex gap-2">
              {PLATFORMS.map(p => (
                <button key={p.key} onClick={() => setPlatform(p.key)}
                  className={cn('px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all',
                    platform === p.key ? 'text-white border-transparent' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50')}
                  style={platform === p.key ? { background: p.color, borderColor: p.color } : {}}>
                  {p.label}
                </button>
              ))}
            </div>

            <div>
              {platform === 'facebook' && <FacebookCard d={data} />}
              {platform === 'twitter' && <TwitterCard d={data} />}
              {platform === 'linkedin' && <LinkedInCard d={data} />}
            </div>
          </div>

          {/* Right: tag audit */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Open Graph Tags</p>
              <div className="space-y-2">
                <Tag ok={!!data.ogTitle} label={data.ogTitle ? `og:title — "${data.ogTitle.slice(0, 50)}${data.ogTitle.length > 50 ? '…' : ''}"` : 'og:title — Thiếu (dùng title tag thay thế)'} />
                <Tag ok={!!data.ogDescription} label={data.ogDescription ? `og:description — ${data.ogDescription.length} ký tự` : 'og:description — Thiếu'} />
                <Tag ok={!!data.ogImageUrl} label={data.ogImageUrl ? 'og:image — Có ảnh' : 'og:image — Thiếu (link share không có ảnh!)'} />
                <Tag ok={!!data.ogType} label={data.ogType ? `og:type — ${data.ogType}` : 'og:type — Thiếu'} />
              </div>
              {data.ogImageUrl && (
                <div>
                  <p className="text-[10px] text-gray-400 mb-1 uppercase">OG Image URL</p>
                  <p className="text-xs text-gray-600 break-all bg-gray-50 rounded-lg p-2 font-mono">{data.ogImageUrl}</p>
                  {!data.ogImageUrl.includes('1200') && !data.ogImageUrl.includes('1920') && (
                    <p className="text-[11px] text-yellow-600 mt-1 flex items-center gap-1"><AlertTriangle size={11} />Nên dùng ảnh 1200×630px cho OG Image</p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Twitter / X Tags</p>
              <Tag ok={data.twitterCard} label={data.twitterCard ? 'twitter:card — Có' : 'twitter:card — Thiếu'} />
              <Tag ok={!!data.twitterTitle} label={data.twitterTitle ? `twitter:title — Có` : 'twitter:title — Dùng og:title'} />
              <Tag ok={!!data.twitterImageUrl} label={data.twitterImageUrl ? 'twitter:image — Có' : 'twitter:image — Dùng og:image'} />
            </div>

            {/* Score */}
            {(() => {
              const checks = [!!data.ogTitle, !!data.ogDescription, !!data.ogImageUrl, !!data.ogType, data.twitterCard]
              const score = Math.round(checks.filter(Boolean).length / checks.length * 100)
              return (
                <div className={cn('rounded-2xl border p-4 flex items-center gap-4',
                  score === 100 ? 'bg-green-50 border-green-200' : score >= 60 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200')}>
                  <div className={cn('text-3xl font-bold', score === 100 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600')}>{score}%</div>
                  <div>
                    <p className={cn('text-sm font-semibold', score === 100 ? 'text-green-700' : score >= 60 ? 'text-yellow-700' : 'text-red-700')}>
                      {score === 100 ? 'OG Tags hoàn chỉnh' : score >= 60 ? 'Thiếu một số tag' : 'Cần bổ sung OG Tags'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{checks.filter(Boolean).length}/{checks.length} tags đã có</p>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
