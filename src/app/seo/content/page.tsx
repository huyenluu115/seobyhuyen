'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { CheckCircle2, AlertTriangle, XCircle, RotateCcw, ChevronDown, ChevronUp, ClipboardList, Globe, Loader2 } from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_TYPES = [
  { value: 'blog',     label: 'Blog / Bài viết',      min: 800,  max: 2500 },
  { value: 'pillar',   label: 'Blog chuyên sâu / Pillar', min: 2500, max: 6000 },
  { value: 'landing',  label: 'Landing Page / Dịch vụ', min: 400,  max: 1200 },
  { value: 'product',  label: 'Product Page',          min: 300,  max: 800  },
  { value: 'category', label: 'Category Page',         min: 150,  max: 600  },
  { value: 'faq',      label: 'FAQ Page',              min: 300,  max: 1500 },
]

const VN_CTA = ['liên hệ', 'mua ngay', 'đăng ký', 'tư vấn', 'dùng thử', 'báo giá', 'nhận ngay',
  'tải xuống', 'xem thêm', 'bắt đầu', 'đặt hàng', 'nhận tư vấn', 'gọi ngay', 'chat ngay', 'đặt lịch', 'nhận báo giá']

const VN_EXPERIENCE = ['khi tôi', 'thực tế', 'kinh nghiệm', 'thực tiễn', 'trong thực tế', 'tôi đã', 'chúng tôi đã',
  'theo kinh nghiệm', 'từ kinh nghiệm', 'bản thân', 'thử nghiệm', 'thực nghiệm', 'case study', 'kết quả thực']

const VN_EXPERTISE = ['nghiên cứu', 'số liệu', 'thống kê', 'theo', 'nguồn', 'dẫn chứng', 'trích dẫn',
  'chuyên gia', 'chuyên viên', 'năm kinh nghiệm', 'chứng nhận', 'bộ', 'viện', 'đại học', '%', 'theo báo cáo', 'khảo sát']

const VN_TRANSITIONS = ['tuy nhiên', 'ngoài ra', 'bên cạnh đó', 'do đó', 'vì vậy', 'kết quả là', 'hơn nữa',
  'đặc biệt', 'ví dụ', 'cụ thể', 'thứ nhất', 'thứ hai', 'thứ ba', 'cuối cùng', 'tóm lại', 'nhìn chung',
  'mặt khác', 'trái lại', 'thêm vào đó', 'đồng thời', 'trước tiên', 'sau đó', 'tiếp theo']

const VN_OVERPROMISE = ['đảm bảo 100%', 'chắc chắn thành công', 'không bao giờ thất bại', 'tuyệt đối an toàn',
  'cam kết 100%', 'chắc chắn', 'nhất định', 'không thể sai', 'luôn luôn hiệu quả']

// ── Types ──────────────────────────────────────────────────────────────────────

type Status = 'pass' | 'warning' | 'fail'

interface CheckItem {
  id: string
  label: string
  status: Status
  note: string
  fix?: string
}

interface CheckGroup {
  id: string
  name: string
  weight: number
  items: CheckItem[]
}

