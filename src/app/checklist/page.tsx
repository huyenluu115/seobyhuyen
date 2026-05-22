'use client'

import { useState, useEffect } from 'react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Printer, RotateCcw, CheckCircle2 } from 'lucide-react'

type Priority = 'critical' | 'important' | 'nice'

interface CheckItem {
  id: string
  label: string
  priority: Priority
  guide: string
}

interface Group {
  id: string
  title: string
  icon: string
  items: CheckItem[]
}

const GROUPS: Group[] = [
  {
    id: 'structure', title: 'Cấu trúc tài khoản', icon: '🏗️',
    items: [
      { id: 's1', label: 'Conversion tracking đã được thiết lập', priority: 'critical', guide: 'Google Ads → Tools → Conversions. Cần ít nhất 1 action đang active với "Recording conversions: Yes".' },
      { id: 's2', label: 'Cấu trúc Campaign → Ad Group → Keyword logic và rõ ràng', priority: 'critical', guide: 'Mỗi campaign nên tập trung 1 mục tiêu/sản phẩm. Ad group nên gom keyword theo 1 theme cụ thể.' },
      { id: 's3', label: 'Mỗi Ad Group có dưới 20 keywords', priority: 'critical', guide: 'Ad group > 20 keywords thường có vấn đề về Ad Relevance. Tách nhỏ hơn để tăng QS.' },
      { id: 's4', label: 'Tên campaign và ad group nhất quán, dễ filter', priority: 'important', guide: 'Dùng convention: [Type]-[Product]-[Audience]. Ví dụ: SB-PhhanMem-Retargeting.' },
      { id: 's5', label: 'Labels được dùng để tổ chức tài khoản', priority: 'important', guide: 'Tạo labels theo nhóm: theo ngân sách, theo hiệu suất, theo giai đoạn test.' },
      { id: 's6', label: 'Shared budgets được dùng hợp lý', priority: 'important', guide: 'Shared budget phù hợp khi muốn linh hoạt phân bổ giữa các campaign cùng mục tiêu.' },
      { id: 's7', label: 'Có campaign experiments/drafts để A/B test', priority: 'nice', guide: 'Dùng Campaign Drafts & Experiments để test bidding strategy, budget mà không ảnh hưởng campaign gốc.' },
      { id: 's8', label: 'Có dùng Portfolio bidding strategies', priority: 'nice', guide: 'Portfolio bidding cho phép tối ưu bid trên nhiều campaign cùng lúc với 1 mục tiêu chung.' },
    ]
  },
  {
    id: 'keywords', title: 'Từ khóa', icon: '🔑',
    items: [
      { id: 'k1', label: 'Negative keywords đã được thêm ở campaign và account level', priority: 'critical', guide: 'Review Search Terms report hàng tuần. Thêm negative ngay khi thấy term không liên quan.' },
      { id: 'k2', label: 'Không có keyword duplicate giữa các campaign', priority: 'critical', guide: 'Dùng Google Ads Editor → Find duplicate keywords. Duplicate gây các campaign tự cannibalize nhau.' },
      { id: 'k3', label: 'Dùng đa dạng match type (Exact + Phrase + Broad)', priority: 'critical', guide: 'Exact: kiểm soát cao, CPC cao. Broad: khám phá, cần negative chặt. Phrase: cân bằng.' },
      { id: 'k4', label: 'Review Search Terms report ít nhất hàng tuần', priority: 'important', guide: 'Search Terms → Download → lọc theo cost, conversions. Thêm winner vào Exact, thêm waste vào negative.' },
      { id: 'k5', label: 'QS trung bình toàn tài khoản > 5', priority: 'important', guide: 'QS < 5 → CPC cao hơn đối thủ. Ưu tiên fix keyword có QS 1-4 và impression cao.' },
      { id: 'k6', label: 'Không có keyword "Limited by bid" hoặc "Low search volume"', priority: 'important', guide: 'Low search volume: tạm ngưng hoặc dùng broader match. Limited by bid: tăng bid hoặc QS.' },
      { id: 'k7', label: 'Dùng Keyword Planner để mở rộng thường xuyên', priority: 'nice', guide: 'Mỗi tháng dùng Keyword Planner kiểm tra keyword mới, xu hướng tìm kiếm trong ngành.' },
      { id: 'k8', label: 'Có keyword seasonal cho dịp đặc biệt', priority: 'nice', guide: 'Chuẩn bị keyword cho Tết, Black Friday, 11/11... trước 2-3 tuần.' },
      { id: 'k9', label: 'Có competitor keywords trong campaign riêng', priority: 'nice', guide: 'Tạo campaign riêng cho competitor brand terms với bid và message phù hợp.' },
      { id: 'k10', label: 'Đã kiểm tra và loại bỏ keyword trùng lặp trong cùng ad group', priority: 'important', guide: 'Keyword trùng trong cùng ad group không giúp gì mà còn làm phức tạp báo cáo.' },
    ]
  },
  {
    id: 'adcopy', title: 'Quảng cáo', icon: '📝',
    items: [
      { id: 'a1', label: 'Mỗi Ad Group có ít nhất 1 RSA (Responsive Search Ad)', priority: 'critical', guide: 'Google đang ưu tiên RSA. Tạo RSA với Ad Strength ít nhất "Good" trước khi chạy.' },
      { id: 'a2', label: 'Ad Strength của RSA đạt mức "Good" hoặc "Excellent"', priority: 'critical', guide: 'Cải thiện Ad Strength bằng cách thêm headlines độc đáo, tránh duplicate, dùng keywords.' },
      { id: 'a3', label: 'Có ít nhất 2 ads đang active per ad group', priority: 'critical', guide: 'Ít nhất 2 ads để Google rotate và tìm ra ad tốt hơn. Xóa ad perform kém sau 30 ngày.' },
      { id: 'a4', label: 'Đang dùng đầy đủ ad extensions (Sitelink, Callout, Call, Structured Snippet)', priority: 'important', guide: 'Extensions tăng CTR 10-15% và không tốn thêm chi phí. Tối thiểu: Sitelink 4+, Callout 4+.' },
      { id: 'a5', label: 'Pin headlines và descriptions được dùng hợp lý', priority: 'important', guide: 'Chỉ pin khi thực sự cần thiết (pháp lý, brand). Pin quá nhiều giảm khả năng tối ưu của AI.' },
      { id: 'a6', label: 'Đang thực hiện A/B test cho ad copy', priority: 'important', guide: 'Test 1 element mỗi lần: headline chứa keyword vs benefit, CTA "Liên hệ" vs "Dùng thử".' },
      { id: 'a7', label: 'Dùng Dynamic Keyword Insertion khi phù hợp', priority: 'nice', guide: 'DKI tự động chèn keyword vào ad. Phù hợp cho ad group có nhiều keyword tương tự.' },
      { id: 'a8', label: 'Có responsive display ads cho campaigns Display/Discovery', priority: 'nice', guide: 'Thêm đủ ảnh (landscape + square + logo) và headlines để Google tối ưu format.' },
    ]
  },
  {
    id: 'bidding', title: 'Bid & Budget', icon: '💰',
    items: [
      { id: 'b1', label: 'Bidding strategy phù hợp với mục tiêu campaign', priority: 'critical', guide: 'Tăng chuyển đổi → Maximize Conversions/tCPA. Tăng giá trị → tROAS. Tăng traffic → Maximize Clicks. Cần data (≥30 conv/tháng) trước khi dùng smart bidding.' },
      { id: 'b2', label: 'Budget không bị giới hạn thường xuyên (Limited by budget)', priority: 'critical', guide: 'Campaign bị limited by budget mất impression share. Tăng budget hoặc giảm bid.' },
      { id: 'b3', label: 'Target CPA/ROAS có căn cứ từ data lịch sử', priority: 'important', guide: 'Target CPA = CPA lịch sử × 1.2 khi bắt đầu. Giảm dần 10-15% mỗi 2 tuần nếu volume ổn.' },
      { id: 'b4', label: 'Bid adjustments cho device, location, thời gian', priority: 'important', guide: 'Kiểm tra Performance by Device/Location. Giảm bid cho mobile nếu conv rate thấp hơn desktop ≥30%.' },
      { id: 'b5', label: 'Ngân sách phân bổ đúng tỷ trọng theo hiệu suất', priority: 'important', guide: 'Campaign có ROAS cao nên được phân bổ ngân sách nhiều hơn. Review phân bổ ngân sách hàng tháng.' },
      { id: 'b6', label: 'Có dùng Seasonality Adjustments cho dịp đặc biệt', priority: 'nice', guide: 'Tools → Bid Strategies → Seasonality Adjustments. Áp dụng khi conversion rate dự kiến thay đổi mạnh.' },
      { id: 'b7', label: 'Đã kiểm tra Auction Insights để biết competition level', priority: 'important', guide: 'Auction Insights cho biết overlap rate với đối thủ. Nếu overlap cao mà IS thấp → cần tăng bid/QS.' },
      { id: 'b8', label: 'Không có campaign nào spend ngân sách nhưng 0 conversion (sau 30 ngày)', priority: 'critical', guide: 'Campaign không convert sau 30 ngày + đủ data → pause và review landing page, keyword, bid.' },
    ]
  },
  {
    id: 'landing', title: 'Landing Page', icon: '🖥️',
    items: [
      { id: 'l1', label: 'Landing page load dưới 3 giây (kiểm tra PageSpeed Insights)', priority: 'critical', guide: 'PageSpeed score < 50 → Google giảm QS. Ưu tiên: nén ảnh, lazy load, minimize JS, dùng CDN.' },
      { id: 'l2', label: 'Landing page hiển thị tốt trên mobile', priority: 'critical', guide: '>60% traffic Google Ads là mobile. Test bằng Mobile-Friendly Test. Chú ý font size, button size, form.' },
      { id: 'l3', label: 'Message match: nội dung trang phải liên quan đến ad và keyword', priority: 'critical', guide: 'Keyword xuất hiện trong ad → phải thấy trên landing page. Thiếu message match → QS thấp.' },
      { id: 'l4', label: 'Có clear CTA (Call-to-Action) rõ ràng above the fold', priority: 'important', guide: 'CTA phải thấy ngay không cần scroll. Dùng màu tương phản, text hành động rõ: "Đăng ký miễn phí".' },
      { id: 'l5', label: 'Form liên hệ/đăng ký hoạt động đúng', priority: 'critical', guide: 'Test form mỗi tuần. Submit test → kiểm tra email, CRM, tracking. Form lỗi = mất tiền quảng cáo.' },
      { id: 'l6', label: 'Có trust signals: review, logo khách hàng, chứng chỉ', priority: 'important', guide: 'Trust signals tăng conversion rate 15-30%. Tối thiểu: số khách hàng/năm, 1 testimonial thật.' },
      { id: 'l7', label: 'Đang A/B test landing page', priority: 'nice', guide: 'Dùng Google Optimize (hoặc VWO, Unbounce) test 1 element: headline, CTA color, form length.' },
      { id: 'l8', label: 'Có heatmap tracking (Hotjar, Microsoft Clarity)', priority: 'nice', guide: 'Heatmap giúp thấy user click đâu, bỏ qua đâu. Microsoft Clarity miễn phí và dễ tích hợp.' },
    ]
  },
  {
    id: 'tracking', title: 'Tracking & Đo lường', icon: '📊',
    items: [
      { id: 't1', label: 'Google Analytics 4 đã được linked với Google Ads', priority: 'critical', guide: 'Tools → Linked accounts → Google Analytics. Import GA4 goals vào Google Ads conversions.' },
      { id: 't2', label: 'Auto-tagging đang bật (không tắt GCLID)', priority: 'critical', guide: 'Settings → Account settings → Auto-tagging: Yes. Nếu tắt, Google Ads không nhận data từ GA4.' },
      { id: 't3', label: 'Conversion actions đang đo lường đúng (không double count)', priority: 'critical', guide: 'Kiểm tra từng conversion action: đúng category, đúng value, Count = One (cho purchase). Tắt duplicate.' },
      { id: 't4', label: 'Remarketing audiences đã được tạo và đủ size', priority: 'important', guide: 'Tối thiểu: All visitors (30 ngày), Cart abandoners, Customers. Size > 100 mới chạy được.' },
      { id: 't5', label: 'Remarketing campaigns đang chạy nếu có đủ traffic', priority: 'important', guide: 'Remarketing có ROAS cao gấp 2-3x cold audience. Cần ≥500 visitors/tháng để bắt đầu.' },
      { id: 't6', label: 'Đang dùng Data-driven attribution (không dùng Last click)', priority: 'important', guide: 'Data-driven phân bổ credit chính xác hơn. Cần ≥3000 clicks và ≥300 conversions/30 ngày.' },
      { id: 't7', label: 'Google Merchant Center đã linked (nếu là eCommerce)', priority: 'nice', guide: 'Required cho Shopping ads. Link trong Google Ads → Tools → Linked accounts → Merchant Center.' },
      { id: 't8', label: 'Call tracking được thiết lập nếu có phone conversion', priority: 'nice', guide: 'Dùng Google Forwarding Number hoặc 3rd party (CallRail) để track calls từ quảng cáo.' },
    ]
  },
]

