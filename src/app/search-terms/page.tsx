'use client'

import { useState, useMemo } from 'react'
import { CsvUploader } from '@/components/shared/CsvUploader'
import { exportToCsv, exportToTxt } from '@/lib/csv-parser'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, AlertTriangle, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown, Search, Lightbulb, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface STRow {
  term: string
  matchType: string
  campaign: string
  adGroup: string
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  cost: number
  conversions: number
  category: 'WINNER' | 'POTENTIAL' | 'WASTE' | 'IRRELEVANT'
}

const CATS = ['WINNER', 'POTENTIAL', 'WASTE', 'IRRELEVANT'] as const
type Cat = typeof CATS[number]
type SortKey = 'impressions' | 'clicks' | 'ctr' | 'cost' | 'conversions' | 'cpc'

const CAT_META: Record<Cat, { label: string; desc: string; badge: string; color: string }> = {
  WINNER:     { label: 'Winner',          desc: 'Conv > 0 — giữ lại, thêm Exact Match',     badge: 'bg-green-100 text-green-700 border-green-200',   color: '#22c55e' },
  POTENTIAL:  { label: 'Tiềm năng',       desc: 'Clicks ≥ 5, CTR ≥ 3% — theo dõi thêm',    badge: 'bg-blue-100 text-blue-700 border-blue-200',      color: '#3b82f6' },
  WASTE:      { label: 'Lãng phí',        desc: 'Cost > avgCPC×3, Conv = 0 — thêm negative', badge: 'bg-red-100 text-red-700 border-red-200',         color: '#ef4444' },
  IRRELEVANT: { label: 'Không liên quan', desc: 'CTR < 0.5%, Imp ≥ 100 — xem xét negative', badge: 'bg-orange-100 text-orange-700 border-orange-200', color: '#f97316' },
}

function parseN(v: string) { return parseFloat((v || '0').replace(/,/g, '').replace(/\s/g, '')) || 0 }
function parsePct(v: string) { return parseFloat((v || '0').replace('%', '').replace(/\s/g, '')) || 0 }
const fmtVND = (n: number) => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : n.toLocaleString()

function CopiedBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
      {copied ? 'Đã copy' : label}
    </button>
  )
}

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: 'asc' | 'desc' }) {
  if (col !== sortKey) return <ArrowUpDown size={11} className="text-gray-300" />
  return dir === 'asc' ? <ArrowUp size={11} className="text-blue-500" /> : <ArrowDown size={11} className="text-blue-500" />
}

