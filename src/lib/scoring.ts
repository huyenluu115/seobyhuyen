import { THRESHOLDS } from './constants'

export interface ScoredCampaign {
  name: string
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  cost: number
  conversions: number
  convRate: number
  impressionShare: number
  qualityScore: number
  ctrScore: number
  convRateScore: number
  qsScore: number
  isScore: number
  totalScore: number
  level: 'good' | 'warning' | 'poor'
  suggestions: string[]
}

// Parse "6.97%" → 6.97, handles "--" and missing values
function parsePercent(val: string): number {
  if (!val || val.trim() === '--' || val.trim() === '') return 0
  return parseFloat(val.replace('%', '').replace(/\s/g, '')) || 0
}

// Parse "39,375,000" or "39.375.000" → 39375000, handles "--"
function parseNum(val: string): number {
  if (!val || val.trim() === '--' || val.trim() === '') return 0
  // Remove thousands separators (comma or period used as thousands sep)
  // Detect format: if last separator is followed by exactly 3 digits → thousands sep
  const v = val.trim().replace(/\s/g, '')
  // Remove all commas (thousands sep in en-US format used by Google Ads)
  return parseFloat(v.replace(/,/g, '')) || 0
}

// Try multiple possible column name variations Google Ads uses
function col(row: Record<string, string>, ...names: string[]): string {
  for (const n of names) {
    const v = row[n]
    if (v !== undefined && v !== null) return v
    // Case-insensitive fallback
    const key = Object.keys(row).find(k => k.toLowerCase() === n.toLowerCase())
    if (key) return row[key]
  }
  return ''
}

export function scoreCampaign(row: Record<string, string>): ScoredCampaign {
  const ctr = parsePercent(col(row, 'CTR', 'Ctr'))
  const convRate = parsePercent(col(row, 'Conv. rate', 'Conv. Rate', 'Conversion rate', 'Tỷ lệ chuyển đổi'))
  const qsRaw = col(row, 'Avg. Quality Score', 'Quality score', 'Avg quality score', 'Điểm chất lượng TB')
  const qs = parseFloat(qsRaw) || 5
  const is_ = parsePercent(col(row, 'Search Impr. share', 'Search impr. share', 'Impression share', 'Tỷ lệ hiển thị trên mạng TK'))

  const ctrScore = ctr >= THRESHOLDS.ctr.good ? 25 : ctr >= THRESHOLDS.ctr.warning ? 15 : 5
  const convRateScore = convRate >= THRESHOLDS.convRate.good ? 25 : convRate >= THRESHOLDS.convRate.warning ? 15 : 5
  const qsScore = qs >= THRESHOLDS.qualityScore.good ? 30 : qs >= THRESHOLDS.qualityScore.warning ? 18 : 5
  const isScore = is_ >= THRESHOLDS.impressionShare.good ? 20 : is_ >= THRESHOLDS.impressionShare.warning ? 12 : 4

  const totalScore = ctrScore + convRateScore + qsScore + isScore
  const level: 'good' | 'warning' | 'poor' = totalScore >= 70 ? 'good' : totalScore >= 40 ? 'warning' : 'poor'

  const suggestions: string[] = []
  if (ctrScore === 5) suggestions.push('CTR thấp — cải thiện headline, thêm từ khóa vào tiêu đề')
  if (convRateScore === 5) suggestions.push('Conv. Rate thấp — xem lại landing page, offer và CTA')
  if (qsScore === 5) suggestions.push('Quality Score thấp — tối ưu keyword relevance và ad copy')
  if (isScore === 4) suggestions.push('Impression Share thấp — tăng budget hoặc bid')

  const imp  = parseNum(col(row, 'Impressions', 'Số lượt hiển thị', 'Lượt hiển thị'))
  const clk  = parseNum(col(row, 'Clicks', 'Lượt nhấp'))
  const cost = parseNum(col(row, 'Cost', 'Chi phí'))
  const conv = parseNum(col(row, 'Conversions', 'Lượt chuyển đổi'))
  const cpc  = parseNum(col(row, 'Avg. CPC', 'Avg CPC', 'CPC Tr.bình', 'CPC trung bình'))

  return {
    name: row['Campaign'] || '',
    impressions: imp,
    clicks: clk,
    ctr,
    cpc,
    cost,
    conversions: conv,
    convRate,
    impressionShare: is_,
    qualityScore: qs,
    ctrScore,
    convRateScore,
    qsScore,
    isScore,
    totalScore,
    level,
    suggestions,
  }
}
