'use client'

import { useState, useMemo } from 'react'
import { CsvUploader } from '@/components/shared/CsvUploader'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Check, Minus, X as XIcon, ArrowUpDown, RotateCcw } from 'lucide-react'
import { LandingPageChecker } from '@/components/shared/LandingPageChecker'
import { cn } from '@/lib/utils'

interface KwRow {
  keyword: string
  adGroup: string
  campaign: string
  qs: number
  expCtr: string
  adRelevance: string
  landingPage: string
  impressions: number
  clicks: number
}

function normComp(val: string): 'above' | 'average' | 'below' {
  const v = (val || '').toLowerCase()
  if (v.includes('above') || v.includes('trên trung bình')) return 'above'
  if (v.includes('below') || v.includes('dưới trung bình')) return 'below'
  return 'average'
}

function CompIcon({ val }: { val: string }) {
  const n = normComp(val)
  if (n === 'above') return <span title="Above average"><Check size={14} className="text-green-500 mx-auto" /></span>
  if (n === 'below') return <span title="Below average"><XIcon size={14} className="text-red-500 mx-auto" /></span>
  return <span title="Average"><Minus size={14} className="text-yellow-500 mx-auto" /></span>
}

const FIX_STEPS: Record<string, { title: string; steps: string[]; impact: string }> = {
  expCtr: {
    title: 'Expected CTR thấp',
    steps: [
      'Thêm từ khóa chính xác vào Headline 1 của quảng cáo',
      'Dùng số liệu cụ thể trong ad copy (giảm 30%, miễn phí tư vấn...)',
      'Thêm callout extension, sitelink để tăng diện tích hiển thị',
      'A/B test ít nhất 3 phiên bản ad copy khác nhau',
      'Xem quảng cáo của đối thủ để tìm điểm khác biệt',
    ],
    impact: 'CTR tăng → QS tăng → CPC giảm 10–30%',
  },
  adRelevance: {
    title: 'Ad Relevance thấp',
    steps: [
      'Tách ad group: mỗi nhóm chỉ 5–15 từ khóa cùng chủ đề',
      'Đảm bảo từ khóa xuất hiện trong Headline 1 và Description',
      'Dùng Dynamic Keyword Insertion {KeyWord:Mặc định} nếu phù hợp',
      'Xóa từ khóa không liên quan khỏi ad group hiện tại',
    ],
    impact: 'Relevance tăng → QS tăng 1–2 điểm → ít bị mất impression',
  },
  landingPage: {
    title: 'Landing Page Experience kém',
    steps: [
      'Kiểm tra tốc độ tải trang tại PageSpeed Insights (target > 70 điểm mobile)',
      'Thêm từ khóa chính vào H1, tiêu đề trang và đoạn đầu nội dung',
      'Đảm bảo CTA rõ ràng, nằm above-the-fold (không cần cuộn)',
      'Tối ưu trải nghiệm mobile: font lớn hơn, nút bấm dễ chạm',
      'Nội dung trang phải khớp với search intent của từ khóa đó',
    ],
    impact: 'LP cải thiện → QS tăng → giảm CPC và tăng Ad Rank',
  },
}

function getIssues(r: KwRow): ('expCtr' | 'adRelevance' | 'landingPage')[] {
  const issues: ('expCtr' | 'adRelevance' | 'landingPage')[] = []
  if (normComp(r.expCtr) === 'below') issues.push('expCtr')
  if (normComp(r.adRelevance) === 'below') issues.push('adRelevance')
  if (normComp(r.landingPage) === 'below') issues.push('landingPage')
  return issues
}

function QsBadge({ qs }: { qs: number }) {
  const cls = qs >= 7 ? 'bg-green-100 text-green-700' : qs >= 4 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  return <span className={cn('rounded px-2 py-0.5 text-xs font-bold', cls)}>{qs}/10</span>
}