const PRIORITY_META: Record<Priority, { label: string; cls: string; dotCls: string }> = {
  critical:  { label: 'Critical',      cls: 'bg-red-100 text-red-700 border-red-200',    dotCls: 'bg-red-500' },
  important: { label: 'Important',     cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', dotCls: 'bg-yellow-500' },
  nice:      { label: 'Nice-to-have',  cls: 'bg-gray-100 text-gray-600 border-gray-200', dotCls: 'bg-gray-400' },
}

const LS_KEY = 'ads-audit-checklist-v1'

export default function ChecklistPage() {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(GROUPS.map(g => g.id)))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) setChecked(new Set(JSON.parse(saved)))
    } catch {}
    setMounted(true)
  }, [])

  function toggle(id: string) {
    setChecked(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      localStorage.setItem(LS_KEY, JSON.stringify([...n]))
      return n
    })
  }

  function toggleExpand(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleGroup(id: string) {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function reset() {
    if (confirm('Reset tất cả checklist? Không thể hoàn tác.')) {
      setChecked(new Set())
      localStorage.removeItem(LS_KEY)
    }
  }

  const totalItems = GROUPS.reduce((s, g) => s + g.items.length, 0)
  const totalChecked = checked.size
  const totalPct = Math.round(totalChecked / totalItems * 100)

  const criticalTotal = GROUPS.flatMap(g => g.items).filter(i => i.priority === 'critical').length
  const criticalChecked = GROUPS.flatMap(g => g.items).filter(i => i.priority === 'critical' && checked.has(i.id)).length

  if (!mounted) return null

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
          .checklist-item { page-break-inside: avoid; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6 no-print">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Audit Checklist</h1>
            <p className="text-sm text-gray-500 mt-0.5">50 hạng mục kiểm tra toàn diện tài khoản Google Ads</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
              <Printer size={13} />Export PDF
            </Button>
            <Button size="sm" variant="outline" onClick={reset} className="gap-1.5 text-red-600 hover:text-red-700">
              <RotateCcw size={13} />Reset
            </Button>
          </div>
        </div>

        {/* Print header */}
        <div className="print-only mb-6">
          <h1 className="text-2xl font-bold">Google Ads Audit Report</h1>
          <p className="text-gray-500">Ngày audit: {new Date().toLocaleDateString('vi-VN')} · Điểm: {totalChecked}/{totalItems} ({totalPct}%)</p>
        </div>

        {/* Overall progress */}
        <div className="bg-white rounded-xl border p-5 mb-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-2xl font-bold text-gray-900">{totalChecked}</span>
              <span className="text-gray-400 text-sm">/{totalItems} hoàn thành</span>
            </div>
            <div className="text-right">
              <span className={cn('text-2xl font-bold', totalPct >= 80 ? 'text-green-600' : totalPct >= 50 ? 'text-yellow-600' : 'text-red-600')}>
                {totalPct}%
              </span>
              <p className="text-xs text-gray-400">Critical: {criticalChecked}/{criticalTotal}</p>
            </div>
          </div>
          <Progress value={totalPct} className="h-2.5" />
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Critical: {criticalChecked}/{criticalTotal}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500" />Important: {GROUPS.flatMap(g=>g.items).filter(i=>i.priority==='important'&&checked.has(i.id)).length}/{GROUPS.flatMap(g=>g.items).filter(i=>i.priority==='important').length}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-400" />Nice-to-have: {GROUPS.flatMap(g=>g.items).filter(i=>i.priority==='nice'&&checked.has(i.id)).length}/{GROUPS.flatMap(g=>g.items).filter(i=>i.priority==='nice').length}</span>
          </div>
        </div>

        {/* Groups */}
        <div className="space-y-3">
          {GROUPS.map(group => {
            const groupChecked = group.items.filter(i => checked.has(i.id)).length
            const groupPct = Math.round(groupChecked / group.items.length * 100)
            const isOpen = expandedGroups.has(group.id)
            const criticalIssues = group.items.filter(i => i.priority === 'critical' && !checked.has(i.id))

            return (
              <div key={group.id} className="bg-white rounded-xl border shadow-sm overflow-hidden checklist-item">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left no-print">
                  <span className="text-xl">{group.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{group.title}</span>
                      {criticalIssues.length > 0 && (
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                          {criticalIssues.length} critical chưa xong
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[160px]">
                        <div className={cn('h-full rounded-full transition-all', groupPct >= 80 ? 'bg-green-500' : groupPct >= 50 ? 'bg-yellow-500' : 'bg-red-400')}
                          style={{ width: `${groupPct}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{groupChecked}/{group.items.length}</span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>

                {/* Print always shows content */}
                <div className={cn('border-t print-only')}>
                  <GroupItems group={group} checked={checked} expanded={expanded} toggle={toggle} toggleExpand={toggleExpand} />
                </div>

                {isOpen && (
                  <div className="border-t no-print">
                    <GroupItems group={group} checked={checked} expanded={expanded} toggle={toggle} toggleExpand={toggleExpand} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {totalPct === 100 && (
          <div className="mt-6 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
            <CheckCircle2 size={20} className="text-green-500 shrink-0" />
            <p className="text-sm font-medium text-green-800">Xuất sắc! Bạn đã hoàn thành 100% audit checklist.</p>
          </div>
        )}
      </div>
    </>
  )
}

function GroupItems({ group, checked, expanded, toggle, toggleExpand }: {
  group: Group
  checked: Set<string>
  expanded: Set<string>
  toggle: (id: string) => void
  toggleExpand: (id: string) => void
}) {
  return (
    <div className="divide-y">
      {group.items.map(item => {
        const isChecked = checked.has(item.id)
        const isExpanded = expanded.has(item.id)
        const meta = PRIORITY_META[item.priority]
        return (
          <div key={item.id} className={cn('checklist-item', isChecked ? 'bg-gray-50/50' : '')}>
            <div className="flex items-start gap-3 px-5 py-3">
              <input type="checkbox" checked={isChecked} onChange={() => toggle(item.id)}
                className="mt-0.5 h-4 w-4 rounded accent-blue-600 cursor-pointer shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className={cn('text-sm', isChecked ? 'line-through text-gray-400' : 'text-gray-800 font-medium')}>
                    {item.label}
                  </span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0', meta.cls)}>
                    {meta.label}
                  </span>
                </div>
                {isExpanded && (
                  <p className="text-xs text-gray-500 mt-2 bg-blue-50 rounded-lg px-3 py-2 leading-relaxed">
                    💡 {item.guide}
                  </p>
                )}
              </div>
              <button onClick={() => toggleExpand(item.id)}
                className="text-gray-300 hover:text-gray-500 shrink-0 mt-0.5 no-print"
                title={isExpanded ? 'Ẩn hướng dẫn' : 'Xem hướng dẫn'}>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
