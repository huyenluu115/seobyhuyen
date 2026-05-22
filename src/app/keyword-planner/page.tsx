'use client'

import { useState, useMemo } from 'react'
import { CsvUploader } from '@/components/shared/CsvUploader'
import { exportToCsv } from '@/lib/csv-parser'
import { Button } from '@/components/ui/button'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ArrowUp, ArrowDown, Minus, Download, RotateCcw, ChevronDown, ChevronUp, GitCompare, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KwRow {
  keyword: string
  avgSearches: number
  change3m: number
  changeYoy: number
  competition: 'low' | 'medium' | 'high' | 'unknown'
  compIndex: number
  bidLow: number
  bidHigh: number
  inAccount: boolean
  inPlan: boolean
  monthly: { month: string; val: number }[]
  oppScore: number
  peakMonth: string
  category: 'opportunity' | 'in_account' | 'high_comp' | 'watch'
}

const COMP_LABEL: Record<string, KwRow['competition']> = {
  thấp: 'low', low: 'low',
  'trung bình': 'medium', medium: 'medium',
  cao: 'high', high: 'high',
}

const MONTH_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4',
  '#f97316','#84cc16','#ec4899','#6366f1',
]

function parseChange(v: string) { return parseFloat((v || '').replace('%', '')) || 0 }
function parseNum(v: string) { return parseFloat((v || '').replace(/,/g, '')) || 0 }

function get(r: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (r[k] !== undefined) return r[k]
    const found = Object.keys(r).find(rk => rk.toLowerCase() === k.toLowerCase())
    if (found) return r[found]
  }
  return ''
}

function calcOppScore(avgSearches: number, competition: KwRow['competition'], change3m: number, inAccount: boolean): number {
  let s = 0
  if (avgSearches >= 10000) s += 40
  else if (avgSearches >= 5000) s += 32
  else if (avgSearches >= 1000) s += 24
  else if (avgSearches >= 500) s += 16
  else if (avgSearches >= 100) s += 8
  else s += 4
  if (competition === 'low') s += 30
  else if (competition === 'medium') s += 18
  else if (competition === 'high') s += 5
  else s += 12
  if (change3m >= 50) s += 20
  else if (change3m >= 20) s += 15
  else if (change3m >= 0) s += 10
  else if (change3m >= -20) s += 6
  else s += 2
  if (!inAccount) s += 10
  return Math.min(s, 100)
}

function clusterKeywords(rows: KwRow[]): Record<string, KwRow[]> {
  const stop = new Set(['và', 'là', 'của', 'cho', 'trong', 'the', 'a', 'an', 'of', 'for', 'in', 'to', 'với', 'theo', 'từ', 'về'])
  const getWords = (kw: string) => kw.toLowerCase().split(/[\s-]+/).filter(w => w.length > 2 && !stop.has(w))
  const wordCount: Record<string, number> = {}
  rows.forEach(r => getWords(r.keyword).forEach(w => { wordCount[w] = (wordCount[w] || 0) + 1 }))
  const topWords = Object.entries(wordCount).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).map(([w]) => w)
  const clusters: Record<string, KwRow[]> = {}
  const assigned = new Set<string>()
  for (const word of topWords) {
    const match = rows.filter(r => !assigned.has(r.keyword) && getWords(r.keyword).includes(word))
    if (match.length >= 2) { clusters[word] = match; match.forEach(r => assigned.add(r.keyword)) }
  }
  const rest = rows.filter(r => !assigned.has(r.keyword))
  if (rest.length) clusters['—'] = rest
  return clusters
}

function OppBadge({ score }: { score: number }) {
  const cls = score >= 70 ? 'bg-green-100 text-green-700' : score >= 45 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
  return <span className={cn('rounded px-2 py-0.5 text-xs font-bold tabular-nums', cls)}>{score}</span>
}

function CompBadge({ level }: { level: KwRow['competition'] }) {
  const cls = level === 'low' ? 'bg-green-100 text-green-700' : level === 'medium' ? 'bg-yellow-100 text-yellow-700' : level === 'high' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
  const label = level === 'low' ? 'Thấp' : level === 'medium' ? 'TB' : level === 'high' ? 'Cao' : '?'
  return <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', cls)}>{label}</span>
}

