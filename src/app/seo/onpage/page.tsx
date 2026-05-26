'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ExternalLink, RotateCcw, Loader2, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, XOctagon, Lightbulb } from 'lucide-react'
import type { AuditResult } from '@/app/api/seo/audit-url/route'

// ── Issue model ───────────────────────────────────────────────────────────────

type Priority = 'critical' | 'warning' | 'ok'
type Category = 'Meta' | 'Nội dung' | 'Kỹ thuật' | 'Social'

interface Issue {
  id: string
  label: string
  priority: Priority
  category: Category
  value?: string
  problem: string
  impact: string
  fix: string[]
}

const CATEGORY_COLOR: Record<Category, string> = {
  Meta: 'bg-purple-50 text-purple-600 border-purple-100',
  'Nội dung': 'bg-blue-50 text-blue-600 border-blue-100',
  'Kỹ thuật': 'bg-orange-50 text-orange-600 border-orange-100',
  Social: 'bg-pink-50 text-pink-600 border-pink-100',
}

function buildIssues(r: AuditResult): Issue[] {
  const issues: Issue[] = []

  // ── META ──────────────────────────────────────────────────────────────────
  if (!r.title) {
    issues.push({
      id: 'title-missing', label: 'Thiếu title tag', priority: 'critical', category: 'Meta',
      problem: 'Trang không có thẻ <title>.',
      impact: 'Google dùng title để hiển thị tiêu đề trên trang kết quả tìm kiếm (SERP). Thiếu title khiến Google tự tạo tiêu đề ngẫu nhiên — thường không tối ưu và làm giảm CTR nghiêm trọng.',
      fix: [
        'Thêm thẻ <title>Từ khoá chính – Tên thương hiệu</title> vào phần <head>.',
        'Đảm bảo mỗi trang có title riêng, không trùng lặp.',
        'Độ dài lý tưởng: 50–65 ký tự để hiển thị đầy đủ trên Google.',
      ],
    })
  } else if (r.titleStatus === 'short') {
    issues.push({
      id: 'title-short', label: 'Title quá ngắn', priority: 'warning', category: 'Meta',
      value: `"${r.title}" (${r.titleLen} ký tự)`,
      problem: `Title chỉ có ${r.titleLen} ký tự — quá ngắn so với khuyến nghị 30–65 ký tự.`,
      impact: 'Title ngắn bỏ lỡ cơ hội chèn từ khoá phụ và không truyền đủ ngữ cảnh cho người dùng lẫn bot Google.',
      fix: [
        'Bổ sung từ khoá mục tiêu vào title nếu chưa có.',
        'Thêm lợi ích hoặc điểm khác biệt: "Dịch vụ X – Nhanh – Uy tín – Toàn quốc".',
        'Kết hợp tên thương hiệu ở cuối: "… | Tên công ty".',
      ],
    })
  } else if (r.titleStatus === 'long') {
    issues.push({
      id: 'title-long', label: 'Title quá dài', priority: 'warning', category: 'Meta',
      value: `"${r.title.slice(0, 60)}…" (${r.titleLen} ký tự)`,
      problem: `Title có ${r.titleLen} ký tự — Google sẽ cắt bớt phần hiển thị sau ~65 ký tự.`,
      impact: 'Nội dung bị cắt làm tiêu đề không rõ ràng trên SERP, giảm CTR và có thể làm mờ từ khoá quan trọng.',
      fix: [
        'Rút ngắn title về ≤65 ký tự.',
        'Ưu tiên từ khoá chính ở đầu câu.',
        'Bỏ các từ thừa như "–", "tại", các cụm không mang giá trị SEO.',
      ],
    })
  } else {
    issues.push({
      id: 'title-ok', label: 'Title tag', priority: 'ok', category: 'Meta',
      value: `"${r.title}" (${r.titleLen} ký tự)`,
      problem: '', impact: '', fix: [],
    })
  }

  if (!r.description) {
    issues.push({
      id: 'desc-missing', label: 'Thiếu meta description', priority: 'critical', category: 'Meta',
      problem: 'Trang không có thẻ meta description.',
      impact: 'Google thường lấy description để hiển thị đoạn mô tả dưới tiêu đề trên SERP. Thiếu meta description khiến Google tự chọn đoạn văn bất kỳ — thường không hấp dẫn và không có từ khoá.',
      fix: [
        'Thêm <meta name="description" content="…"> vào <head>.',
        'Viết 1–2 câu tóm tắt nội dung trang, có chứa từ khoá chính.',
        'Độ dài: 120–155 ký tự để hiển thị đầy đủ trên mobile và desktop.',
        'Kết thúc bằng call-to-action ngắn gọn nếu phù hợp.',
      ],
    })
  } else if (r.descStatus === 'short') {
    issues.push({
      id: 'desc-short', label: 'Meta description quá ngắn', priority: 'warning', category: 'Meta',
      value: `${r.descLen} ký tự`,
      problem: `Description chỉ có ${r.descLen} ký tự — quá ngắn để mô tả đầy đủ nội dung trang.`,
      impact: 'Description ngắn không thu hút người dùng click, và bỏ lỡ cơ hội thêm từ khoá phụ để in đậm trên SERP.',
      fix: [
        'Mở rộng description lên 120–155 ký tự.',
        'Nêu rõ trang nói về gì, ai nên đọc, và lợi ích chính.',
        'Chèn từ khoá phụ một cách tự nhiên.',
      ],
    })
  } else if (r.descStatus === 'long') {
    issues.push({
      id: 'desc-long', label: 'Meta description quá dài', priority: 'warning', category: 'Meta',
      value: `${r.descLen} ký tự`,
      problem: `Description có ${r.descLen} ký tự — phần cuối sẽ bị Google cắt với dấu "…"`,
      impact: 'Phần bị cắt làm mất đi thông tin quan trọng hoặc CTA, ảnh hưởng tới CTR.',
      fix: [
        'Rút ngắn description xuống ≤155 ký tự.',
        'Đặt thông tin quan trọng nhất và CTA ở đầu description.',
      ],
    })
  } else {
    issues.push({
      id: 'desc-ok', label: 'Meta description', priority: 'ok', category: 'Meta',
      value: `${r.descLen} ký tự`,
      problem: '', impact: '', fix: [],
    })
  }

  const canonicalStatus = !r.canonical ? 'missing' : r.canonicalMatchesFinal ? 'ok' : 'mismatch'
  if (canonicalStatus === 'missing') {
    issues.push({
      id: 'canonical-missing', label: 'Thiếu canonical tag', priority: 'critical', category: 'Kỹ thuật',
      problem: 'Trang không có thẻ <link rel="canonical">.',
      impact: 'Khi không có canonical, nếu trang bị truy cập qua nhiều URL (có/không có www, có/không có trailing slash, có query string…) Google xem đó là nội dung trùng lặp, pha loãng PageRank và gây khó khăn cho việc index.',
      fix: [
        'Thêm <link rel="canonical" href="https://domain.com/url-chinh-xac"> vào <head>.',
        'Đảm bảo canonical trỏ đến URL chuẩn (HTTPS, không trailing slash hoặc luôn có trailing slash — nhất quán toàn site).',
        'Kiểm tra plugin SEO (Yoast, RankMath) để bật canonical tự động.',
      ],
    })
  } else if (canonicalStatus === 'mismatch') {
    issues.push({
      id: 'canonical-mismatch', label: 'Canonical trỏ URL khác', priority: 'warning', category: 'Kỹ thuật',
      value: r.canonical,
      problem: `Canonical tag trỏ đến "${r.canonical}" nhưng URL thực tế là "${r.finalUrl}".`,
      impact: 'Google sẽ ưu tiên index URL trong canonical thay vì trang này. Nếu sai, trang có thể không được index hoặc ranking bị phân tán.',
      fix: [
        'Kiểm tra xem canonical có cố ý trỏ đến URL khác không (ví dụ: trang AMP trỏ về desktop).',
        'Nếu không cố ý, cập nhật canonical thành URL hiện tại: ' + r.finalUrl,
        'Đảm bảo không có redirect loop giữa canonical và URL thực tế.',
      ],
    })
  } else {
    issues.push({ id: 'canonical-ok', label: 'Canonical tag', priority: 'ok', category: 'Kỹ thuật', value: r.canonical, problem: '', impact: '', fix: [] })
  }

  if (!r.viewport) {
    issues.push({
      id: 'viewport', label: 'Thiếu meta viewport', priority: 'critical', category: 'Kỹ thuật',
      problem: 'Trang không có thẻ <meta name="viewport">.',
      impact: 'Google dùng mobile-first indexing — trang không có viewport sẽ bị coi là không thân thiện với di động, ảnh hưởng trực tiếp đến thứ hạng. Giao diện cũng sẽ bị vỡ trên điện thoại.',
      fix: [
        'Thêm vào <head>: <meta name="viewport" content="width=device-width, initial-scale=1">',
        'Đây là thẻ bắt buộc cho mọi trang web hiện đại.',
      ],
    })
  } else {
    issues.push({ id: 'viewport-ok', label: 'Meta viewport', priority: 'ok', category: 'Kỹ thuật', problem: '', impact: '', fix: [] })
  }

  // ── CONTENT ───────────────────────────────────────────────────────────────
  if (r.h1Status === 'missing') {
    issues.push({
      id: 'h1-missing', label: 'Thiếu thẻ H1', priority: 'critical', category: 'Nội dung',
      problem: 'Trang không có thẻ H1 nào.',
      impact: 'H1 là tín hiệu quan trọng nhất về chủ đề trang. Thiếu H1 khiến Google khó xác định nội dung chính, ảnh hưởng lớn đến khả năng xếp hạng cho từ khoá mục tiêu.',
      fix: [
        'Thêm đúng 1 thẻ H1 chứa từ khoá chính của trang.',
        'H1 nên là tiêu đề nổi bật nhất trên trang, thường là tên bài viết hoặc dịch vụ.',
        'Không dùng H1 cho logo, tên thương hiệu ở header — chỉ dùng cho tiêu đề nội dung chính.',
      ],
    })
  } else if (r.h1Status === 'multiple') {
    issues.push({
      id: 'h1-multiple', label: `${r.h1Count} thẻ H1 (nên chỉ có 1)`, priority: 'warning', category: 'Nội dung',
      value: r.h1s.slice(0, 3).map(h => `"${h.slice(0, 60)}"${h.length > 60 ? '…' : ''}`).join(' · '),
      problem: `Trang có ${r.h1Count} thẻ H1. Thông lệ chuẩn chỉ dùng 1 H1 duy nhất.`,
      impact: 'Nhiều H1 làm loãng tín hiệu về chủ đề chính, Google sẽ khó xác định từ khoá trọng tâm. Một số CMS (WordPress theme) vô tình tạo H1 thừa ở header.',
      fix: [
        'Giữ lại 1 H1 chứa từ khoá chính của trang.',
        'Đổi các H1 thừa thành H2 hoặc H3.',
        'Kiểm tra theme — một số theme đặt tên site vào H1 header một cách vô tình.',
      ],
    })
  } else {
    issues.push({ id: 'h1-ok', label: 'H1 tag', priority: 'ok', category: 'Nội dung', value: `"${r.h1s[0]?.slice(0, 80) || ''}"`, problem: '', impact: '', fix: [] })
  }

  if (r.headingSkip) {
    issues.push({
      id: 'heading-skip', label: 'Heading nhảy cấp (H3 không có H2)', priority: 'warning', category: 'Nội dung',
      value: `H2: ${r.h2Count}, H3: ${r.h3Count}`,
      problem: 'Trang có thẻ H3 nhưng không có H2 — vi phạm thứ tự heading hợp lệ.',
      impact: 'Cấu trúc heading lộn xộn làm giảm tín hiệu ngữ nghĩa về phân cấp nội dung, ảnh hưởng đến khả năng crawl và độ đọc của trang.',
      fix: [
        'Thêm ít nhất 1 thẻ H2 làm mục cha trước khi dùng H3.',
        'Thứ tự đúng: H1 → H2 → H3, không bỏ cấp.',
        'Dùng H2 để phân chia các phần chính của bài, H3 cho mục con.',
      ],
    })
  } else {
    issues.push({ id: 'heading-ok', label: 'Cấu trúc heading', priority: 'ok', category: 'Nội dung', value: `H2: ${r.h2Count} · H3: ${r.h3Count}`, problem: '', impact: '', fix: [] })
  }

  if (r.wordStatus === 'thin') {
    issues.push({
      id: 'thin-content', label: 'Nội dung mỏng (thin content)', priority: 'warning', category: 'Nội dung',
      value: `${r.wordCount} từ`,
      problem: `Trang chỉ có ${r.wordCount} từ — quá ít để cạnh tranh tốt trên Google.`,
      impact: 'Google đánh giá thấp trang có nội dung mỏng vì không cung cấp đủ giá trị cho người đọc. Điều này đặc biệt ảnh hưởng đến trang dịch vụ, bài viết hướng dẫn, FAQ.',
      fix: [
        'Bổ sung nội dung lên tối thiểu 300–500 từ (trang landing), 800–1500 từ (bài blog/hướng dẫn).',
        'Thêm FAQ, bảng so sánh, ví dụ cụ thể để tăng độ sâu nội dung.',
        'Phân tích top 5 kết quả Google cho từ khoá mục tiêu để biết độ dài cần thiết.',
      ],
    })
  } else {
    issues.push({ id: 'content-ok', label: 'Độ dài nội dung', priority: 'ok', category: 'Nội dung', value: `${r.wordCount.toLocaleString()} từ`, problem: '', impact: '', fix: [] })
  }

  if (r.images.missingAlt > 0) {
    issues.push({
      id: 'alt-missing', label: `${r.images.missingAlt} ảnh thiếu thuộc tính alt`, priority: r.images.missingAlt > 3 ? 'critical' : 'warning', category: 'Nội dung',
      value: `${r.images.total} ảnh tổng, ${r.images.missingAlt} thiếu alt`,
      problem: `${r.images.missingAlt}/${r.images.total} ảnh không có thuộc tính alt text.`,
      impact: 'Alt text giúp Google hiểu nội dung ảnh để index trong Google Images. Thiếu alt cũng ảnh hưởng đến accessibility (người dùng screen reader) và là tín hiệu SEO bị bỏ qua.',
      fix: [
        'Thêm alt text mô tả ngắn gọn nội dung ảnh: <img alt="Quy trình kiểm định thiết bị điện">.',
        'Alt text nên chứa từ khoá liên quan một cách tự nhiên, không nhồi nhét.',
        'Với ảnh trang trí (icon, divider), dùng alt="" để bỏ qua.',
        'Độ dài alt lý tưởng: 5–125 ký tự.',
      ],
    })
  } else {
    issues.push({ id: 'alt-ok', label: 'Alt text ảnh', priority: 'ok', category: 'Nội dung', value: `${r.images.total} ảnh, tất cả có alt`, problem: '', impact: '', fix: [] })
  }

  if (r.internalLinks === 0 && r.wordCount > 100) {
    issues.push({
      id: 'internal-links', label: 'Không có internal link', priority: 'warning', category: 'Nội dung',
      problem: 'Trang không liên kết đến bất kỳ trang nào khác cùng domain.',
      impact: 'Internal link giúp phân phối PageRank trong site, giúp Google crawl sâu hơn, và giữ người dùng ở lại lâu hơn. Thiếu internal link làm trang trở thành "orphan page".',
      fix: [
        'Thêm 2–5 internal link tự nhiên đến các trang liên quan (dịch vụ liên quan, bài viết cùng chủ đề).',
        'Dùng anchor text chứa từ khoá mô tả trang đích, tránh dùng "bấm vào đây", "xem thêm".',
        'Đặt internal link trong phần nội dung chính, không chỉ trong footer/nav.',
      ],
    })
  } else {
    issues.push({ id: 'links-ok', label: 'Internal links', priority: 'ok', category: 'Nội dung', value: `${r.internalLinks} internal · ${r.externalLinks} external`, problem: '', impact: '', fix: [] })
  }

  // ── TECHNICAL ─────────────────────────────────────────────────────────────
  if (r.redirectHops > 1) {
    issues.push({
      id: 'redirect-chain', label: `Redirect chain (${r.redirectHops} bước)`, priority: 'critical', category: 'Kỹ thuật',
      problem: `URL gốc trải qua ${r.redirectHops} lần redirect mới đến trang cuối.`,
      impact: 'Mỗi redirect thêm độ trễ cho người dùng và làm mất một phần link juice (PageRank). Chuỗi redirect dài hơn 2 bước bị Google coi là vấn đề kỹ thuật nghiêm trọng.',
      fix: [
        'Rút ngắn thành redirect thẳng: URL gốc → URL cuối (1 bước duy nhất).',
        'Cập nhật tất cả internal link trỏ thẳng đến URL đích, bỏ qua các URL trung gian.',
        'Kiểm tra .htaccess hoặc cấu hình Nginx để loại bỏ redirect thừa.',
      ],
    })
  } else if (r.redirectHops === 1) {
    issues.push({
      id: 'redirect-1', label: '1 redirect hop', priority: 'warning', category: 'Kỹ thuật',
      value: `${r.url} → ${r.finalUrl}`,
      problem: 'URL gốc redirect 1 lần đến URL cuối.',
      impact: 'Một redirect 301 là bình thường và an toàn. Tuy nhiên nếu có thể truy cập trực tiếp URL đích, nên cập nhật tất cả link trỏ thẳng để tránh độ trễ không cần thiết.',
      fix: [
        'Cập nhật internal link và sitemap dùng URL đích trực tiếp.',
        'Nếu redirect là bắt buộc (www → non-www, HTTP → HTTPS), giữ nguyên là chấp nhận được.',
      ],
    })
  } else {
    issues.push({ id: 'redirect-ok', label: 'Redirect', priority: 'ok', category: 'Kỹ thuật', value: 'Không có redirect', problem: '', impact: '', fix: [] })
  }

  if (!r.jsonLd) {
    issues.push({
      id: 'schema', label: 'Thiếu JSON-LD structured data', priority: 'warning', category: 'Kỹ thuật',
      problem: 'Trang không có schema markup JSON-LD.',
      impact: 'Structured data giúp Google hiểu nội dung sâu hơn và có thể kích hoạt rich results (FAQ accordion, breadcrumb, rating stars) — tăng CTR đáng kể mà không cần cải thiện thứ hạng.',
      fix: [
        'Thêm schema Article (cho bài viết), Service (cho dịch vụ), hoặc FAQPage (cho trang có câu hỏi).',
        'Dùng Schema Generator trong toolkit này để tạo JSON-LD tự động.',
        'Kiểm tra bằng Google Rich Results Test sau khi thêm.',
      ],
    })
  } else {
    issues.push({ id: 'schema-ok', label: 'JSON-LD Schema', priority: 'ok', category: 'Kỹ thuật', problem: '', impact: '', fix: [] })
  }

  if (!r.datePublished) {
    issues.push({
      id: 'date', label: 'Không tìm thấy datePublished', priority: 'warning', category: 'Kỹ thuật',
      problem: 'Trang không đánh dấu ngày xuất bản/cập nhật qua structured data hay Open Graph.',
      impact: 'Thiếu ngày xuất bản khiến Google khó xác định mức độ freshness của nội dung — quan trọng với các từ khoá có yếu tố thời gian (tin tức, quy định mới, hướng dẫn cập nhật).',
      fix: [
        'Thêm "datePublished" và "dateModified" vào schema Article JSON-LD.',
        'Hoặc thêm <meta property="article:published_time" content="2024-01-15">.',
        'Cập nhật "dateModified" mỗi khi chỉnh sửa nội dung đáng kể.',
      ],
    })
  } else {
    issues.push({ id: 'date-ok', label: 'datePublished', priority: 'ok', category: 'Kỹ thuật', problem: '', impact: '', fix: [] })
  }

  // ── SOCIAL ────────────────────────────────────────────────────────────────
  if (!r.ogImage) {
    issues.push({
      id: 'og-image', label: 'Thiếu og:image', priority: 'warning', category: 'Social',
      problem: 'Trang không có thẻ og:image.',
      impact: 'Khi trang được chia sẻ lên Facebook, Zalo, LinkedIn… sẽ không có ảnh preview — làm giảm mạnh tỷ lệ click. Ảnh OG hấp dẫn có thể tăng CTR từ social lên 3–5 lần.',
      fix: [
        'Thêm <meta property="og:image" content="URL_ảnh"> vào <head>.',
        'Kích thước ảnh tối ưu: 1200×630px, dung lượng < 1MB.',
        'Kiểm tra preview bằng công cụ Facebook Sharing Debugger.',
      ],
    })
  } else {
    issues.push({ id: 'og-ok', label: 'og:image', priority: 'ok', category: 'Social', problem: '', impact: '', fix: [] })
  }

  if (!r.twitterCard) {
    issues.push({
      id: 'twitter', label: 'Thiếu meta twitter:card', priority: 'warning', category: 'Social',
      problem: 'Trang không có thẻ meta twitter:card.',
      impact: 'Khi chia sẻ lên Twitter/X, trang sẽ không hiển thị dạng card với ảnh và mô tả — giảm khả năng thu hút click.',
      fix: [
        'Thêm <meta name="twitter:card" content="summary_large_image"> vào <head>.',
        'Bổ sung twitter:title và twitter:description cho đầy đủ.',
        'Nếu đã có og:image, Twitter sẽ dùng ảnh đó nếu không có twitter:image riêng.',
      ],
    })
  } else {
    issues.push({ id: 'twitter-ok', label: 'Twitter Card', priority: 'ok', category: 'Social', problem: '', impact: '', fix: [] })
  }

  return issues
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626'
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#f3f4f6" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${fill} ${circ - fill}`} strokeDashoffset={circ / 4}
        strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x="60" y="56" textAnchor="middle" dominantBaseline="middle"
        fontSize="26" fontWeight="700" fill={color}>{score}</text>
      <text x="60" y="74" textAnchor="middle" fontSize="11" fill="#9ca3af">
        {score >= 80 ? 'Tốt' : score >= 60 ? 'Khá' : 'Yếu'}
      </text>
    </svg>
  )
}

