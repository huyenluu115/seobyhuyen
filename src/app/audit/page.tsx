'use client'

import { useState } from 'react'
import { CsvUploader } from '@/components/shared/CsvUploader'
import { scoreCampaign, type ScoredCampaign } from '@/lib/scoring'
import { SCORE_COLOR, SCORE_LABEL } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ArrowUpDown, Download, RotateCcw } from 'lucide-react'
import { exportToCsv } from '@/lib/csv-parser'

type SortKey = 'totalScore' | 'ctr' | 'convRate' | 'qualityScore' | 'impressionShare' | 'cost'
type SortDir = 'asc' | 'desc'
type FilterLevel = 'all' | 'good' | 'warning' | 'poor'

function ScoreBadge({ score, showLabel = true }: { score: number; showLabel?: boolean }) {
  const level: 'good' | 'warning' | 'poor' = score >= 70 ? 'good' : score >= 40 ? 'warning' : 'poor'
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', SCORE_COLOR[level])}>
      {score}{showLabel && <span className="font-normal opacity-75">· {SCORE_LABEL[level]}</span>}
    </span>
  )
}

function MetricBar({ score, max, label }: { score: number; max: number; label: string }) {
  const pct = Math.round(score / max * 100)
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-800">{score}/{max}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function AuditPage() {
  const [campaigns, setCampaigns] = useState<ScoredCampaign[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('totalScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filter, setFilter] = useState<FilterLevel>('all')
  const [selected, setSelected] = useState<ScoredCampaign | null>(null)

  function handleData(rows: Record<string, string>[]) {
    const scored = rows.map(scoreCampaign)
    const hasNames = scored.some(c => c.name !== '')
    if (!hasNames) {
      alert('⚠️ Không tìm thấy cột "Campaign".\n\nFile này không phải báo cáo Campaign Performance.\n\nĐể lấy đúng file: Google Ads → Reports → Predefined reports → Campaign → Download CSV')
      return
    }
    setCampaigns(scored)
  }

  async function loadSample() {
    const res = await fetch('/sample-data/sample-campaigns.csv')
    const text = await res.text()
    const { parseGoogleAdsCsv } = await import('@/lib/csv-parser')
    handleData(parseGoogleAdsCsv(text))
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = campaigns.filter(c => filter === 'all' || c.level === filter)
  const sorted = [...filtered].sort((a, b) => {
    const v = (a[sortKey] as number) - (b[sortKey] as number)
    return sortDir === 'asc' ? v : -v
  })

  const counts = { good: 0, warning: 0, poor: 0 }
  campaigns.forEach(c => counts[c.level]++)
  const avg = campaigns.length ? Math.round(campaigns.reduce((s, c) => s + c.totalScore, 0) / campaigns.length) : 0

  const exportData = sorted.map(c => ({
    Campaign: c.name, Score: c.totalScore, Level: SCORE_LABEL[c.level],
    CTR: c.ctr.toFixed(2) + '%', 'Conv. Rate': c.convRate.toFixed(2) + '%',
    'QS': c.qualityScore, 'Imp. Share': c.impressionShare.toFixed(1) + '%',
    Cost: c.cost, 'Suggestions': c.suggestions.join(' | ')
  }))

  const SortTh = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="px-4 py-3 font-medium text-gray-500 text-right cursor-pointer hover:text-gray-800 select-none whitespace-nowrap"
      onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1 justify-end">
        {label}<ArrowUpDown size={11} className={sortKey === k ? 'text-blue-500' : 'text-gray-300'} />
      </span>
    </th>
  )

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Campaign Audit Scorecard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Chấm điểm 0–100 theo CTR · Conv. Rate · Quality Score · Impression Share</p>
        </div>
        {campaigns.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportToCsv(exportData, 'campaign-audit.csv')} className="gap-1.5">
              <Download size={13} />Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCampaigns([])} className="gap-1.5">
              <RotateCcw size={13} />Reset
            </Button>
          </div>
        )}
      </div>

      {campaigns.length === 0 ? (
        <div className="max-w-lg mx-auto mt-12 space-y-4">
          <CsvUploader onData={handleData} onSampleLoad={loadSample}
            label="Upload Campaign Performance Report CSV" />
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 space-y-1.5">
            <p className="font-semibold text-blue-900">Cách lấy file từ Google Ads:</p>
            <p>1. Vào <strong>Reports → Predefined reports → Campaign</strong></p>
            <p>2. Thêm cột: <strong>Quality Score · Search Impr. Share · Conv. rate</strong></p>
            <p>3. Chọn khoảng thời gian → <strong>Download → CSV</strong></p>
            <p className="pt-1 text-blue-600">Cột bắt buộc: Campaign · Impressions · Clicks · CTR · Cost · Conversions · Conv. rate · Search Impr. share · Avg. Quality Score</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Tổng chiến dịch', value: campaigns.length, color: 'text-gray-900' },
              { label: 'Tốt (≥70)', value: counts.good, color: 'text-green-700' },
              { label: 'Cần cải thiện (40–69)', value: counts.warning, color: 'text-yellow-700' },
              { label: 'Kém (<40)', value: counts.poor, color: 'text-red-700' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {(['all', 'good', 'warning', 'poor'] as const).map(l => {
              const counts2 = l === 'all' ? campaigns.length : campaigns.filter(c => c.level === l).length
              return (
                <button key={l} onClick={() => setFilter(l)}
                  className={cn('px-3 py-1 text-xs rounded-full font-medium transition-colors',
                    filter === l ? 'bg-gray-900 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50')}>
                  {l === 'all' ? `Tất cả (${counts2})` : l === 'good' ? `Tốt (${counts2})` : l === 'warning' ? `Cần cải thiện (${counts2})` : `Kém (${counts2})`}
                </button>
              )
            })}
            <span className="ml-auto text-xs text-gray-400">Điểm TB: <strong className="text-gray-700">{avg}/100</strong></span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Chiến dịch</th>
                  <SortTh k="totalScore" label="Điểm" />
                  <SortTh k="ctr" label="CTR" />
                  <SortTh k="convRate" label="Conv.%" />
                  <SortTh k="qualityScore" label="QS" />
                  <SortTh k="impressionShare" label="IS%" />
                  <SortTh k="cost" label="Chi phí" />
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Gợi ý</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((c, i) => (
                  <tr key={c.name || i} onClick={() => setSelected(c)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{c.name}</td>
                    <td className="px-4 py-3 text-right"><ScoreBadge score={c.totalScore} showLabel={false} /></td>
                    <td className="px-4 py-3 text-right text-gray-600">{c.ctr.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right text-gray-600">{c.convRate.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right text-gray-600">{c.qualityScore}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{c.impressionShare.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{c.cost > 0 ? (c.cost / 1000000).toFixed(1) + 'M' : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[220px] truncate">{c.suggestions[0] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={cn('text-2xl font-bold px-4 py-2 rounded-lg', SCORE_COLOR[selected.level])}>
                  {selected.totalScore}<span className="text-base font-normal">/100</span>
                </span>
                <span className={cn('text-sm font-medium', SCORE_COLOR[selected.level])}>{SCORE_LABEL[selected.level]}</span>
              </div>
              <div className="space-y-3">
                <MetricBar score={selected.ctrScore} max={25} label={`CTR: ${selected.ctr.toFixed(2)}%`} />
                <MetricBar score={selected.convRateScore} max={25} label={`Conv. Rate: ${selected.convRate.toFixed(2)}%`} />
                <MetricBar score={selected.qsScore} max={30} label={`Quality Score: ${selected.qualityScore}/10`} />
                <MetricBar score={selected.isScore} max={20} label={`Impression Share: ${selected.impressionShare.toFixed(1)}%`} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['Clicks', selected.clicks.toLocaleString()],
                  ['Conversions', selected.conversions.toString()],
                  ['Cost', (selected.cost / 1000000).toFixed(1) + 'M đ'],
                  ['CPC', (selected.cpc / 1000).toFixed(0) + 'K đ'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-gray-400">{k}</p>
                    <p className="font-semibold text-gray-800 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
              {selected.suggestions.length > 0 && (
                <div className="bg-orange-50 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-orange-800 mb-2">Action items:</p>
                  {selected.suggestions.map((s, i) => (
                    <p key={i} className="text-xs text-orange-700 flex gap-2">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-orange-200 flex items-center justify-center font-bold text-[10px]">{i+1}</span>
                      {s}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