const fmtN = (n: number) => n >= 1000 ? (n / 1000).toFixed(0) + 'K' : String(n)
const fmtVND = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : String(n)

const MONTHS_VI: Record<string, string> = {
  'Jan': 'T1', 'Feb': 'T2', 'Mar': 'T3', 'Apr': 'T4', 'May': 'T5', 'Jun': 'T6',
  'Jul': 'T7', 'Aug': 'T8', 'Sep': 'T9', 'Oct': 'T10', 'Nov': 'T11', 'Dec': 'T12',
}
function shortMonth(m: string) {
  const parts = m.split(' ')
  return MONTHS_VI[parts[0]] || parts[0]
}

type ViewMode = 'table' | 'clusters' | 'compare'
type FilterCat = 'all' | 'opportunity' | 'in_account' | 'high_comp' | 'watch'
type SortKey = 'oppScore' | 'avgSearches' | 'compIndex' | 'bidHigh' | 'change3m'

export default function KeywordPlannerPage() {
  const [rows, setRows] = useState<KwRow[]>([])
  const [filter, setFilter] = useState<FilterCat>('all')
  const [view, setView] = useState<ViewMode>('table')
  const [sortKey, setSortKey] = useState<SortKey>('oppScore')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [peakMonthFilter, setPeakMonthFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [budgetCtr, setBudgetCtr] = useState(3)
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null)

  function handleData(data: Record<string, string>[]) {
    const monthCols = Object.keys(data[0] || {}).filter(k => /^searches:/i.test(k))
    const parsed: KwRow[] = data.map(r => {
      const compRaw = get(r, 'Competition').trim().toLowerCase()
      const competition: KwRow['competition'] = COMP_LABEL[compRaw] || 'unknown'
      const avgSearches = parseNum(get(r, 'Avg. monthly searches'))
      const inAccount = get(r, 'In account?').trim().toUpperCase() === 'Y'
      const change3m = parseChange(get(r, 'Thay đổi trong ba tháng', 'Three month change'))
      const monthly = monthCols.map(col => ({ month: col.replace(/^searches:\s*/i, ''), val: parseNum(r[col] || '') }))
      const peakMonth = monthly.length ? monthly.reduce((best, m) => m.val > best.val ? m : best, monthly[0]).month : ''
      const oppScore = calcOppScore(avgSearches, competition, change3m, inAccount)
      let category: KwRow['category']
      if (inAccount) category = 'in_account'
      else if (competition === 'high') category = 'high_comp'
      else if (avgSearches >= 300) category = 'opportunity'
      else category = 'watch'
      return {
        keyword: get(r, 'Keyword'),
        avgSearches, change3m,
        changeYoy: parseChange(get(r, 'Thay đổi so với cùng kỳ năm trước', 'YoY change')),
        competition, compIndex: parseNum(get(r, 'Competition (indexed value)')),
        bidLow: parseNum(get(r, 'Top of page bid (low range)')),
        bidHigh: parseNum(get(r, 'Top of page bid (high range)')),
        inAccount, inPlan: get(r, 'In plan?').trim().toUpperCase() === 'Y',
        monthly, oppScore, peakMonth, category,
      }
    }).filter(r => r.keyword !== '')

    if (!parsed.length) {
      alert('⚠️ Không tìm thấy dữ liệu. File cần có cột "Keyword" và "Avg. monthly searches".')
      return
    }
    setRows(parsed)
    setFilter('all'); setView('table'); setSelected(new Set()); setExpanded(null); setSearch(''); setPeakMonthFilter('')
  }

  async function loadSample() {
    const res = await fetch('/api/fetch-csv?url=' + encodeURIComponent('https://docs.google.com/spreadsheets/d/1zLjJUYJIpJkebfyG-HVEUpdiTlsuBbsVABenJ9hno9k/export?format=csv&gid=1399420283'))
    if (!res.ok) return
    const text = await res.text()
    const { parseGoogleAdsCsv } = await import('@/lib/csv-parser')
    handleData(parseGoogleAdsCsv(text))
  }

  const counts = useMemo(() => ({
    all: rows.length,
    opportunity: rows.filter(r => r.category === 'opportunity').length,
    in_account: rows.filter(r => r.category === 'in_account').length,
    high_comp: rows.filter(r => r.category === 'high_comp').length,
    watch: rows.filter(r => r.category === 'watch').length,
  }), [rows])

  const allMonths = useMemo(() => {
    if (!rows.length) return []
    return [...new Set(rows.flatMap(r => r.monthly.map(m => m.month)))]
  }, [rows])

  const displayed = useMemo(() => {
    let list = filter === 'all' ? rows : rows.filter(r => r.category === filter)
    if (search.trim()) list = list.filter(r => r.keyword.toLowerCase().includes(search.toLowerCase()))
    if (peakMonthFilter) list = list.filter(r => r.peakMonth === peakMonthFilter)
    return [...list].sort((a, b) => {
      const v = a[sortKey] - b[sortKey]
      return sortDir === 'asc' ? v : -v
    })
  }, [rows, filter, search, sortKey, sortDir, peakMonthFilter])

  const clusters = useMemo(() => clusterKeywords(rows), [rows])

  const compareRows = useMemo(() => rows.filter(r => selected.has(r.keyword)), [rows, selected])

  const compareChartData = useMemo(() => {
    if (!compareRows.length) return []
    const months = compareRows[0]?.monthly.map(m => m.month) || []
    return months.map((month, i) => {
      const point: Record<string, string | number> = { month: shortMonth(month) }
      compareRows.forEach(r => { point[r.keyword] = r.monthly[i]?.val || 0 })
      return point
    })
  }, [compareRows])

  // Budget estimator
  const budgetEst = useMemo(() => {
    if (!selected.size) return null
    const sel = rows.filter(r => selected.has(r.keyword))
    const rows2 = sel.map(r => {
      const bidAvg = r.bidHigh > 0 ? (r.bidLow + r.bidHigh) / 2 : 0
      const estClicks = Math.round(r.avgSearches * (budgetCtr / 100))
      const estCost = estClicks * bidAvg
      return { keyword: r.keyword, avgSearches: r.avgSearches, bidAvg, estClicks, estCost }
    })
    const totalCost = rows2.reduce((s, r) => s + r.estCost, 0)
    const totalClicks = rows2.reduce((s, r) => s + r.estClicks, 0)
    return { rows: rows2, totalCost, totalClicks }
  }, [rows, selected, budgetCtr])

  function toggleSelect(kw: string) {
    setSelected(prev => { const n = new Set(prev); n.has(kw) ? n.delete(kw) : n.add(kw); return n })
  }
  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const SortTh = ({ k, label, center }: { k: SortKey; label: string; center?: boolean }) => (
    <th onClick={() => toggleSort(k)}
      className={cn('px-3 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-800 select-none whitespace-nowrap', center ? 'text-center' : 'text-right')}>
      {label}{sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  )

  const TABS: { key: FilterCat; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'opportunity', label: '🟢 Tiềm năng' },
    { key: 'in_account', label: '🔵 Đang target' },
    { key: 'high_comp', label: '🔴 Cạnh tranh cao' },
    { key: 'watch', label: '⚪ Theo dõi' },
  ]

  if (rows.length === 0) return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Keyword Planner Analyzer</h1>
        <p className="text-sm text-gray-500 mt-0.5">Opportunity score · Budget ước tính · Nhóm từ khóa · So sánh trend · Lọc theo mùa</p>
      </div>
      <div className="max-w-lg mx-auto mt-12 space-y-4">
        <CsvUploader onData={handleData} onSampleLoad={loadSample} label="Upload Keyword Planner CSV" />
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 space-y-1.5">
          <p className="font-semibold text-blue-900">Cách lấy file từ Google Ads:</p>
          <p>1. Vào <strong>Tools → Keyword Planner</strong></p>
          <p>2. Chọn keyword plan → <strong>Download → Keyword ideas (CSV)</strong></p>
          <p className="pt-1 text-blue-600">Hoặc dùng tab Google Drive link để dán link Sheets trực tiếp</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 md:p-8 pb-40">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Keyword Planner Analyzer</h1>
          <p className="text-sm text-gray-500 mt-0.5">{rows.length} từ khóa · Opportunity score · Budget ước tính · Nhóm · So sánh trend</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5"
            onClick={() => exportToCsv(displayed.map(r => ({
              Keyword: r.keyword, 'Searches/mo': r.avgSearches,
              'Change 3m': r.change3m + '%', 'Opp Score': r.oppScore,
              Competition: r.competition, 'Bid Low': r.bidLow, 'Bid High': r.bidHigh,
              'In Account': r.inAccount ? 'Y' : '', 'Peak Month': r.peakMonth,
            })), 'keyword-analysis.csv')}>
            <Download size={13} />Export
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRows([])}>
            <RotateCcw size={13} />Reset
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Tổng từ khóa', value: rows.length, color: 'text-gray-900' },
          { label: 'Tiềm năng (chưa target)', value: counts.opportunity, color: 'text-green-700' },
          { label: 'Đang chạy', value: counts.in_account, color: 'text-blue-700' },
          { label: 'Opp. Score TB', value: Math.round(rows.reduce((s, r) => s + r.oppScore, 0) / rows.length), color: 'text-purple-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={cn('text-3xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={cn('px-3 py-1 text-xs rounded-full font-medium border transition-colors',
                filter === t.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200')}>
              {t.label} ({counts[t.key]})
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border bg-gray-50 p-0.5 text-xs ml-auto">
          {([['table', 'Bảng'], ['clusters', 'Nhóm'], ['compare', 'So sánh']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={cn('flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors',
                view === v ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700')}>
              {v === 'clusters' && <Layers size={11} />}
              {v === 'compare' && <GitCompare size={11} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table view */}
      {view === 'table' && (
        <>
          {/* Search + seasonal filter */}
          <div className="flex gap-2 mb-3">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm từ khóa..." className="text-xs border rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-200 flex-1 max-w-xs" />
            <select value={peakMonthFilter} onChange={e => setPeakMonthFilter(e.target.value)}
              className="text-xs border rounded-lg px-2 py-1.5 text-gray-600 bg-white">
              <option value="">Tất cả tháng</option>
              {allMonths.map(m => <option key={m} value={m}>{m} (peak)</option>)}
            </select>
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 px-2">
                Bỏ chọn tất cả
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-3 w-8">
                      <input type="checkbox" className="rounded"
                        checked={displayed.length > 0 && displayed.every(r => selected.has(r.keyword))}
                        onChange={() => {
                          const allSel = displayed.every(r => selected.has(r.keyword))
                          setSelected(prev => {
                            const n = new Set(prev)
                            if (allSel) displayed.forEach(r => n.delete(r.keyword))
                            else displayed.forEach(r => n.add(r.keyword))
                            return n
                          })
                        }} />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Từ khóa</th>
                    <SortTh k="oppScore" label="Opp.Score" center />
                    <SortTh k="avgSearches" label="Searches/tháng" />
                    <SortTh k="change3m" label="3 tháng" />
                    <SortTh k="compIndex" label="Competition" center />
                    <SortTh k="bidHigh" label="Bid range" />
                    <th className="px-3 py-3 font-medium text-gray-500 text-center">Account</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-center w-10">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayed.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Không có từ khóa nào</td></tr>
                  ) : displayed.flatMap(r => {
                    const isExp = expanded === r.keyword
                    const isSel = selected.has(r.keyword)
                    return [
                      <tr key={r.keyword}
                        className={cn('hover:bg-gray-50 transition-colors', isSel && 'bg-blue-50')}>
                        <td className="px-3 py-2.5">
                          <input type="checkbox" className="rounded" checked={isSel} onChange={() => toggleSelect(r.keyword)} />
                        </td>
                        <td className="px-4 py-2.5 cursor-pointer" onClick={() => setExpanded(isExp ? null : r.keyword)}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{r.keyword}</span>
                            {r.inAccount && <span className="text-[10px] bg-blue-100 text-blue-600 rounded px-1.5 py-0.5 font-medium shrink-0">In account</span>}
                            {!r.inAccount && r.oppScore >= 70 && <span className="text-[10px] bg-green-100 text-green-600 rounded px-1.5 py-0.5 font-medium shrink-0">Tiềm năng cao</span>}
                          </div>
                          {r.peakMonth && <div className="text-[10px] text-gray-400 mt-0.5">Peak: {r.peakMonth}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-center"><OppBadge score={r.oppScore} /></td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-800">{fmtN(r.avgSearches)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={cn('text-sm', r.change3m > 5 ? 'text-green-600' : r.change3m < -5 ? 'text-red-500' : 'text-gray-400')}>
                            {r.change3m > 5 ? <ArrowUp size={12} className="inline" /> : r.change3m < -5 ? <ArrowDown size={12} className="inline" /> : <Minus size={12} className="inline" />}
                            {r.change3m !== 0 ? ` ${r.change3m > 0 ? '+' : ''}${r.change3m}%` : ' —'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <CompBadge level={r.competition} />
                            {r.compIndex > 0 && <span className="text-[10px] text-gray-400">{r.compIndex}/100</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-600">
                          {r.bidLow > 0 ? <>{fmtVND(r.bidLow)}–{fmtVND(r.bidHigh)}đ</> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {r.inAccount ? <span className="text-blue-500 font-bold text-xs">✓</span> : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center cursor-pointer" onClick={() => setExpanded(isExp ? null : r.keyword)}>
                          {isExp ? <ChevronUp size={14} className="mx-auto text-gray-400" /> : <ChevronDown size={14} className="mx-auto text-gray-400" />}
                        </td>
                      </tr>,
                      ...(isExp && r.monthly.length > 0 ? [
                        <tr key={r.keyword + '_chart'} className="bg-gray-50">
                          <td colSpan={9} className="px-6 py-4">
                            <p className="text-xs font-medium text-gray-600 mb-2">Search volume 12 tháng — <strong>{r.keyword}</strong></p>
                            <ResponsiveContainer width="100%" height={120}>
                              <LineChart data={r.monthly.map(m => ({ month: shortMonth(m.month), val: m.val }))} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={36} tickFormatter={fmtN} />
                                <Tooltip formatter={(v) => [fmtN(Number(v)) + ' lượt', 'Searches']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                <Line type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </td>
                        </tr>
                      ] : []),
                    ]
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400">
              {displayed.length} từ khóa · chọn checkbox để tính budget ước tính · click hàng để xem trend
            </div>
          </div>
        </>
      )}

      {/* Cluster view */}
      {view === 'clusters' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Từ khóa được nhóm tự động theo từ chung. Mỗi nhóm = 1 Ad Group tiềm năng.</p>
          {Object.entries(clusters).map(([word, kws]) => {
            const isOpen = expandedCluster === word
            const avgOpp = Math.round(kws.reduce((s, r) => s + r.oppScore, 0) / kws.length)
            const avgVol = Math.round(kws.reduce((s, r) => s + r.avgSearches, 0) / kws.length)
            return (
              <div key={word} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setExpandedCluster(isOpen ? null : word)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 capitalize">{word}</span>
                      <span className="text-xs text-gray-400">{kws.length} từ khóa</span>
                    </div>
                    <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
                      <span>Volume TB: <strong>{fmtN(avgVol)}</strong>/tháng</span>
                      <span>Opp Score TB: <OppBadge score={avgOpp} /></span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="border-t">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Từ khóa</th>
                          <th className="px-3 py-2 text-xs font-medium text-gray-500 text-center">Opp</th>
                          <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">Searches</th>
                          <th className="px-3 py-2 text-xs font-medium text-gray-500 text-center">Comp</th>
                          <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">Bid</th>
                          <th className="px-3 py-2 text-xs font-medium text-gray-500 text-center">Account</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {kws.sort((a, b) => b.oppScore - a.oppScore).map(r => (
                          <tr key={r.keyword} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-800">{r.keyword}</td>
                            <td className="px-3 py-2 text-center"><OppBadge score={r.oppScore} /></td>
                            <td className="px-3 py-2 text-right text-gray-600">{fmtN(r.avgSearches)}</td>
                            <td className="px-3 py-2 text-center"><CompBadge level={r.competition} /></td>
                            <td className="px-3 py-2 text-right text-xs text-gray-500">
                              {r.bidLow > 0 ? `${fmtVND(r.bidLow)}–${fmtVND(r.bidHigh)}đ` : '—'}
                            </td>
                            <td className="px-3 py-2 text-center text-xs">
                              {r.inAccount ? <span className="text-blue-500 font-bold">✓</span> : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Compare view */}
      {view === 'compare' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Chọn từ khóa ở bảng (tab Bảng) để so sánh trend. Đang chọn: <strong>{selected.size}</strong> từ khóa.</p>
          {selected.size === 0 ? (
            <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
              <GitCompare size={28} className="mx-auto mb-2" />
              <p className="text-sm">Chuyển sang tab <strong>Bảng</strong>, tick checkbox vào các từ khóa muốn so sánh</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Trend search volume — {selected.size} từ khóa</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={compareChartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={36} tickFormatter={fmtN} />
                    <Tooltip formatter={(v, name) => [fmtN(Number(v)) + ' lượt', String(name)]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {compareRows.map((r, i) => (
                      <Line key={r.keyword} type="monotone" dataKey={r.keyword}
                        stroke={MONTH_COLORS[i % MONTH_COLORS.length]} strokeWidth={2}
                        dot={{ r: 2 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Từ khóa</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-center">Opp</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">Avg/tháng</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">3 tháng</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-center">Comp</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">Bid</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 text-center">Peak</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {compareRows.map((r, i) => (
                      <tr key={r.keyword} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-800 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: MONTH_COLORS[i % MONTH_COLORS.length] }} />
                          {r.keyword}
                        </td>
                        <td className="px-3 py-2 text-center"><OppBadge score={r.oppScore} /></td>
                        <td className="px-3 py-2 text-right font-medium">{fmtN(r.avgSearches)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={r.change3m > 0 ? 'text-green-600' : r.change3m < 0 ? 'text-red-500' : 'text-gray-400'}>
                            {r.change3m > 0 ? '+' : ''}{r.change3m}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center"><CompBadge level={r.competition} /></td>
                        <td className="px-3 py-2 text-right text-xs text-gray-500">
                          {r.bidLow > 0 ? `${fmtVND(r.bidLow)}–${fmtVND(r.bidHigh)}đ` : '—'}
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-gray-500">{r.peakMonth.split(' ')[0]}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => toggleSelect(r.keyword)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Budget estimator — sticky bottom */}
      {selected.size > 0 && budgetEst && (
        <div className="fixed bottom-0 left-56 right-0 bg-white border-t shadow-lg px-6 py-4 z-10">
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Ước tính ngân sách — {selected.size} từ khóa đã chọn</p>
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-gray-900">{fmtVND(budgetEst.totalCost)}đ</div>
                <div className="text-xs text-gray-400">
                  ≈ {fmtN(budgetEst.totalClicks)} clicks/tháng
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">CTR giả định:</label>
              <input type="range" min={1} max={10} step={0.5} value={budgetCtr}
                onChange={e => setBudgetCtr(Number(e.target.value))}
                className="w-24" />
              <span className="text-xs font-medium text-gray-700 w-8">{budgetCtr}%</span>
            </div>
            <div className="flex-1 min-w-0 overflow-x-auto">
              <div className="flex gap-3">
                {budgetEst.rows.slice(0, 5).map(r => (
                  <div key={r.keyword} className="shrink-0 bg-gray-50 rounded-lg px-3 py-1.5 text-xs">
                    <div className="text-gray-500 truncate max-w-[120px]">{r.keyword}</div>
                    <div className="font-semibold text-gray-800">{fmtVND(r.estCost)}đ</div>
                    <div className="text-gray-400">{fmtN(r.estClicks)} clicks</div>
                  </div>
                ))}
                {budgetEst.rows.length > 5 && <div className="shrink-0 text-xs text-gray-400 self-center">+{budgetEst.rows.length - 5} nữa</div>}
              </div>
            </div>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
              Bỏ chọn
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