// ── Priority section ──────────────────────────────────────────────────────────
const PRIORITY_CFG = {
  critical: {
    label: 'Lỗi nghiêm trọng',
    bg: 'bg-red-50 border-red-200',
    headBg: 'bg-red-100',
    headText: 'text-red-700',
    icon: <XOctagon size={15} className="text-red-600 shrink-0" />,
  },
  warning: {
    label: 'Cần cải thiện',
    bg: 'bg-yellow-50 border-yellow-200',
    headBg: 'bg-yellow-100',
    headText: 'text-yellow-700',
    icon: <AlertTriangle size={15} className="text-yellow-600 shrink-0" />,
  },
  ok: {
    label: 'Đã ổn',
    bg: 'bg-green-50 border-green-200',
    headBg: 'bg-green-100',
    headText: 'text-green-700',
    icon: <CheckCircle2 size={15} className="text-green-600 shrink-0" />,
  },
}

function IssueCard({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false)
  const cfg = PRIORITY_CFG[issue.priority]
  const isExpandable = issue.priority !== 'ok'
  return (
    <div className={cn('rounded-xl border overflow-hidden', cfg.bg)}>
      <button
        className={cn('w-full flex items-start gap-3 px-4 py-3 text-left', isExpandable ? 'cursor-pointer' : 'cursor-default')}
        onClick={() => isExpandable && setOpen(v => !v)}
      >
        <div className="mt-0.5">{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{issue.label}</span>
            <span className={cn('text-[10px] font-medium border rounded px-1.5 py-0.5', CATEGORY_COLOR[issue.category])}>
              {issue.category}
            </span>
          </div>
          {issue.value && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{issue.value}</p>
          )}
        </div>
        {isExpandable && (
          open ? <ChevronUp size={14} className="text-gray-400 shrink-0 mt-0.5" /> : <ChevronDown size={14} className="text-gray-400 shrink-0 mt-0.5" />
        )}
      </button>

      {open && isExpandable && (
        <div className="px-4 pb-4 space-y-3 border-t border-current/10">
          <div className="pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Vấn đề</p>
            <p className="text-sm text-gray-700 leading-relaxed">{issue.problem}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ảnh hưởng SEO</p>
            <p className="text-sm text-gray-700 leading-relaxed">{issue.impact}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb size={13} className="text-blue-500" />
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Cách xử lý</p>
            </div>
            <ol className="space-y-1.5">
              {issue.fix.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function OnPageAuditPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [fetchError, setFetchError] = useState('')
  const [showPassed, setShowPassed] = useState(false)

  async function handleAudit() {
    if (!url.trim()) { setFetchError('Nhập URL cần kiểm tra'); return }
    let u = url.trim()
    if (!u.startsWith('http')) u = 'https://' + u
    setFetchError('')
    setLoading(true)
    setResult(null)
    setShowPassed(false)
    try {
      const res = await fetch('/api/seo/audit-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setFetchError(data.error || 'Lỗi không xác định'); return }
      setResult(data as AuditResult)
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const issues = result ? buildIssues(result) : []
  const criticals = issues.filter(i => i.priority === 'critical')
  const warnings = issues.filter(i => i.priority === 'warning')
  const passed = issues.filter(i => i.priority === 'ok')
  const score = issues.length > 0
    ? Math.round((passed.length + warnings.length * 0.5) / issues.length * 100)
    : 0

  return (
    <div className="p-6 md:p-8 pb-16">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">SEO On-page Audit</h1>
        <p className="text-sm text-gray-500 mt-0.5">Phân tích chi tiết từng lỗi, ảnh hưởng và cách xử lý cụ thể</p>
      </div>

      {/* URL input */}
      <div className="max-w-2xl flex gap-3 mb-6">
        <Input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && handleAudit()}
          placeholder="https://example.com/bai-viet"
          className="flex-1"
        />
        <Button onClick={handleAudit} disabled={loading} className="gap-1.5 shrink-0">
          {loading ? <><Loader2 size={14} className="animate-spin" />Đang audit…</> : 'Audit'}
        </Button>
        {result && (
          <Button variant="outline" size="icon" onClick={() => { setResult(null); setUrl('') }} title="Làm lại">
            <RotateCcw size={14} />
          </Button>
        )}
      </div>

      {fetchError && (
        <div className="max-w-2xl mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{fetchError}</div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Overview row */}
          <div className="bg-white rounded-2xl border shadow-sm p-5 flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <ScoreRing score={score} />
              <p className="text-xs text-gray-400">SEO Score</p>
            </div>
            <div className="flex-1 w-full">
              <a href={result.finalUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1 break-all mb-3">
                {result.slug} <ExternalLink size={12} />
              </a>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{criticals.length}</p>
                  <p className="text-xs text-red-500 mt-0.5">Lỗi nghiêm trọng</p>
                </div>
                <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{warnings.length}</p>
                  <p className="text-xs text-yellow-500 mt-0.5">Cần cải thiện</p>
                </div>
                <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{passed.length}</p>
                  <p className="text-xs text-green-500 mt-0.5">Đã ổn</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500">
                <span>{result.wordCount.toLocaleString()} từ · {result.h1Count} H1 · {result.h2Count} H2</span>
                <span>{result.images.total} ảnh · {result.internalLinks} internal link</span>
                <span>Redirect: {result.redirectHops} hop</span>
                <span>og:type: {result.ogType || '(không có)'}</span>
              </div>
            </div>
          </div>

          {/* Critical issues */}
          {criticals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <XOctagon size={15} className="text-red-600" />
                <h2 className="text-sm font-bold text-red-700">Lỗi nghiêm trọng ({criticals.length})</h2>
                <span className="text-xs text-red-400">— Xử lý ngay</span>
              </div>
              <div className="space-y-2">
                {criticals.map(i => <IssueCard key={i.id} issue={i} />)}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={15} className="text-yellow-600" />
                <h2 className="text-sm font-bold text-yellow-700">Cần cải thiện ({warnings.length})</h2>
                <span className="text-xs text-yellow-400">— Ưu tiên cao</span>
              </div>
              <div className="space-y-2">
                {warnings.map(i => <IssueCard key={i.id} issue={i} />)}
              </div>
            </div>
          )}

          {/* Passed */}
          {passed.length > 0 && (
            <div>
              <button
                className="flex items-center gap-2 mb-3 group"
                onClick={() => setShowPassed(v => !v)}
              >
                <CheckCircle2 size={15} className="text-green-600" />
                <h2 className="text-sm font-bold text-green-700 group-hover:underline">
                  Đã ổn ({passed.length})
                </h2>
                {showPassed ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
              </button>
              {showPassed && (
                <div className="space-y-2">
                  {passed.map(i => <IssueCard key={i.id} issue={i} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
