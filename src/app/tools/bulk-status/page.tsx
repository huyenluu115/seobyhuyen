'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Activity, Loader2, Download, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from 'lucide-react'

interface UrlResult {
  url: string; status: number; finalUrl: string; redirectHops: number; time: number; error?: string
}

function StatusBadge({ status }: { status: number }) {
  if (status === 0) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Lỗi</span>
  const color = status < 300 ? 'bg-green-100 text-green-700' : status < 400 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  return <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', color)}>{status}</span>
}

function StatusIcon({ status }: { status: number }) {
  if (status === 0) return <XCircle size={14} className="text-gray-400 shrink-0" />
  if (status < 300) return <CheckCircle2 size={14} className="text-green-500 shrink-0" />
  if (status < 400) return <AlertTriangle size={14} className="text-yellow-500 shrink-0" />
  return <XCircle size={14} className="text-red-500 shrink-0" />
}

function statusLabel(status: number) {
  const labels: Record<number, string> = {
    200: 'OK', 201: 'Created', 301: 'Moved Permanently', 302: 'Found',
    304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized',
    403: 'Forbidden', 404: 'Not Found', 410: 'Gone', 500: 'Server Error', 503: 'Service Unavailable',
  }
  return labels[status] || ''
}

export default function BulkStatusPage() {
  const [input, setInput] = useState('')
  const [results, setResults] = useState<UrlResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | '2xx' | '3xx' | '4xx' | 'error'>('all')

  const urls = input.split('\n').map(u => u.trim()).filter(Boolean)

  async function handleCheck() {
    if (!urls.length) return
    if (urls.length > 50) { setError('Tối đa 50 URL mỗi lần'); return }
    setLoading(true); setError(''); setResults([])
    try {
      const res = await fetch('/api/tools/url-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      })
      const d = await res.json()
      if (d.error) { setError(d.error); return }
      setResults(d.results)
    } catch (e) { setError('Lỗi: ' + String(e)) }
    finally { setLoading(false) }
  }

  function exportCSV() {
    const header = 'URL,Status,Status Text,Final URL,Redirects,Time(ms),Error'
    const rows = results.map(r =>
      `"${r.url}","${r.status}","${statusLabel(r.status)}","${r.finalUrl}","${r.redirectHops}","${r.time}","${r.error || ''}"`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'url-status.csv'; a.click()
  }

  const filtered = results.filter(r => {
    if (filter === '2xx') return r.status >= 200 && r.status < 300
    if (filter === '3xx') return r.status >= 300 && r.status < 400
    if (filter === '4xx') return r.status >= 400
    if (filter === 'error') return r.status === 0 || r.error
    return true
  })

  const summary = {
    ok: results.filter(r => r.status >= 200 && r.status < 300).length,
    redirect: results.filter(r => r.status >= 300 && r.status < 400).length,
    error: results.filter(r => r.status >= 400 || r.status === 0).length,
    avgTime: results.length ? Math.round(results.reduce((s, r) => s + r.time, 0) / results.length) : 0,
  }

  return (
    <div className="p-6 md:p-8 pb-16 min-h-screen" style={{ background: '#f8f9fb' }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Activity size={20} className="text-rose-500" />Bulk URL Status Checker
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Kiểm tra status code & redirect cho nhiều URL cùng lúc (tối đa 50)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
        {/* Input */}
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2 block">
              Danh sách URL — mỗi dòng 1 URL ({urls.length}/50)
            </label>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              placeholder={'https://example.com\nhttps://example.com/page-1\nhttps://example.com/page-2'}
              rows={12}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-rose-300" />
            <div className="flex items-center gap-2 mt-3">
              <Button onClick={handleCheck} disabled={loading || !urls.length || urls.length > 50}
                className="gap-2 bg-rose-500 hover:bg-rose-600 flex-1">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                {loading ? `Đang check ${results.length}/${urls.length}...` : `Check ${urls.length} URL`}
              </Button>
              {results.length > 0 && (
                <Button variant="outline" onClick={exportCSV} className="gap-1.5 shrink-0">
                  <Download size={13} />CSV
                </Button>
              )}
            </div>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>

          {/* Summary */}
          {results.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '2xx OK', val: summary.ok, color: 'text-green-600 bg-green-50 border-green-200' },
                { label: '3xx Redirect', val: summary.redirect, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
                { label: '4xx/5xx Lỗi', val: summary.error, color: 'text-red-600 bg-red-50 border-red-200' },
                { label: 'TB (ms)', val: summary.avgTime, color: 'text-gray-600 bg-gray-50 border-gray-200' },
              ].map(s => (
                <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.color)}>
                  <p className="text-xl font-bold">{s.val}</p>
                  <p className="text-[10px] mt-0.5 opacity-80">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          {results.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Filter tabs */}
              <div className="flex gap-1 p-3 border-b border-gray-100 flex-wrap">
                {([['all', 'Tất cả'], ['2xx', '✓ OK'], ['3xx', '→ Redirect'], ['4xx', '✗ Lỗi'], ['error', '! Timeout']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setFilter(key)}
                    className={cn('px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors',
                      filter === key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100')}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                {filtered.map((r, i) => (
                  <div key={i} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-2">
                      <StatusIcon status={r.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={r.status} />
                          {statusLabel(r.status) && (
                            <span className="text-[10px] text-gray-400">{statusLabel(r.status)}</span>
                          )}
                          <span className="text-[10px] text-gray-400 ml-auto">{r.time}ms</span>
                        </div>
                        <p className="text-xs text-gray-700 mt-1 truncate font-medium">{r.url}</p>
                        {r.redirectHops > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-yellow-700 mt-0.5">
                            <ArrowRight size={10} className="shrink-0" />
                            <span className="truncate">{r.finalUrl}</span>
                            <span className="shrink-0">({r.redirectHops} hop)</span>
                          </div>
                        )}
                        {r.error && <p className="text-[11px] text-red-500 mt-0.5 truncate">{r.error}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && results.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center gap-3">
              <Loader2 size={24} className="animate-spin text-rose-400" />
              <p className="text-sm text-gray-500">Đang kiểm tra {urls.length} URL...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