interface AnalysisResult {
  groups: CheckGroup[]
  score: number
  passCount: number
  warnCount: number
  failCount: number
  totalItems: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function cleanText(t: string) {
  return t.replace(/<[^>]+>/g, ' ').replace(/#+\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractHeadings(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const h1 = lines.filter(l => /^#\s/.test(l) || /<h1[\s>]/i.test(l))
  const h2 = lines.filter(l => /^##\s/.test(l) || /<h2[\s>]/i.test(l))
  const h3 = lines.filter(l => /^###\s/.test(l) || /<h3[\s>]/i.test(l))
  return { h1, h2, h3, lines }
}

function getWords(text: string) {
  return cleanText(text).split(/\s+/).filter(Boolean)
}

function getParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.split(/\s+/).length > 5)
}

function getSentences(text: string): string[] {
  return cleanText(text).split(/[.!?]+/).map(s => s.trim()).filter(s => s.split(/\s+/).length > 3)
}

function hasPattern(text: string, patterns: string[]): string[] {
  const lower = text.toLowerCase()
  return patterns.filter(p => lower.includes(p))
}

// ── Core analysis ──────────────────────────────────────────────────────────────

function analyzeContent(
  article: string, primaryKw: string, secondaryKwsRaw: string,
  pageType: string, metaDesc: string, urlSlug: string,
): AnalysisResult {
  const kw = primaryKw.toLowerCase().trim().normalize('NFC')
  const clean = cleanText(article).normalize('NFC')
  const lower = clean.toLowerCase()
  const words = getWords(clean)
  const wc = words.length
  const { h1, h2, h3 } = extractHeadings(article)
  const sentences = getSentences(clean)
  const paragraphs = getParagraphs(article)
  const lines = article.split('\n').map(l => l.trim()).filter(Boolean)

  const titleText = (h1[0] || lines[0] || '').replace(/^#+\s*/, '').replace(/<[^>]+>/g, '').toLowerCase()
  const h2Texts = h2.map(l => l.replace(/^#+\s*/, '').replace(/<[^>]+>/g, '').toLowerCase())
  const first100 = words.slice(0, 100).join(' ').toLowerCase()
  const last100 = words.slice(-100).join(' ').toLowerCase()

  const kwCount = (clean.match(new RegExp(esc(kw), 'gi')) || []).length
  const density = wc > 0 ? (kwCount / wc) * 100 : 0

  const secKws = secondaryKwsRaw.split(/[,\n]/).map(k => k.trim().toLowerCase()).filter(Boolean)
  const secFound = secKws.filter(k => lower.includes(k))
  const secRatio = secKws.length > 0 ? secFound.length / secKws.length : 1

  const pt = PAGE_TYPES.find(p => p.value === pageType) || PAGE_TYPES[0]

  const hasLists = /^[-*]\s|^\d+\.\s/m.test(article)
  const hasTables = /\|.+\|.+\|/.test(article)
  const hasBold = /\*\*.+?\*\*|<b>|<strong>/.test(article)
  const hasImages = /!\[.*?\]\(.*?\)|<img/i.test(article)

  const avgSentLen = sentences.length > 0
    ? sentences.reduce((s, c) => s + c.split(/\s+/).length, 0) / sentences.length : 0

  const longSentPct = sentences.length > 0
    ? sentences.filter(s => s.split(/\s+/).length > 30).length / sentences.length * 100 : 0

  const shortSentPct = sentences.length > 0
    ? sentences.filter(s => s.split(/\s+/).length <= 12).length / sentences.length * 100 : 0

  const maxParaWords = Math.max(...paragraphs.map(p => getWords(p).length), 0)
  const longParas = paragraphs.filter(p => getWords(p).length > 150).length

  const transFound = hasPattern(clean, VN_TRANSITIONS)
  const transPct = sentences.length > 0 ? transFound.length / sentences.length * 100 : 0

  const experienceFound = hasPattern(clean, VN_EXPERIENCE)
  const expertiseFound = hasPattern(clean, VN_EXPERTISE)
  const overpromiseFound = hasPattern(lower, VN_OVERPROMISE)
  const ctaFound = hasPattern(lower, VN_CTA)

  const hasDateInContent = /\b(20\d{2}|tháng \d+\/\d{4}|\d{1,2}\/\d{4})\b/.test(clean)
  const hasDefinition = /\b\w+\s+(là|được định nghĩa là|có nghĩa là)\s+/i.test(clean)
  const questionHeadings = [...h2, ...h3].filter(h => h.includes('?'))

  // Internal links: [text](url) pointing to same domain or relative
  const internalLinks = (article.match(/\[.+?\]\((?!http|#).+?\)/g) || []).length
    + (article.match(/href="\/[^"]+"/g) || []).length

  // ── GROUP 1: Từ khóa chính (×1.2) ────────────────────────────────────────
  const g1: CheckItem[] = [
    {
      id: 'kw-h1', label: 'Từ khóa trong H1',
      status: titleText.includes(kw) ? 'pass' : 'fail',
      note: titleText.includes(kw)
        ? `✓ Tìm thấy trong H1: "${(h1[0] || lines[0] || '').replace(/^#+\s*/, '').slice(0, 70)}"`
        : 'Thêm từ khóa chính vào tiêu đề H1 (dòng # đầu tiên)',
    },
    {
      id: 'title-h1-diff', label: 'Title tag & H1 khác nhau',
      status: metaDesc ? 'pass' : 'warning',
      note: metaDesc
        ? 'Đã nhập meta description — kiểm tra title tag trong CMS để đảm bảo khác H1'
        : 'Không nhập meta description — chưa thể kiểm tra. Title tag nên khác H1 một chút',
    },
    {
      id: 'kw-meta', label: 'Từ khóa trong meta description',
      status: !metaDesc ? 'warning' : metaDesc.toLowerCase().includes(kw) ? 'pass' : 'fail',
      note: !metaDesc ? 'Nhập meta description để kiểm tra'
        : metaDesc.toLowerCase().includes(kw)
        ? `✓ Tìm thấy (${metaDesc.length} ký tự)`
        : `Thêm "${kw}" vào meta description trong CMS (Yoast / RankMath → SEO Description, 70–160 ký tự)`,
    },
    {
      id: 'kw-url', label: 'Từ khóa trong URL slug',
      status: !urlSlug ? 'warning'
        : urlSlug.toLowerCase().includes(kw.replace(/\s+/g, '-')) || urlSlug.toLowerCase().includes(kw.replace(/\s+/g, ''))
        ? 'pass' : 'fail',
      note: !urlSlug ? 'Nhập URL slug để kiểm tra'
        : urlSlug.toLowerCase().includes(kw.replace(/\s+/g, '-'))
        ? `✓ Slug chứa từ khóa: "${urlSlug}"`
        : `Đổi slug thành: "${kw.trim().toLowerCase().replace(/\s+/g, '-')}" — dùng dấu gạch ngang, bỏ dấu tiếng Việt nếu cần`,
    },
    {
      id: 'kw-first100', label: 'Từ khóa trong 100 từ đầu',
      status: first100.includes(kw) ? 'pass' : 'fail',
      note: first100.includes(kw) ? '✓ Từ khóa xuất hiện trong đoạn mở bài'
        : 'Đưa từ khóa vào đoạn mở đầu trong 100 từ đầu tiên',
    },
    {
      id: 'kw-h2', label: 'Từ khóa hoặc biến thể trong ≥1 H2',
      status: h2Texts.some(h => h.includes(kw) || kw.split(/\s+/).some(w => w.length > 3 && h.includes(w))) ? 'pass' : 'warning',
      note: h2Texts.some(h => h.includes(kw)) ? '✓ Từ khóa có trong heading H2'
        : h2Texts.some(h => kw.split(/\s+/).some(w => w.length > 3 && h.includes(w)))
        ? '✓ Biến thể từ khóa có trong H2'
        : 'Thêm từ khóa hoặc biến thể vào ít nhất 1 heading H2',
    },
    {
      id: 'kw-density', label: 'Mật độ từ khóa (0.5–2.5%)',
      status: density >= 0.5 && density <= 2.5 ? 'pass'
        : density > 2.5 && density <= 4 ? 'warning' : 'fail',
      note: `${density.toFixed(2)}% (${kwCount} lần / ${wc} từ)${
        density < 0.5 ? ' — quá thấp, thêm từ khóa tự nhiên hơn'
        : density > 4 ? ' — quá cao, giảm để tránh spam'
        : density > 2.5 ? ' — hơi cao, nên ≤2.5%' : ' — tốt'}`,
    },
    {
      id: 'kw-last100', label: 'Từ khóa trong phần kết bài (100 từ cuối)',
      status: last100.includes(kw) ? 'pass' : 'warning',
      note: last100.includes(kw) ? '✓ Từ khóa xuất hiện trong phần kết'
        : 'Thêm từ khóa vào đoạn kết luận hoặc CTA',
    },
  ]

  // ── GROUP 2: Semantic & NLP (×1.3) ────────────────────────────────────────
  const g2: CheckItem[] = [
    {
      id: 'sec-kw', label: 'Từ khóa phụ xuất hiện ≥70%',
      status: secKws.length === 0 ? 'pass'
        : secRatio >= 0.7 ? 'pass' : secRatio >= 0.4 ? 'warning' : 'fail',
      note: secKws.length === 0 ? 'Không có từ khóa phụ — nhập vào ô "Từ khóa phụ" để kiểm tra'
        : secRatio >= 0.7 ? `✓ ${secFound.length}/${secKws.length} từ khóa phụ (${Math.round(secRatio * 100)}%)`
        : `${secFound.length}/${secKws.length} từ khóa phụ — thiếu: ${secKws.filter(k => !secFound.includes(k)).slice(0, 4).join(', ')}. Thêm tự nhiên vào nội dung`,
    },
    {
      id: 'paa-heading', label: 'Có heading dạng câu hỏi (PAA)',
      status: questionHeadings.length >= 2 ? 'pass' : questionHeadings.length === 1 ? 'warning' : 'fail',
      note: questionHeadings.length >= 1
        ? `✓ ${questionHeadings.length} heading dạng câu hỏi — tốt cho People Also Ask`
        : `Thêm ≥2 H2/H3 dạng câu hỏi, ví dụ: "## ${kw} là gì?", "## Tại sao cần ${kw}?", "## Cách ${kw} hiệu quả nhất?"`,
    },
    {
      id: 'definition', label: 'Có đoạn định nghĩa trực tiếp (Featured Snippet)',
      status: hasDefinition ? 'pass' : 'warning',
      note: hasDefinition
        ? '✓ Tìm thấy cấu trúc "X là..." — phù hợp để Google lấy làm featured snippet'
        : 'Thêm câu định nghĩa: "X là..." ngay sau heading H2 có từ khóa (40–60 từ)',
    },
    {
      id: 'lsi', label: 'Nội dung giàu ngữ nghĩa (không lặp 1 từ)',
      status: density <= 2.5 && secFound.length >= 2 ? 'pass'
        : density <= 3 ? 'warning' : 'fail',
      note: density <= 2.5 && secFound.length >= 2
        ? '✓ Đa dạng từ vựng, mật độ cân bằng'
        : 'Dùng biến thể, đồng nghĩa thay vì lặp lại từ khóa chính nhiều lần',
    },
    {
      id: 'search-intent', label: 'Nội dung khớp search intent của từ khóa',
      status: 'warning',
      note: 'Cần kiểm tra thủ công: Mở Google, search từ khóa chính, xem top 3 trang là loại nội dung gì (how-to / list / review / definition…) và đảm bảo bài viết cùng định dạng',
    },
  ]

  // ── GROUP 3: Cấu trúc bài viết (×1.0) ─────────────────────────────────────
  const introWords = words.slice(0, Math.floor(wc * 0.12)).join(' ').toLowerCase()
  const outroWords = words.slice(Math.floor(wc * 0.85)).join(' ').toLowerCase()
  const hasConclusion = outroWords.length > 50 && ctaFound.some(c => outroWords.includes(c))

  const g3: CheckItem[] = [
    {
      id: 'h2-count', label: 'Có ≥3 heading H2 phân cấp rõ ràng',
      status: h2.length >= 3 ? 'pass' : h2.length === 2 ? 'warning' : 'fail',
      note: `${h2.length} H2 tìm thấy${h2.length < 3 ? ` — cần ≥3 H2 để cấu trúc nội dung hợp lý` : ''}`,
    },
    {
      id: 'h3-logic', label: 'Cấu trúc H3 logic (không nhảy cấp)',
      status: h3.length === 0 || h2.length >= 1 ? 'pass' : 'fail',
      note: h3.length === 0 ? 'Không có H3 — ổn'
        : h2.length >= 1 ? `✓ H2: ${h2.length}, H3: ${h3.length} — thứ tự hợp lệ`
        : `Có H3 nhưng thiếu H2 — sửa lại: H2 là mục lớn, H3 là mục con bên dưới H2. Đổi ít nhất 1 H3 thành H2`,
    },
    {
      id: 'no-wall', label: 'Không có wall of text (đoạn >150 từ)',
      status: longParas === 0 ? 'pass' : longParas <= 1 ? 'warning' : 'fail',
      note: longParas === 0 ? '✓ Không có đoạn văn quá dài'
        : `${longParas} đoạn văn vượt 150 từ — ngắt thành đoạn nhỏ hơn`,
    },
    {
      id: 'para-length', label: 'Đoạn văn 2–5 câu (không quá dài/ngắn)',
      status: maxParaWords <= 130 && paragraphs.length > 2 ? 'pass' : 'warning',
      note: maxParaWords > 200 ? `Đoạn dài nhất ~${maxParaWords} từ — nên ≤130 từ/đoạn`
        : `Đoạn văn có độ dài phù hợp`,
    },
    {
      id: 'lists', label: 'Có danh sách bullet / numbered list',
      status: hasLists ? 'pass' : wc > 500 ? 'warning' : 'pass',
      note: hasLists ? '✓ Có danh sách — giúp scan và featured snippet'
        : wc > 500 ? 'Thêm ít nhất 1 danh sách (bullet hoặc numbered) để dễ đọc và tối ưu snippet' : 'OK',
    },
    {
      id: 'cta', label: 'Kết bài có CTA rõ ràng',
      status: ctaFound.length > 0 ? 'pass' : 'warning',
      note: ctaFound.length > 0
        ? `✓ CTA: ${ctaFound.slice(0, 3).join(', ')}`
        : 'Thêm lời kêu gọi hành động cuối bài: liên hệ, đăng ký, tải về...',
    },
    {
      id: 'bold', label: 'Dùng bold highlight thông tin quan trọng',
      status: hasBold ? 'pass' : 'warning',
      note: hasBold ? '✓ Có dùng **bold** — tốt cho scan và nhấn mạnh'
        : 'Thêm **bold** cho 2–4 thông tin quan trọng nhất trong bài',
    },
  ]

  // ── GROUP 4: Độ dài (×1.0) ────────────────────────────────────────────────
  const wordOk = wc >= pt.min && wc <= pt.max
  const wordWarn = wc >= pt.min * 0.75 && wc < pt.min

  const g4: CheckItem[] = [
    {
      id: 'word-count', label: `Độ dài bài (${pt.label})`,
      status: wordOk ? 'pass' : wordWarn ? 'warning' : 'fail',
      note: `${wc.toLocaleString()} từ — chuẩn ${pt.min.toLocaleString()}–${pt.max.toLocaleString()} từ. ${
        wc < pt.min * 0.75 ? `Cần bổ sung thêm ~${(pt.min - wc).toLocaleString()} từ nữa — thêm mục "Câu hỏi thường gặp", ví dụ thực tế, hoặc mở rộng phân tích`
        : wordWarn ? `Nên thêm ~${(pt.min - wc).toLocaleString()} từ để đủ chuẩn` : wc > pt.max ? 'Cân nhắc tách thành 2 bài hoặc di chuyển phần phụ sang bài khác' : 'Đạt chuẩn'}`,
    },
    {
      id: 'intro-ratio', label: 'Phân bổ mở bài ≥8% tổng từ',
      status: introWords.split(/\s+/).length >= wc * 0.08 ? 'pass' : 'warning',
      note: `Mở bài ~${Math.round(introWords.split(/\s+/).length / wc * 100)}% — nên 8–15% tổng từ`,
    },
    {
      id: 'conclusion-ratio', label: 'Có phần kết / tóm tắt',
      status: hasConclusion ? 'pass' : outroWords.length > 30 ? 'warning' : 'fail',
      note: hasConclusion ? '✓ Kết bài có CTA'
        : outroWords.length > 30 ? 'Có kết bài nhưng thiếu CTA rõ ràng'
        : 'Thiếu phần kết bài — thêm tóm tắt + CTA',
    },
  ]

  // ── GROUP 5: E-E-A-T (×1.5) ───────────────────────────────────────────────
  const g5: CheckItem[] = [
    {
      id: 'experience', label: 'Experience — Dẫn chứng từ thực tế',
      status: experienceFound.length >= 2 ? 'pass' : experienceFound.length === 1 ? 'warning' : 'fail',
      note: experienceFound.length >= 2
        ? `✓ Tín hiệu thực tế: ${experienceFound.slice(0, 3).join(', ')}`
        : experienceFound.length === 1
        ? `Có 1 tín hiệu thực tế — thêm: case study cụ thể, kết quả đo được, hoặc "Chúng tôi đã thử..."`
        : 'Thêm dẫn chứng từ thực tế: "Theo kinh nghiệm X năm...", kết quả cụ thể (tỷ lệ %, thời gian), hoặc mini case study',
    },
    {
      id: 'expertise', label: 'Expertise — Số liệu, nghiên cứu, dẫn nguồn',
      status: expertiseFound.length >= 3 ? 'pass' : expertiseFound.length >= 1 ? 'warning' : 'fail',
      note: expertiseFound.length >= 3
        ? `✓ Tín hiệu chuyên môn: ${expertiseFound.slice(0, 4).join(', ')}`
        : expertiseFound.length >= 1
        ? `${expertiseFound.length} tín hiệu chuyên môn — thêm: "Theo nghiên cứu của [nguồn]...", thống kê có link, hoặc trích dẫn chuyên gia`
        : 'Thêm ít nhất 2–3 trong số: số liệu thống kê có nguồn, trích dẫn chuyên gia, link đến nghiên cứu, hoặc chứng nhận',
    },
    {
      id: 'no-overpromise', label: 'Không hứa hẹn phi thực tế',
      status: overpromiseFound.length === 0 ? 'pass' : 'warning',
      note: overpromiseFound.length === 0 ? '✓ Không phát hiện claims quá mức'
        : `Phát hiện: "${overpromiseFound.join('", "')}" — cân nhắc điều chỉnh để tránh mất trust`,
    },
    {
      id: 'date-in-content', label: 'Có ngày/năm khi nói về số liệu',
      status: hasDateInContent ? 'pass' : 'warning',
      note: hasDateInContent ? '✓ Có năm/ngày trong nội dung — tốt cho freshness'
        : 'Thêm năm cụ thể cho số liệu: "Theo báo cáo 2025...", "Tính đến tháng 1/2026..."',
    },
    {
      id: 'author-bio', label: 'Tác giả có bio / credentials (kiểm tra thủ công)',
      status: 'warning',
      note: 'Kiểm tra trên trang publish: bio tác giả hiển thị không? Có link đến LinkedIn/profile không? Có nêu chức danh/chuyên môn không?',
    },
  ]

  // ── GROUP 6: Readability (×1.0) ────────────────────────────────────────────
  const g6: CheckItem[] = [
    {
      id: 'sent-len', label: 'Độ dài câu trung bình ≤20 từ',
      status: avgSentLen <= 20 ? 'pass' : avgSentLen <= 28 ? 'warning' : 'fail',
      note: `TB ${Math.round(avgSentLen)} từ/câu${
        avgSentLen > 20 ? ` — ${Math.round(longSentPct)}% câu vượt 30 từ. Chia câu ngắn hơn` : ''}`,
    },
    {
      id: 'short-sents', label: 'Có ≥20% câu ngắn (≤12 từ)',
      status: shortSentPct >= 20 ? 'pass' : shortSentPct >= 10 ? 'warning' : 'fail',
      note: `${Math.round(shortSentPct)}% câu ngắn ≤12 từ — ${shortSentPct < 20 ? 'xen kẽ thêm câu ngắn tạo nhịp điệu đọc' : 'tốt'}`,
    },
    {
      id: 'transitions', label: 'Dùng từ kết nối (transition words) ≥30%',
      status: transPct >= 30 ? 'pass' : transPct >= 15 ? 'warning' : 'fail',
      note: `~${Math.round(transPct)}% đoạn có từ kết nối${transFound.length > 0 ? ` (${transFound.slice(0, 3).join(', ')}...)` : ''}${
        transPct < 15 ? ' — thêm: "tuy nhiên", "ngoài ra", "do đó", "cụ thể là"...' : ''}`,
    },
    {
      id: 'formatting', label: 'Có ảnh / bảng hỗ trợ nội dung',
      status: hasImages || hasTables ? 'pass' : wc > 600 ? 'warning' : 'pass',
      note: hasImages ? '✓ Có ảnh trong bài'
        : hasTables ? '✓ Có bảng so sánh'
        : wc > 600 ? 'Thêm ≥1 ảnh minh họa có alt text và 1 bảng nếu có nội dung so sánh' : 'OK',
    },
    {
      id: 'visual-break', label: 'Có visual break mỗi ~300 từ',
      status: (h2.length + h3.length + (hasLists ? 1 : 0) + (hasImages ? 1 : 0)) >= Math.floor(wc / 300) ? 'pass' : 'warning',
      note: `${h2.length + h3.length} heading + ${hasLists ? 'list' : 'không có list'} + ${hasImages ? 'ảnh' : 'không có ảnh'} — cứ 300 từ nên có 1 visual break`,
    },
  ]

  // ── GROUP 7: HCU — Helpful Content (×1.4) ─────────────────────────────────
  const overallDensity = kwCount / (wc || 1) * 100
  const g7: CheckItem[] = [
    {
      id: 'no-stuffing', label: 'Không keyword stuffing toàn bài',
      status: overallDensity <= 2.5 ? 'pass' : overallDensity <= 4 ? 'warning' : 'fail',
      note: overallDensity <= 2.5 ? '✓ Mật độ tự nhiên'
        : `Từ khóa xuất hiện ${kwCount} lần — giảm bớt và thay bằng biến thể`,
    },
    {
      id: 'no-padding', label: 'Không có nội dung padding/filler',
      status: wc > 0 && sentences.filter(s => s.split(/\s+/).length < 5).length / sentences.length < 0.2 ? 'pass' : 'warning',
      note: 'Kiểm tra: không có câu rỗng nghĩa, không lặp lại ý đã nói, mỗi đoạn đều thêm thông tin mới',
    },
    {
      id: 'specific-facts', label: 'Có số liệu / dữ liệu cụ thể',
      status: expertiseFound.filter(s => /\d|%|số liệu|thống kê|nghiên cứu/.test(s)).length > 0 || /\d+%|\d+ người|\d+ năm/.test(clean)
        ? 'pass' : 'warning',
      note: /\d+%|\d+ người|\d+ năm/.test(clean)
        ? '✓ Có số liệu cụ thể trong bài'
        : 'Thêm số liệu cụ thể: tỷ lệ %, thời gian, kết quả đo lường',
    },
    {
      id: 'search-satisfy', label: 'Sau khi đọc, user không cần search lại (kiểm tra thủ công)',
      status: 'warning',
      note: 'Tự hỏi: Bài đã trả lời ĐẦY ĐỦ intent của người tìm kiếm chưa? Hay họ vẫn cần đọc thêm nguồn khác?',
    },
  ]

  // ── GROUP 8: Featured Snippet (×1.1) ──────────────────────────────────────
  const g8: CheckItem[] = [
    {
      id: 'definition-para', label: 'Có đoạn định nghĩa 40–60 từ cho snippet',
      status: hasDefinition ? 'pass' : 'warning',
      note: hasDefinition ? '✓ Cấu trúc "X là..." phù hợp để Google chọn làm paragraph snippet'
        : 'Viết đoạn định nghĩa ngắn 40–60 từ ngay sau H2: "[Chủ đề] là... [mô tả ngắn gọn]"',
    },
    {
      id: 'numbered-list', label: 'Có numbered list cho quy trình / bước',
      status: /^\d+\.\s/m.test(article) ? 'pass' : pageType === 'blog' || pageType === 'faq' ? 'warning' : 'pass',
      note: /^\d+\.\s/m.test(article) ? '✓ Có numbered list — phù hợp cho list snippet'
        : 'Thêm danh sách đánh số (1. 2. 3.) cho các quy trình — Google thường lấy loại này',
    },
    {
      id: 'qa-structure', label: 'Cấu trúc Q&A rõ ràng',
      status: questionHeadings.length >= 2 ? 'pass' : questionHeadings.length === 1 ? 'warning' : 'fail',
      note: questionHeadings.length >= 2
        ? `✓ ${questionHeadings.length} heading câu hỏi — tốt cho PAA và AI Overview`
        : 'Thêm heading dạng "Câu hỏi...?" để Google lấy vào mục People Also Ask',
    },
  ]

  // ── GROUP 9: Internal Linking (×1.0) ──────────────────────────────────────
  const linksPerK = wc > 0 ? internalLinks / (wc / 1000) : 0
  const g9: CheckItem[] = [
    {
      id: 'internal-links', label: 'Có internal link ngữ cảnh (2–5 / 1.000 từ)',
      status: linksPerK >= 2 && linksPerK <= 5 ? 'pass'
        : linksPerK >= 1 ? 'warning' : 'fail',
      note: internalLinks === 0
        ? `Không phát hiện internal link — thêm 2–5 link đến bài liên quan trong cùng chủ đề. Dùng anchor text mô tả: "[tên bài liên quan](url)" thay vì "xem thêm"`
        : linksPerK < 2 ? `${internalLinks} link / ${wc} từ (${linksPerK.toFixed(1)}/1.000 từ) — nên thêm đến 2–5 link/1.000 từ`
        : `✓ ~${internalLinks} internal links (${linksPerK.toFixed(1)}/1.000 từ)`,
    },
    {
      id: 'anchor-quality', label: 'Anchor text mô tả nội dung trang đích',
      status: internalLinks > 0 ? 'warning' : 'fail',
      note: internalLinks > 0
        ? 'Kiểm tra thủ công: anchor text có chứa từ khóa mô tả trang đích không? Tránh dùng "xem thêm", "tại đây"'
        : 'Khi thêm internal link, dùng anchor text mô tả nội dung: "cách tối ưu tốc độ trang" thay vì "xem tại đây"',
    },
    {
      id: 'external-cite', label: 'Có link dẫn nguồn uy tín (.gov, .edu, báo lớn)',
      status: /https?:\/\/(www\.)?(gov\.|edu\.|who\.|un\.|vnexpress|tuoitre|dantri|gso\.gov|moh\.gov)/.test(article)
        ? 'pass' : 'warning',
      note: /https?:\/\//.test(article)
        ? 'Kiểm tra external link: có link đến nguồn uy tín không (.gov, .edu, tổ chức lớn)?'
        : 'Thêm ≥1 link đến nguồn uy tín (báo lớn, cơ quan nhà nước, tổ chức nghiên cứu)',
    },
  ]

  // ── GROUP 10: Content Freshness (×1.1) ────────────────────────────────────
  const recentYearMatch = clean.match(/\b202[4-9]\b|\b2030\b/g) || []
  const g10: CheckItem[] = [
    {
      id: 'date-publish', label: 'Đề cập ngày/năm xuất bản trong nội dung',
      status: hasDateInContent ? 'pass' : 'warning',
      note: hasDateInContent
        ? `✓ Tìm thấy mốc thời gian trong bài (${recentYearMatch.slice(0, 2).join(', ') || 'định dạng khác'})`
        : 'Thêm năm khi đề cập số liệu: "Năm 2025, tỷ lệ..."',
    },
    {
      id: 'recent-stats', label: 'Số liệu trong vòng 12 tháng (≥2024)',
      status: recentYearMatch.length >= 1 ? 'pass' : 'warning',
      note: recentYearMatch.length >= 1
        ? `✓ Có đề cập năm gần đây: ${recentYearMatch.slice(0, 3).join(', ')}`
        : 'Cập nhật số liệu mới nhất 2024–2026 — số liệu cũ làm giảm freshness signal',
    },
    {
      id: 'evergreen-vs-trending', label: 'Xác định rõ bài evergreen hay trending',
      status: 'warning',
      note: 'Nếu bài trending: thêm "Cập nhật [tháng/năm]" vào title. Nếu evergreen: tránh dùng "hiện nay", "gần đây" không có năm cụ thể',
    },
  ]

  // ── Score calculation ──────────────────────────────────────────────────────
  const groups: CheckGroup[] = [
    { id: 'g1', name: 'Từ khóa chính',              weight: 1.2, items: g1 },
    { id: 'g2', name: 'Semantic & NLP',              weight: 1.3, items: g2 },
    { id: 'g3', name: 'Cấu trúc bài viết',           weight: 1.0, items: g3 },
    { id: 'g4', name: 'Độ dài & Phân bổ',            weight: 1.0, items: g4 },
    { id: 'g5', name: 'E-E-A-T',                     weight: 1.5, items: g5 },
    { id: 'g6', name: 'Readability & UX',            weight: 1.0, items: g6 },
    { id: 'g7', name: 'Helpful Content (HCU)',        weight: 1.4, items: g7 },
    { id: 'g8', name: 'Featured Snippet',            weight: 1.1, items: g8 },
    { id: 'g9', name: 'Internal & External Links',   weight: 1.0, items: g9 },
    { id: 'g10', name: 'Content Freshness',          weight: 1.1, items: g10 },
  ]

  let rawScore = 0, maxScore = 0
  let passCount = 0, warnCount = 0, failCount = 0
  groups.forEach(g => {
    g.items.forEach(item => {
      const pts = item.status === 'pass' ? 1 : item.status === 'warning' ? 0.5 : 0
      rawScore += pts * g.weight
      maxScore += 1 * g.weight
      if (item.status === 'pass') passCount++
      else if (item.status === 'warning') warnCount++
      else failCount++
    })
  })
  const score = maxScore > 0 ? Math.round(rawScore / maxScore * 100) : 0

  return { groups, score, passCount, warnCount, failCount, totalItems: passCount + warnCount + failCount }
}

// ── UI components ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pass:    { Icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 border-green-100' },
  warning: { Icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50 border-yellow-100' },
  fail:    { Icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-100' },
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 85 ? '#16a34a' : score >= 65 ? '#d97706' : '#dc2626'
  const r = 44, circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#f3f4f6" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${fill} ${circ - fill}`} strokeDashoffset={circ / 4}
        strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s' }} />
      <text x="60" y="55" textAnchor="middle" fontSize="26" fontWeight="700" fill={color}>{score}</text>
      <text x="60" y="72" textAnchor="middle" fontSize="11" fill="#9ca3af">
        {score >= 85 ? 'Tốt' : score >= 65 ? 'Khá' : 'Yếu'}
      </text>
    </svg>
  )
}

function GroupCard({ group }: { group: CheckGroup }) {
  const [open, setOpen] = useState(group.items.some(i => i.status !== 'pass'))
  const passN = group.items.filter(i => i.status === 'pass').length
  const failN = group.items.filter(i => i.status === 'fail').length
  const groupScore = Math.round(group.items.reduce((s, i) => s + (i.status === 'pass' ? 1 : i.status === 'warning' ? 0.5 : 0), 0) / group.items.length * 100)

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
        onClick={() => setOpen(v => !v)}>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{group.name}</span>
            <span className="text-[10px] text-gray-400">×{group.weight}</span>
            <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5',
              groupScore >= 80 ? 'bg-green-100 text-green-700'
              : groupScore >= 60 ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-600')}>
              {groupScore}%
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {passN}/{group.items.length} pass{failN > 0 ? ` · ${failN} cần sửa` : ''}
          </p>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="divide-y border-t">
          {group.items.map(item => {
            const { Icon, color, bg } = STATUS_CFG[item.status]
            const fixText = item.fix || (item.status === 'fail' ? item.note : null)
            return (
              <div key={item.id} className={cn('px-4 py-3', bg)}>
                <div className="flex items-start gap-3">
                  <Icon size={14} className={cn('shrink-0 mt-0.5', color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{item.label}</p>
                    {item.status !== 'fail' && (
                      <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{item.note}</p>
                    )}
                  </div>
                </div>
                {item.status === 'fail' && fixText && (
                  <div className="mt-2 ml-5 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide mb-1">Cách sửa</p>
                    <p className="text-xs text-red-800 leading-relaxed">{fixText}</p>
                  </div>
                )}
                {item.status === 'warning' && (
                  <div className="mt-2 ml-5 bg-yellow-100 border border-yellow-200 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-wide mb-1">Cần kiểm tra</p>
                    <p className="text-xs text-yellow-800 leading-relaxed">{item.note}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Manual checklist items
const MANUAL_ITEMS = [
  { id: 'has-author',   label: 'Tác giả có tên + bio / credentials hiển thị trên trang' },
  { id: 'has-realimg',  label: 'Có ảnh thực tế (không chỉ stock photo) với alt text' },
  { id: 'has-sources',  label: 'Đã dẫn link nguồn cho các claims / số liệu quan trọng' },
  { id: 'no-factual',   label: 'Đã kiểm tra: không có thông tin sai hoặc outdated' },
  { id: 'has-datepub',  label: 'Đã set datePublished & dateModified trong schema JSON-LD' },
  { id: 'url-has-kw',   label: 'URL slug chứa từ khóa chính, ≤5 từ, dùng dấu "-"' },
  { id: 'mobile-ok',    label: 'Đã kiểm tra hiển thị trên mobile (câu ngắn, đoạn ngắn)' },
  { id: 'originality',  label: 'Nội dung gốc <15% trùng lặp (kiểm tra bằng Copyscape / Grammarly)' },
  { id: 'no-ads-block', label: 'Ads / popup không che nội dung chính (trên mobile)' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContentOptimizerPage() {
  const [primaryKw, setPrimaryKw] = useState('')
  const [secondaryKw, setSecondaryKw] = useState('')
  const [pageType, setPageType] = useState('blog')
  const [article, setArticle] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [urlSlug, setUrlSlug] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [manualChecks, setManualChecks] = useState<Record<string, boolean>>({})
  const [fetchUrl, setFetchUrl] = useState('')
  const [fetching, setFetching] = useState(false)

  const urlMode = /^https?:\/\/.+/.test(fetchUrl.trim())

  async function handleAnalyze() {
    if (!primaryKw.trim()) { setError('Vui lòng nhập từ khóa chính'); return }

    let content = article

    if (urlMode && !content.trim()) {
      setFetching(true)
      setError('')
      try {
        const res = await fetch('/api/seo/audit-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: fetchUrl.trim() }),
        })
        const data = await res.json()
        if (!res.ok || data.error) {
          setError('Lỗi fetch URL: ' + (data.error || 'Không lấy được trang'))
          return
        }
        content = data.bodyText?.slice(0, 20000) || ''
        if (data.description && !metaDesc) setMetaDesc(data.description)
        if (data.finalUrl && !urlSlug) {
          try {
            const p = new URL(data.finalUrl).pathname.replace(/^\//, '').replace(/\/$/, '')
            if (p) setUrlSlug(p)
          } catch { /* ignore */ }
        }
        if (!content.trim()) { setError('Không trích xuất được nội dung từ URL — thử paste nội dung thủ công'); return }
      } finally {
        setFetching(false)
      }
    }

    if (!content.trim()) { setError('Vui lòng nhập URL hoặc paste nội dung bài viết'); return }
    if (!urlMode && content.trim().split(/\s+/).length < 50) { setError('Bài viết quá ngắn (cần ít nhất 50 từ)'); return }
    setError('')
    setResult(analyzeContent(content, primaryKw, secondaryKw, pageType, metaDesc, urlSlug))
    setManualChecks({})
  }

  function toggleManual(id: string) {
    setManualChecks(p => ({ ...p, [id]: !p[id] }))
  }

  const manualPassed = Object.values(manualChecks).filter(Boolean).length
  const totalScore = result
    ? Math.round((result.score * 0.75) + (manualPassed / MANUAL_ITEMS.length * 100 * 0.25))
    : 0

  return (
    <div className="p-6 md:p-8 pb-16">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Content Optimizer</h1>
          <p className="text-sm text-gray-500 mt-0.5">59 tiêu chí 2026 — Từ khóa · Semantic · E-E-A-T · HCU · Featured Snippet</p>
        </div>
        {result && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setResult(null); setError('') }}>
            <RotateCcw size={13} />Phân tích lại
          </Button>
        )}
      </div>

      {/* Input form */}
      {!result && (
        <div className="max-w-2xl space-y-4">

          {/* URL input */}
          <div className={cn('border rounded-xl p-4 space-y-2', urlMode ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200')}>
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Globe size={13} />
              Kiểm tra từ URL <span className="font-normal text-gray-400">(tùy chọn)</span>
            </label>
            <Input
              value={fetchUrl}
              onChange={e => setFetchUrl(e.target.value)}
              placeholder="https://example.com/bai-viet-can-kiem-tra"
              className="bg-white text-sm"
            />
            {urlMode && (
              <p className="text-xs text-blue-600">Nhấn &quot;Phân tích SEO&quot; — nội dung sẽ được tải từ URL tự động.</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Từ khóa chính *</label>
              <Input value={primaryKw} onChange={e => setPrimaryKw(e.target.value)} placeholder="vd: tối ưu SEO on-page" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Từ khóa phụ (cách nhau bằng dấu phẩy)</label>
              <Input value={secondaryKw} onChange={e => setSecondaryKw(e.target.value)} placeholder="vd: SEO content, tối ưu nội dung" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Meta description (tùy chọn)</label>
              <Input value={metaDesc} onChange={e => setMetaDesc(e.target.value)} placeholder="Mô tả trang (70–160 ký tự)" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">URL slug (tùy chọn)</label>
              <Input value={urlSlug} onChange={e => setUrlSlug(e.target.value)} placeholder="vd: toi-uu-seo-on-page" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Loại trang</label>
            <div className="flex flex-wrap gap-2">
              {PAGE_TYPES.map(pt => (
                <button key={pt.value} onClick={() => setPageType(pt.value)}
                  className={cn('px-3 py-1.5 text-xs rounded-full border font-medium transition-colors',
                    pageType === pt.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200')}>
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          {!urlMode && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nội dung bài viết *</label>
              <Textarea value={article} onChange={e => setArticle(e.target.value)}
                placeholder={'Paste toàn bộ nội dung. Dùng # H1, ## H2, ### H3, **bold**, - bullet list, 1. numbered list\n\n# Tiêu đề bài (H1)\n## Phần 1 (H2)\nNội dung...\n## Phần 2\n...'}
                className="min-h-[280px] text-sm font-mono" />
              <p className="text-xs text-gray-400 mt-1">
                {article.trim() ? `${article.trim().split(/\s+/).filter(Boolean).length} từ` : 'Tip: format markdown để tool nhận dạng đầy đủ'}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <Button onClick={handleAnalyze} disabled={fetching} className="gap-2 w-full md:w-auto">
            {fetching && <Loader2 size={14} className="animate-spin" />}
            {fetching ? 'Đang tải trang...' : urlMode ? 'Phân tích SEO từ URL' : 'Phân tích SEO (59 tiêu chí)'}
          </Button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Overview */}
          <div className="bg-white rounded-2xl border shadow-sm p-5 flex flex-col md:flex-row gap-5 items-center md:items-start">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <ScoreRing score={totalScore} />
              <p className="text-xs text-gray-400">Điểm tổng</p>
            </div>
            <div className="flex-1 w-full">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{result.passCount}</p>
                  <p className="text-xs text-green-500 mt-0.5">Pass</p>
                </div>
                <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{result.warnCount}</p>
                  <p className="text-xs text-yellow-500 mt-0.5">Warning</p>
                </div>
                <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{result.failCount}</p>
                  <p className="text-xs text-red-500 mt-0.5">Fail</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Điểm tự động: <strong>{result.score}%</strong> ({result.totalItems} tiêu chí) ·
                Checklist thủ công: <strong>{manualPassed}/{MANUAL_ITEMS.length}</strong> · Tổng = 75%×auto + 25%×manual
              </p>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all"
                  style={{ width: `${totalScore}%`, background: totalScore >= 85 ? '#16a34a' : totalScore >= 65 ? '#d97706' : '#dc2626' }} />
              </div>
            </div>
          </div>

          {/* Auto groups */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {result.groups.map(g => <GroupCard key={g.id} group={g} />)}
          </div>

          {/* Manual checklist */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
              <ClipboardList size={14} className="text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-700">Checklist thủ công ({manualPassed}/{MANUAL_ITEMS.length})</h2>
              <span className="text-xs text-gray-400 ml-1">— các mục cần kiểm tra ngoài bài viết</span>
            </div>
            <div className="divide-y">
              {MANUAL_ITEMS.map(item => (
                <label key={item.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={!!manualChecks[item.id]} onChange={() => toggleManual(item.id)}
                    className="mt-0.5 accent-green-600" />
                  <span className={cn('text-sm', manualChecks[item.id] ? 'text-gray-400 line-through' : 'text-gray-700')}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