export default function QualityScorePage() {
  const [rows, setRows] = useState<KwRow[]>([])
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filterCampaign, setFilterCampaign] = useState('')
  const [filterAdGroup, setFilterAdGroup] = useState('')

  function handleData(data: Record<string, string>[]) {
    function get(r: Record<string, string>, ...keys: string[]): string {
      for (const k of keys) {
        if (r[k] !== undefined && r[k] !== null) return r[k]
        const found = Object.keys(r).find(rk => rk.toLowerCase() === k.toLowerCase())
        if (found) return r[found]
      }
      return ''
    }
    const mapped = data.map(r => ({
      keyword: get(r, 'Keyword', 'Từ khóa', 'Từ Khóa'),
      adGroup: get(r, 'Ad group', 'Ad Group', 'Nhóm quảng cáo'),
      campaign: get(r, 'Campaign', 'Chiến dịch'),
      qs: parseInt(get(r, 'Quality Score', 'Quality score', 'Điểm Chất Lượng', 'Điểm chất lượng') || '5') || 5,
      expCtr: get(r, 'Exp. CTR', 'Expected CTR', 'Exp CTR', 'CTR dự kiến') || 'Average',
      adRelevance: get(r, 'Ad Relevance', 'Ad relevance', 'Mức Độ liên quan của quảng cáo', 'Mức độ liên quan của quảng cáo') || 'Average',
      landingPage: get(r, 'Landing Page Exp.', 'Landing page exp.', 'Landing Page Experience', 'Trải nghiệm trang đích') || 'Average',
      impressions: parseInt((get(r, 'Impressions', 'Số lượt hiển thị', 'Lượt hiển thị') || '0').replace(/,/g, '')) || 0,
      clicks: parseInt((get(r, 'Clicks', 'Lượt nhấp') || '0').replace(/,/g, '')) || 0,
    }))
    const hasKeywords = mapped.some(r => r.keyword !== '')
    if (!hasKeywords) {
      alert('⚠️ Không tìm thấy cột "Keyword / Từ Khóa".\n\nĐể lấy đúng file: Google Ads → Keywords → Keywords → Thêm cột Quality Score → Download CSV')
      return
    }
    setRows(mapped)
    setFilterCampaign('')
    setFilterAdGroup('')
  }

  async function loadSample() {
    const res = await fetch('/sample-data/sample-keywords.csv')
    const text = await res.text()
    const { parseGoogleAdsCsv } = await import('@/lib/csv-parser')
    handleData(parseGoogleAdsCsv(text))
  }

  const campaigns = useMemo(() => [...new Set(rows.map(r => r.campaign))].sort(), [rows])
  const adGroups = useMemo(() => {
    const src = filterCampaign ? rows.filter(r => r.campaign === filterCampaign) : rows
    return [...new Set(src.map(r => r.adGroup))].sort()
  }, [rows, filterCampaign])

  const filtered = rows.filter(r =>
    (!filterCampaign || r.campaign === filterCampaign) &&
    (!filterAdGroup || r.adGroup === filterAdGroup)
  )
  const sorted = [...filtered].sort((a, b) => sortDir === 'asc' ? a.qs - b.qs : b.qs - a.qs)

  // Only render bars for QS values that actually exist
  const distribution = useMemo(() => {
    const d: Record<number, number> = {}
    filtered.forEach(r => { if (r.qs >= 1 && r.qs <= 10) d[r.qs] = (d[r.qs] || 0) + 1 })
    return Object.entries(d).map(([qs, count]) => ({ qs: Number(qs), count })).sort((a, b) => a.qs - b.qs)
  }, [filtered])

  const allIssues = useMemo(() => {
    const b = { expCtr: 0, adRelevance: 0, landingPage: 0 }
    filtered.forEach(r => {
      getIssues(r).forEach(k => { b[k]++ })
    })
    return b
  }, [filtered])

  const avgQs = filtered.length ? (filtered.reduce((s, r) => s + r.qs, 0) / filtered.length).toFixed(1) : '0'
  const goodCount = filtered.filter(r => r.qs >= 7).length
  const poorCount = filtered.filter(r => r.qs <= 4).length

  const bottleneck = useMemo(() => {
    const b = { expCtr: 0, adRelevance: 0, landingPage: 0 }
    filtered.forEach(r => {
      if (normComp(r.expCtr) === 'below') b.expCtr++
      if (normComp(r.adRelevance) === 'below') b.adRelevance++
      if (normComp(r.landingPage) === 'below') b.landingPage++
    })
    const entries = (Object.entries(b) as [keyof typeof b, number][]).sort((a, b) => b[1] - a[1])
    if (entries[0][1] === 0) return null
    return { key: entries[0][0], count: entries[0][1] }
  }, [filtered])

  const bottleneckLabel: Record<string, string> = {
    expCtr: 'Expected CTR',
    adRelevance: 'Ad Relevance',
    landingPage: 'Landing Page Exp.',
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quality Score Tracker</h1>
          <p className="text-sm text-gray-500 mt-0.5">Phân bố QS 1–10 và xác định bottleneck trong 3 thành phần</p>
        </div>
        {rows.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setRows([])} className="gap-1.5">
            <RotateCcw size={13} />Reset
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="max-w-lg mx-auto mt-12 space-y-4">
          <CsvUploader onData={handleData} onSampleLoad={loadSample}
            label="Upload Keyword Report CSV" />
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 space-y-1.5">
            <p className="font-semibold text-blue-900">Cách lấy file từ Google Ads:</p>
            <p>1. Vào <strong>Keywords → Keywords</strong></p>
            <p>2. Nhấn <strong>Columns → Modify columns</strong></p>
            <p>3. Thêm vào: <strong>Quality Score · Exp. CTR · Ad Relevance · Landing Page Exp.</strong></p>
            <p>4. Chọn khoảng thời gian → <strong>Download → CSV</strong></p>
            <p className="pt-1 text-blue-600">Cột bắt buộc: Keyword · Campaign · Ad group · Quality Score · Exp. CTR · Ad Relevance · Landing Page Exp.</p>
            <p className="text-blue-500">Lưu ý: Google Ads export QS dạng số (1–10) hoặc Above/Average/Below average — tool xử lý được cả hai.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'QS Trung bình', value: `${avgQs}/10`, color: 'text-gray-900' },
              { label: `QS ≥ 7 — Tốt (${goodCount}/${filtered.length})`, value: goodCount, color: 'text-green-600' },
              { label: `QS ≤ 4 — Cần fix ngay`, value: poorCount, color: poorCount > 0 ? 'text-red-600' : 'text-gray-400' },
              { label: 'Keyword có vấn đề', value: filtered.filter(r => getIssues(r).length > 0).length, color: 'text-orange-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={cn('text-3xl font-bold', s.color)}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Action Plan — chỉ hiện khi có vấn đề */}
          {(allIssues.expCtr > 0 || allIssues.adRelevance > 0 || allIssues.landingPage > 0) && (
            <div className="mb-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-800">Kế hoạch hành động — ưu tiên fix theo thứ tự này</h2>
              {((['landingPage', 'adRelevance', 'expCtr'] as const)
                .map(k => ({ k, count: allIssues[k] }))
                .filter(x => x.count > 0)
                .sort((a, b) => b.count - a.count)
              ).map(({ k, count }, idx) => {
                const fix = FIX_STEPS[k]
                return (
                  <div key={k} className={cn('rounded-xl border p-4',
                    idx === 0 ? 'border-red-200 bg-red-50' : idx === 1 ? 'border-orange-200 bg-orange-50' : 'border-yellow-200 bg-yellow-50'
                  )}>
                    <div className="flex items-start gap-3">
                      <span className={cn('shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white',
                        idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : 'bg-yellow-500'
                      )}>{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-sm text-gray-800">{fix.title}</span>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                            idx === 0 ? 'bg-red-100 text-red-700' : idx === 1 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
                          )}>{count} keyword bị ảnh hưởng</span>
                        </div>
                        <ul className="space-y-1">
                          {fix.steps.map((step, i) => (
                            <li key={i} className="text-xs text-gray-700 flex gap-2">
                              <span className="text-gray-400 shrink-0">→</span>{step}
                            </li>
                          ))}
                        </ul>
                        <p className={cn('text-xs font-medium mt-2',
                          idx === 0 ? 'text-red-600' : idx === 1 ? 'text-orange-600' : 'text-yellow-700'
                        )}>Tác động: {fix.impact}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-4 mb-5">
            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Phân bố Quality Score</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={distribution} barCategoryGap="30%">
                  <XAxis dataKey="qs" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} label={{ value: 'QS', position: 'insideRight', offset: 10, fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
                  <Tooltip formatter={(v) => [String(v) + ' keyword', '']} labelFormatter={(l) => `QS = ${l}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {distribution.map(({ qs }) => (
                      <Cell key={qs} fill={qs >= 7 ? '#16a34a' : qs >= 4 ? '#ca8a04' : '#dc2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Phân tích 3 thành phần</h2>
              {(['expCtr', 'adRelevance', 'landingPage'] as const).map(key => {
                const labelMap = { expCtr: 'Expected CTR', adRelevance: 'Ad Relevance', landingPage: 'Landing Page Exp.' }
                const belowCnt = filtered.filter(r => normComp(r[key]) === 'below').length
                const avgCnt = filtered.filter(r => normComp(r[key]) === 'average').length
                const aboveCnt = filtered.filter(r => normComp(r[key]) === 'above').length
                const total = filtered.length || 1
                return (
                  <div key={key} className="mb-4 last:mb-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-600">{labelMap[key]}</span>
                      <span className="text-gray-400">
                        {aboveCnt > 0 && <span className="text-green-600 font-medium">{aboveCnt} tốt </span>}
                        {avgCnt > 0 && <span>{avgCnt} TB </span>}
                        {belowCnt > 0 && <span className="text-red-500 font-medium">{belowCnt} kém ← fix</span>}
                      </span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-green-400 transition-all" style={{ width: `${aboveCnt / total * 100}%` }} />
                      <div className="h-full bg-yellow-300 transition-all" style={{ width: `${avgCnt / total * 100}%` }} />
                      <div className="h-full bg-red-400 transition-all" style={{ width: `${belowCnt / total * 100}%` }} />
                    </div>
                  </div>
                )
              })}
              <p className="text-xs text-gray-400 mt-3 flex gap-3">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Tốt (Above)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-300 inline-block" />Trung bình</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Kém (cần fix)</span>
              </p>
            </div>
          </div>

          {/* Filters + table */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b bg-gray-50">
              <select className="text-xs border rounded-lg px-2 py-1.5 text-gray-600 bg-white"
                value={filterCampaign} onChange={e => { setFilterCampaign(e.target.value); setFilterAdGroup('') }}>
                <option value="">Tất cả Campaign</option>
                {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="text-xs border rounded-lg px-2 py-1.5 text-gray-600 bg-white"
                value={filterAdGroup} onChange={e => setFilterAdGroup(e.target.value)}>
                <option value="">Tất cả Ad Group</option>
                {adGroups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <span className="text-xs text-gray-400">{filtered.length} keywords</span>
              <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                <ArrowUpDown size={11} />
                QS {sortDir === 'asc' ? 'thấp nhất trước' : 'cao nhất trước'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Keyword</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-500">Campaign / Ad Group</th>
                    <th className="px-3 py-3 font-medium text-gray-500 text-center">QS</th>
                    <th className="px-3 py-3 font-medium text-gray-500 text-center">Exp.CTR</th>
                    <th className="px-3 py-3 font-medium text-gray-500 text-center">Ad Rel.</th>
                    <th className="px-3 py-3 font-medium text-gray-500 text-center">Landing</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-left">Cần làm gì</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sorted.map((r, i) => {
                    const issues = getIssues(r)
                    return (
                      <tr key={i} className={cn('hover:bg-gray-50 transition-colors',
                        r.qs <= 3 ? 'bg-red-50/40' : issues.length > 0 ? 'bg-orange-50/20' : ''
                      )}>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px]">
                          <div className="truncate">{r.keyword}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-400 max-w-[160px]">
                          {r.campaign && <div className="truncate">{r.campaign}</div>}
                          {r.adGroup && <div className="truncate text-gray-300">{r.adGroup}</div>}
                        </td>
                        <td className="px-3 py-3 text-center"><QsBadge qs={r.qs} /></td>
                        <td className="px-3 py-3 text-center"><CompIcon val={r.expCtr} /></td>
                        <td className="px-3 py-3 text-center"><CompIcon val={r.adRelevance} /></td>
                        <td className="px-3 py-3 text-center"><CompIcon val={r.landingPage} /></td>
                        <td className="px-4 py-3 text-xs max-w-[300px]">
                          {issues.length === 0 ? (
                            <span className="text-green-600 font-medium">✓ Đang tốt — theo dõi định kỳ</span>
                          ) : (
                            <div className="space-y-1.5">
                              {issues.map(k => (
                                <div key={k}>
                                  <span className="font-medium text-gray-700">{FIX_STEPS[k].title}: </span>
                                  <span className="text-orange-600">{FIX_STEPS[k].steps[0]}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {/* Landing page checker */}
          <div className="mt-5">
            <LandingPageChecker />
          </div>
        </>
      )}
    </div>
  )
}