export default function SearchTermsPage() {
  const [rows, setRows] = useState<STRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [sortKey, setSortKey] = useState<SortKey>('cost')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('all')

  function handleData(data: Record<string, string>[]) {
    function get(r: Record<string, string>, ...keys: string[]): string {
      for (const k of keys) {
        if (r[k] !== undefined) return r[k]
        const nk = k.normalize('NFC').toLowerCase()
        const found = Object.keys(r).find(rk => rk.normalize('NFC').toLowerCase() === nk)
        if (found) return r[found]
      }
      return ''
    }

    const cpcs = data.map(r => parseN(get(r, 'Avg. CPC', 'Avg CPC', 'CPC Tr.bình', 'CPC trung bình')))
    const avgCpc = cpcs.reduce((a, b) => a + b, 0) / (cpcs.length || 1)

    const parsed: STRow[] = data.map((r, i) => {
      const conv = parseN(get(r, 'Conversions', 'Lượt chuyển đổi'))
      const cost = parseN(get(r, 'Cost', 'Chi phí'))
      const clicks = parseN(get(r, 'Clicks', 'Lượt nhấp'))
      const ctr = parsePct(get(r, 'CTR', 'Ctr'))
      const imp = parseN(get(r, 'Impressions', 'Số lượt hiển thị', 'Lượt hiển thị'))
      let cat: Cat
      if (conv > 0) cat = 'WINNER'
      else if (cpcs[i] > avgCpc * 3 && conv === 0 && cost > 0) cat = 'WASTE'
      else if (clicks >= 5 && ctr >= 3 && conv === 0) cat = 'POTENTIAL'
      else if (ctr < 0.5 && imp >= 100) cat = 'IRRELEVANT'
      else cat = 'POTENTIAL'
      return {
        term: get(r, 'Search term', 'search term', 'Cụm từ tìm kiếm', 'Cụm từ tìm kiếm '),
        matchType: get(r, 'Match type', 'Loại đối sánh', 'Loại Đối Sánh'),
        campaign: get(r, 'Campaign', 'Chiến dịch'),
        adGroup: get(r, 'Ad group', 'Ad Group', 'Nhóm quảng cáo'),
        impressions: imp, clicks, ctr, cpc: cpcs[i], cost, conversions: conv, category: cat,
      }
    })

    const hasTerms = parsed.some(r => r.term !== '')
    if (!hasTerms) alert('⚠️ Không tìm thấy cột "Cụm từ tìm kiếm".\n\nFile này có vẻ là báo cáo Keywords (từ khóa), không phải Search Terms.\n\nĐể lấy đúng file: Google Ads → Keywords → Search terms → Download CSV')
    setRows(parsed)
    setSelected(new Set())
    setActiveTab('overview')
  }

  async function loadSample() {
    const res = await fetch('/sample-data/sample-search-terms.csv')
    const text = await res.text()
    const { parseGoogleAdsCsv } = await import('@/lib/csv-parser')
    handleData(parseGoogleAdsCsv(text))
  }

  const campaigns = useMemo(() => {
    const s = new Set(rows.map(r => r.campaign).filter(Boolean))
    return Array.from(s)
  }, [rows])

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (campaignFilter !== 'all' && r.campaign !== campaignFilter) return false
      if (search && !r.term.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [rows, campaignFilter, search])

  const grouped = useMemo(() => {
    const g: Record<Cat, STRow[]> = { WINNER: [], POTENTIAL: [], WASTE: [], IRRELEVANT: [] }
    filteredRows.forEach(r => g[r.category].push(r))
    return g
  }, [filteredRows])

  function sortedRows(cat: Cat) {
    return [...grouped[cat]].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey]
      return sortDir === 'asc' ? diff : -diff
    })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const totalCost = filteredRows.reduce((s, r) => s + r.cost, 0)
  const wasteCost = grouped.WASTE.reduce((s, r) => s + r.cost, 0) + grouped.IRRELEVANT.reduce((s, r) => s + r.cost, 0)
  const totalConv = filteredRows.reduce((s, r) => s + r.conversions, 0)
  const totalClicks = filteredRows.reduce((s, r) => s + r.clicks, 0)

  const chartData = CATS.map(cat => ({
    name: CAT_META[cat].label,
    cost: grouped[cat].reduce((s, r) => s + r.cost, 0),
    count: grouped[cat].length,
    color: CAT_META[cat].color,
  }))

  // Suggested new keywords from POTENTIAL
  const suggestions = useMemo(() => {
    return grouped.POTENTIAL
      .filter(r => r.clicks >= 3)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 20)
      .map(r => ({
        ...r,
        suggestedMatch: r.ctr >= 5 ? 'Exact Match' : r.clicks >= 10 ? 'Phrase Match' : 'Phrase Match',
        suggestedFormat: r.ctr >= 5 ? `[${r.term}]` : `"${r.term}"`,
      }))
  }, [grouped])

  function toggleRow(term: string) {
    setSelected(prev => { const n = new Set(prev); n.has(term) ? n.delete(term) : n.add(term); return n })
  }
  function toggleAll(cat: Cat) {
    const terms = grouped[cat].map(r => r.term)
    const allSelected = terms.every(t => selected.has(t))
    setSelected(prev => {
      const n = new Set(prev)
      if (allSelected) terms.forEach(t => n.delete(t))
      else terms.forEach(t => n.add(t))
      return n
    })
  }

  function exportNegatives(cat?: Cat) {
    const source = cat ? grouped[cat] : [...grouped.WASTE, ...grouped.IRRELEVANT]
    const terms = source.filter(r => selected.size === 0 || selected.has(r.term))
    const exact = terms.filter(r => r.ctr < 1 || r.clicks === 0).map(r => `[${r.term}]`)
    const phrase = terms.filter(r => r.ctr >= 1 && r.clicks > 0).map(r => `"${r.term}"`)
    exportToTxt([
      '# Exact match negatives',
      ...exact,
      '',
      '# Phrase match negatives',
      ...phrase,
    ], 'negative-keywords.txt')
  }

  function exportWinners() {
    exportToCsv(
      grouped.WINNER.map(r => ({ Keyword: r.term, Campaign: r.campaign, 'Ad Group': r.adGroup, Clicks: r.clicks, CTR: r.ctr.toFixed(2)+'%', Conversions: r.conversions })),
      'winner-keywords.csv'
    )
  }

  const negativeText = [...grouped.WASTE, ...grouped.IRRELEVANT].map(r =>
    (r.ctr < 1 || r.clicks === 0) ? `[${r.term}]` : `"${r.term}"`
  ).join('\n')

  const suggestText = suggestions.map(r => r.suggestedFormat).join('\n')

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Search Term Analyzer</h1>
          <p className="text-sm text-gray-500 mt-0.5">Phân loại search term thực tế để cắt giảm lãng phí và mở rộng từ khóa tốt</p>
        </div>
        {rows.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => { setRows([]); setSelected(new Set()); setSearch(''); setCampaignFilter('all') }} className="gap-1.5">
            <RotateCcw size={13} />Reset
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="max-w-lg mx-auto mt-12 space-y-4">
          <CsvUploader onData={handleData} onSampleLoad={loadSample} label="Upload Search Terms Report CSV" />
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 space-y-1.5">
            <p className="font-semibold text-blue-900">Cách lấy file từ Google Ads:</p>
            <p>1. Vào <strong>Keywords → Search terms</strong></p>
            <p>2. Chọn khoảng thời gian cần phân tích</p>
            <p>3. Nhấn <strong>Download → CSV</strong></p>
            <p className="pt-1 text-blue-600">Cột bắt buộc: Cụm từ tìm kiếm · Lượt nhấp · CTR · Chi phí · Lượt chuyển đổi</p>
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tìm search term..."
                className="pl-8 pr-3 py-1.5 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-blue-200 w-52" />
            </div>
            {campaigns.length > 0 && (
              <select value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}
                className="text-xs border rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-200 text-gray-700">
                <option value="all">Tất cả campaign</option>
                {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
              {CATS.map(cat => (
                <TabsTrigger key={cat} value={cat} className="gap-1.5">
                  {CAT_META[cat].label}
                  <span className="bg-current/10 rounded-full px-1.5 py-0.5 text-[11px]">{grouped[cat].length}</span>
                </TabsTrigger>
              ))}
              <TabsTrigger value="suggest" className="gap-1.5">
                <Lightbulb size={12} />Gợi ý từ khóa
                <span className="bg-current/10 rounded-full px-1.5 py-0.5 text-[11px]">{suggestions.length}</span>
              </TabsTrigger>
            </TabsList>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Tổng search terms', value: filteredRows.length.toString(), sub: `${totalClicks.toLocaleString()} clicks`, color: 'text-gray-700' },
                  { label: 'Tổng chi phí', value: fmtVND(totalCost)+'đ', sub: `${totalConv} chuyển đổi`, color: 'text-gray-700' },
                  { label: 'Chi phí lãng phí', value: fmtVND(wasteCost)+'đ', sub: totalCost > 0 ? `${((wasteCost/totalCost)*100).toFixed(0)}% tổng ngân sách` : '—', color: 'text-red-600' },
                  { label: 'Terms có conv', value: grouped.WINNER.length.toString(), sub: `${totalConv > 0 ? ((grouped.WINNER.length/filteredRows.length)*100).toFixed(0) : 0}% tổng số terms`, color: 'text-green-600' },
                ].map((card, i) => (
                  <div key={i} className="bg-white border rounded-xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                    <p className={cn('text-xl font-bold', card.color)}>{card.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <p className="text-xs font-semibold text-gray-700 mb-3">Phân bổ chi phí theo nhóm</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 20 }}>
                      <XAxis type="number" tickFormatter={v => fmtVND(v)+'đ'} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                      <Tooltip formatter={(v) => typeof v === 'number' ? fmtVND(v)+'đ' : v} />
                      <Bar dataKey="cost" radius={4}>
                        {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <p className="text-xs font-semibold text-gray-700 mb-3">Số lượng search term theo nhóm</p>
                  <div className="space-y-2.5 mt-4">
                    {CATS.map(cat => {
                      const pct = filteredRows.length > 0 ? (grouped[cat].length / filteredRows.length) * 100 : 0
                      return (
                        <div key={cat}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">{CAT_META[cat].label}</span>
                            <span className="font-medium">{grouped[cat].length} <span className="text-gray-400">({pct.toFixed(0)}%)</span></span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CAT_META[cat].color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {wasteCost > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertTriangle size={15} className="text-red-500 shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-red-800">Lãng phí ước tính: {fmtVND(wasteCost)}đ</span>
                    <span className="text-xs text-red-500 ml-2">({grouped.WASTE.length + grouped.IRRELEVANT.length} search terms)</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <CopiedBtn text={negativeText} label="Copy danh sách phủ định" />
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 gap-1 text-xs" onClick={() => exportNegatives()}>
                      <Download size={12} />Export .txt
                    </Button>
                    <Button size="sm" variant="outline" className="text-green-600 border-green-200 gap-1 text-xs" onClick={exportWinners}>
                      <Download size={12} />Export Winners
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* CATEGORY TABS */}
            {CATS.map(cat => (
              <TabsContent key={cat} value={cat}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs text-gray-500">{CAT_META[cat].desc}</p>
                  <div className="flex gap-2">
                    {(cat === 'WASTE' || cat === 'IRRELEVANT') && (
                      <>
                        <CopiedBtn
                          text={sortedRows(cat).filter(r => selected.size === 0 || selected.has(r.term)).map(r =>
                            (r.ctr < 1 || r.clicks === 0) ? `[${r.term}]` : `"${r.term}"`
                          ).join('\n')}
                          label="Copy phủ định"
                        />
                        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => exportNegatives(cat)}>
                          <Download size={11} />Export negative
                        </Button>
                      </>
                    )}
                    {cat === 'WINNER' && (
                      <Button size="sm" variant="outline" className="text-xs gap-1 text-green-600" onClick={exportWinners}>
                        <Download size={11} />Export winners
                      </Button>
                    )}
                  </div>
                </div>
                <TermTable rows={sortedRows(cat)} cat={cat} selected={selected} toggleRow={toggleRow} toggleAll={() => toggleAll(cat)} sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
              </TabsContent>
            ))}

            {/* SUGGEST TAB */}
            <TabsContent value="suggest">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Gợi ý thêm từ khóa mới</p>
                  <p className="text-xs text-gray-500 mt-0.5">Từ khóa POTENTIAL có đủ clicks để thêm vào account với match type phù hợp</p>
                </div>
                <CopiedBtn text={suggestText} label={`Copy ${suggestions.length} từ khóa`} />
              </div>
              {suggestions.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">Chưa đủ dữ liệu để gợi ý (cần POTENTIAL terms có ≥ 3 clicks)</div>
              ) : (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Search Term</th>
                        <th className="px-3 py-3 font-medium text-gray-500 text-xs text-right">Clicks</th>
                        <th className="px-3 py-3 font-medium text-gray-500 text-xs text-right">CTR</th>
                        <th className="px-3 py-3 font-medium text-gray-500 text-xs text-left">Đề xuất Match Type</th>
                        <th className="px-3 py-3 font-medium text-gray-500 text-xs text-left">Format Google Ads</th>
                        <th className="px-3 py-3 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {suggestions.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[240px]">
                            <div className="truncate">{r.term}</div>
                            {r.campaign && <div className="text-xs text-gray-400 truncate">{r.campaign}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-700">{r.clicks}</td>
                          <td className="px-3 py-2.5 text-right text-gray-600">{r.ctr.toFixed(1)}%</td>
                          <td className="px-3 py-2.5">
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                              r.suggestedMatch === 'Exact Match' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>
                              {r.suggestedMatch}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{r.suggestedFormat}</code>
                          </td>
                          <td className="px-3 py-2.5">
                            <CopiedBtn text={r.suggestedFormat} label="Copy" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 space-y-1">
                <p className="font-semibold text-amber-800">Logic đề xuất match type:</p>
                <p>→ <strong>Exact Match</strong> [từ khóa]: CTR ≥ 5% — search term rất phù hợp, kiểm soát chính xác</p>
                <p>→ <strong>Phrase Match</strong> "từ khóa": còn lại — linh hoạt hơn, bắt được biến thể gần đúng</p>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

function TermTable({ rows, cat, selected, toggleRow, toggleAll, sortKey, sortDir, toggleSort }: {
  rows: STRow[]; cat: Cat; selected: Set<string>
  toggleRow: (t: string) => void; toggleAll: () => void
  sortKey: SortKey; sortDir: 'asc' | 'desc'; toggleSort: (k: SortKey) => void
}) {
  const fmtVND = (n: number) => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : n.toLocaleString()
  const totalCost = rows.reduce((s, r) => s + r.cost, 0)

  function Th({ col, label }: { col: SortKey; label: string }) {
    return (
      <th className="px-3 py-3 font-medium text-gray-500 text-right cursor-pointer hover:text-gray-700 select-none" onClick={() => toggleSort(col)}>
        <div className="flex items-center justify-end gap-1">
          {label}<SortIcon col={col} sortKey={sortKey} dir={sortDir} />
        </div>
      </th>
    )
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 w-8">
              <input type="checkbox"
                checked={rows.length > 0 && rows.every(r => selected.has(r.term))}
                onChange={toggleAll} className="rounded" />
            </th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Search Term</th>
            <Th col="impressions" label="Imp." />
            <Th col="clicks" label="Clicks" />
            <Th col="ctr" label="CTR" />
            <Th col="cpc" label="CPC" />
            <Th col="cost" label="Cost" />
            <Th col="conversions" label="Conv." />
            <th className="px-3 py-3 font-medium text-gray-500 text-left text-xs">Campaign</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 ? (
            <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">Không có search term nào trong nhóm này</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i} className={cn('hover:bg-gray-50 transition-colors',
              selected.has(r.term) ? 'bg-blue-50' : '',
              cat === 'WASTE' && r.cost > 1500000 ? 'bg-red-50 hover:bg-red-100' : ''
            )}>
              <td className="px-4 py-2.5">
                <input type="checkbox" checked={selected.has(r.term)} onChange={() => toggleRow(r.term)} className="rounded" />
              </td>
              <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[240px]">
                <div className="truncate">{r.term}</div>
                <div className="text-xs text-gray-400">{r.matchType}</div>
              </td>
              <td className="px-3 py-2.5 text-right text-gray-500 text-xs">{r.impressions.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right text-gray-600">{r.clicks}</td>
              <td className="px-3 py-2.5 text-right text-gray-600">{r.ctr.toFixed(2)}%</td>
              <td className="px-3 py-2.5 text-right text-gray-500 text-xs">{r.cpc > 0 ? fmtVND(r.cpc)+'đ' : '—'}</td>
              <td className="px-3 py-2.5 text-right font-medium text-gray-700">{r.cost > 0 ? fmtVND(r.cost)+'đ' : '—'}</td>
              <td className="px-3 py-2.5 text-right">
                {r.conversions > 0
                  ? <span className="font-semibold text-green-600">{r.conversions}</span>
                  : <span className="text-gray-300">0</span>}
              </td>
              <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[140px] truncate">{r.campaign}</td>
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="border-t bg-gray-50">
            <tr>
              <td colSpan={6} className="px-4 py-2 text-xs text-gray-500 font-medium">
                Tổng {rows.length} terms{selected.size > 0 && ` · ${selected.size} đã chọn`}
              </td>
              <td className="px-3 py-2 text-right text-xs font-semibold text-gray-700">{fmtVND(totalCost)}đ</td>
              <td className="px-3 py-2 text-right text-xs font-semibold text-green-600">
                {rows.reduce((s, r) => s + r.conversions, 0)}
              </td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
