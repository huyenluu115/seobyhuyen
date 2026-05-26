'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Download, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'

interface Keyword { keyword: string; difficulty: string; note: string }
interface KeywordGroup { intent: string; keywords: Keyword[] }
interface TopicCluster { pillar: string; subtopics: string[] }

interface KeywordResult {
  primary_keyword: string
  search_intent: string
  difficulty: string
  keyword_groups: KeywordGroup[]
  long_tail_keywords: string[]
  topic_clusters: TopicCluster[]
  content_ideas: string[]
}

const INTENT_CFG: Record<string, { color: string; bg: string }> = {
  Informational: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
  Transactional: { color: 'text-green-700', bg: 'bg-green-50 border-green-100' },
  Commercial: { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100' },
  Navigational: { color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100' },
}

const DIFF_CFG: Record<string, string> = {
  'Thấp': 'bg-green-100 text-green-700',
  'Trung bình': 'bg-yellow-100 text-yellow-700',
  'Cao': 'bg-red-100 text-red-700',
}

const GOALS = [
  { value: 'tăng traffic', label: 'Tăng traffic' },
  { value: 'tăng conversion', label: 'Tăng conversion' },
  { value: 'branding', label: 'Branding' },
  { value: 'informational', label: 'Informational' },
]

const INFO_MODS = ['là gì', 'như thế nào', 'tại sao', 'có tác dụng gì', 'hướng dẫn', 'cách', 'bí quyết', 'kinh nghiệm', 'tổng hợp', 'ở đâu tốt']
const TRANS_MODS = ['giá bao nhiêu', 'mua ở đâu', 'rẻ nhất', 'ưu đãi', 'khuyến mãi', 'đặt hàng online', 'chi phí', 'phí', 'gói']
const COMM_MODS = ['tốt nhất', 'uy tín', 'review', 'đánh giá', 'so sánh', 'loại nào tốt', 'nên chọn', 'có tốt không', 'top']
const NAV_MODS = ['chính thức', 'website', 'hotline', 'địa chỉ', 'liên hệ']
const LONG_TAIL_MODS = ['cho người mới bắt đầu', 'tại nhà', 'hiệu quả nhất 2025', 'lợi ích', 'có an toàn không', 'bao lâu', 'cần lưu ý gì', 'sai lầm thường gặp']

function generateKeywords(seed: string, industry: string, goal: string, audience: string): KeywordResult {
  const s = seed.trim()

  const infoKws: Keyword[] = INFO_MODS.slice(0, 7).map(m => ({
    keyword: `${s} ${m}`,
    difficulty: 'Thấp',
    note: 'Phù hợp viết blog giải thích',
  }))
  const transKws: Keyword[] = TRANS_MODS.slice(0, 5).map(m => ({
    keyword: `${s} ${m}`,
    difficulty: 'Cao',
    note: 'Tiềm năng conversion cao',
  }))
  const commKws: Keyword[] = COMM_MODS.slice(0, 6).map(m => ({
    keyword: `${s} ${m}`,
    difficulty: 'Trung bình',
    note: 'Người dùng đang so sánh, cân nhắc',
  }))
  const navKws: Keyword[] = NAV_MODS.slice(0, 3).map(m => ({
    keyword: `${s} ${m}`,
    difficulty: 'Thấp',
    note: 'Tìm kiếm brand hoặc địa điểm',
  }))

  const longTail = [
    ...LONG_TAIL_MODS.map(m => `${s} ${m}`),
    audience ? `${s} cho ${audience}` : `${s} cho doanh nghiệp vừa và nhỏ`,
    industry ? `${s} ngành ${industry}` : `${s} phổ biến nhất`,
  ]

  const clusters: TopicCluster[] = [
    {
      pillar: `Tổng quan về ${s}`,
      subtopics: [`${s} là gì`, `lịch sử ${s}`, `phân loại ${s}`, `đặc điểm ${s}`, `ưu nhược điểm ${s}`],
    },
    {
      pillar: `Hướng dẫn thực hành ${s}`,
      subtopics: [`cách ${s} hiệu quả`, `các bước ${s}`, `lưu ý khi ${s}`, `sai lầm khi ${s}`, `công cụ hỗ trợ ${s}`],
    },
    {
      pillar: `So sánh & đánh giá ${s}`,
      subtopics: [`${s} loại nào tốt`, `so sánh các loại ${s}`, `review ${s}`, `${s} tốt nhất hiện nay`, `nên chọn ${s} nào`],
    },
    {
      pillar: `Chi phí & mua ${s}`,
      subtopics: [`giá ${s} bao nhiêu`, `mua ${s} ở đâu uy tín`, `chi phí ${s} trung bình`, `ưu đãi ${s}`, `${s} miễn phí`],
    },
  ]

  const contentIdeas = [
    `${s} là gì? Hướng dẫn toàn diện cho người mới`,
    `Top 10 ${s} tốt nhất hiện nay — review chi tiết`,
    `${s}: So sánh chi tiết và cách lựa chọn phù hợp`,
    `Kinh nghiệm ${s} từ chuyên gia — tránh ${10} sai lầm phổ biến`,
    `Chi phí ${s} bao nhiêu? Bảng giá chi tiết 2025`,
    `Hướng dẫn ${s} từng bước cho người mới bắt đầu`,
    `${s} có an toàn không? Những điều cần biết trước khi dùng`,
  ]

  return {
    primary_keyword: s,
    search_intent: goal === 'tăng conversion' ? 'Transactional' : goal === 'branding' ? 'Navigational' : goal === 'informational' ? 'Informational' : 'Mixed (Informational + Commercial)',
    difficulty: 'Trung bình',
    keyword_groups: [
      { intent: 'Informational', keywords: infoKws },
      { intent: 'Transactional', keywords: transKws },
      { intent: 'Commercial', keywords: commKws },
      { intent: 'Navigational', keywords: navKws },
    ],
    long_tail_keywords: longTail,
    topic_clusters: clusters,
    content_ideas: contentIdeas,
  }
}

function exportCsv(result: KeywordResult) {
  const rows: string[][] = [['Từ khóa', 'Intent', 'Độ khó', 'Ghi chú']]
  result.keyword_groups.forEach(g => g.keywords.forEach(k => rows.push([k.keyword, g.intent, k.difficulty, k.note])))
  result.long_tail_keywords.forEach(k => rows.push([k, 'Long-tail', 'Thấp', '']))
  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `keyword-${result.primary_keyword}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function KeywordResearchPage() {
  const [seedKw, setSeedKw] = useState('')
  const [industry, setIndustry] = useState('')
  const [goal, setGoal] = useState('tăng traffic')
  const [audience, setAudience] = useState('')
  const [result, setResult] = useState<KeywordResult | null>(null)
  const [error, setError] = useState('')
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null)

  function handleResearch() {
    if (!seedKw.trim()) { setError('Vui lòng nhập từ khóa seed'); return }
    setError('')
    setResult(generateKeywords(seedKw, industry, goal, audience))
  }

  const totalKws = result
    ? result.keyword_groups.reduce((s, g) => s + g.keywords.length, 0) + result.long_tail_keywords.length
    : 0

  return (
    <div className="p-6 md:p-8 pb-16">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Keyword Research Assistant</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gợi ý từ khóa theo search intent — phân tích tức thì, không cần API</p>
        </div>
        {result && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportCsv(result)}>
              <Download size={13} />Export CSV
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setResult(null); setError('') }}>
              <RotateCcw size={13} />Nghiên cứu lại
            </Button>
          </div>
        )}
      </div>

      {!result && (
        <div className="max-w-xl space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Từ khóa seed *</label>
            <Input value={seedKw} onChange={e => setSeedKw(e.target.value)}
              placeholder="vd: bảo hiểm sức khỏe, phần mềm kế toán..."
              onKeyDown={e => e.key === 'Enter' && handleResearch()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Ngành / lĩnh vực</label>
              <Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="vd: bảo hiểm, fintech" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Đối tượng mục tiêu</label>
              <Input value={audience} onChange={e => setAudience(e.target.value)} placeholder="vd: doanh nghiệp nhỏ" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Mục tiêu SEO</label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map(g => (
                <button key={g.value} onClick={() => setGoal(g.value)}
                  className={cn('px-3 py-1.5 text-xs rounded-full border font-medium transition-colors',
                    goal === g.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200')}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <Button onClick={handleResearch} className="w-full md:w-auto">Nghiên cứu từ khóa</Button>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Từ khóa seed', value: result.primary_keyword, small: true },
              { label: 'Search intent', value: result.search_intent, small: true },
              { label: 'Độ khó ước tính', value: result.difficulty },
              { label: 'Tổng từ khóa gợi ý', value: String(totalKws) },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={cn('font-bold text-gray-900 break-words', s.small ? 'text-sm' : 'text-xl')}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {result.keyword_groups.map(group => {
              const cfg = INTENT_CFG[group.intent] || { color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' }
              return (
                <div key={group.intent} className={cn('rounded-xl border overflow-hidden', cfg.bg)}>
                  <div className="px-4 py-3 border-b border-inherit">
                    <span className={cn('text-xs font-bold uppercase tracking-wide', cfg.color)}>{group.intent}</span>
                    <span className="text-xs text-gray-500 ml-2">· {group.keywords.length} từ khóa</span>
                  </div>
                  <div className="bg-white divide-y">
                    {group.keywords.map(kw => (
                      <div key={kw.keyword} className="px-4 py-3 flex items-center gap-3">
                        <span className="flex-1 text-sm font-medium text-gray-800">{kw.keyword}</span>
                        <span className={cn('text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0', DIFF_CFG[kw.difficulty] || 'bg-gray-100 text-gray-600')}>
                          {kw.difficulty}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0 hidden md:block max-w-[180px] truncate">{kw.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {result.long_tail_keywords.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Long-tail Keywords ({result.long_tail_keywords.length})</h3>
              </div>
              <div className="p-4 flex flex-wrap gap-2">
                {result.long_tail_keywords.map(kw => (
                  <span key={kw} className="bg-gray-100 text-gray-700 text-xs rounded-full px-3 py-1.5 font-medium">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {result.topic_clusters.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Topic Clusters ({result.topic_clusters.length} nhóm)</h3>
              </div>
              <div className="divide-y">
                {result.topic_clusters.map(cluster => {
                  const isOpen = expandedCluster === cluster.pillar
                  return (
                    <div key={cluster.pillar}>
                      <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                        onClick={() => setExpandedCluster(isOpen ? null : cluster.pillar)}>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800">{cluster.pillar}</p>
                          <p className="text-xs text-gray-400">{cluster.subtopics.length} chủ đề con</p>
                        </div>
                        {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-3 pt-1 flex flex-wrap gap-1.5">
                          {cluster.subtopics.map(sub => (
                            <span key={sub} className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-1">{sub}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {result.content_ideas.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Ý tưởng bài viết</h3>
              </div>
              <div className="divide-y">
                {result.content_ideas.map((idea, i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-3">
                    <span className="text-xs font-bold text-gray-300 shrink-0 mt-0.5">#{i + 1}</span>
                    <p className="text-sm text-gray-800">{idea}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
