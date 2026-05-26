import { NextRequest, NextResponse } from 'next/server'
import { anthropic, extractJson } from '@/lib/anthropic'

const SYSTEM_PROMPT = `Bạn là chuyên gia SEO content với kinh nghiệm tối ưu hàng nghìn bài viết. Nhiệm vụ của bạn là đánh giá bài viết theo tiêu chuẩn SEO on-page và đưa ra gợi ý cải thiện cụ thể, actionable.

Khi đánh giá, bạn xem xét:
- Sự xuất hiện và phân bổ của từ khóa mục tiêu
- Cấu trúc heading (H1, H2, H3)
- Độ dài và mật độ từ khóa
- Chất lượng mở bài và kết bài
- Readability (độ dễ đọc)
- CTA (call to action)
- Yếu tố E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)

Trả lời bằng tiếng Việt. Gợi ý phải cụ thể, không chung chung.
Định dạng output theo cấu trúc JSON được chỉ định.`

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Chưa cấu hình ANTHROPIC_API_KEY' }, { status: 500 })

  const { primary_keyword, secondary_keywords, page_type, article_content } = await req.json()
  if (!article_content) return NextResponse.json({ error: 'Thiếu nội dung bài viết' }, { status: 400 })
  if (!primary_keyword) return NextResponse.json({ error: 'Thiếu từ khóa chính' }, { status: 400 })

  const userPrompt = `Hãy phân tích và đánh giá bài viết SEO sau:

Từ khóa chính: ${primary_keyword}
Từ khóa phụ: ${secondary_keywords || 'không có'}
Loại trang: ${page_type || 'blog'}

--- BÀI VIẾT ---
${article_content}
--- HẾT BÀI VIẾT ---

Yêu cầu output dạng JSON như sau:
{
  "overall_score": 85,
  "summary": "nhận xét tổng quan ngắn gọn",
  "checklist": [
    {
      "category": "Từ khóa",
      "items": [
        { "label": "Từ khóa chính trong Title", "status": "pass | warning | fail", "note": "giải thích ngắn" },
        { "label": "Từ khóa chính trong H1", "status": "pass | warning | fail", "note": "giải thích ngắn" },
        { "label": "Từ khóa trong 100 từ đầu", "status": "pass | warning | fail", "note": "giải thích ngắn" },
        { "label": "Mật độ từ khóa (1-3%)", "status": "pass | warning | fail", "note": "giải thích ngắn" },
        { "label": "Từ khóa phụ được đề cập", "status": "pass | warning | fail", "note": "giải thích ngắn" }
      ]
    },
    {
      "category": "Cấu trúc",
      "items": [
        { "label": "Có đúng 1 thẻ H1", "status": "pass | warning | fail", "note": "giải thích ngắn" },
        { "label": "Cấu trúc H2, H3 logic", "status": "pass | warning | fail", "note": "giải thích ngắn" },
        { "label": "Độ dài bài phù hợp", "status": "pass | warning | fail", "note": "giải thích ngắn" }
      ]
    },
    {
      "category": "Nội dung",
      "items": [
        { "label": "Mở bài hấp dẫn, có từ khóa", "status": "pass | warning | fail", "note": "giải thích ngắn" },
        { "label": "Kết bài có tóm tắt / CTA", "status": "pass | warning | fail", "note": "giải thích ngắn" },
        { "label": "Câu văn dễ đọc, không quá dài", "status": "pass | warning | fail", "note": "giải thích ngắn" },
        { "label": "Có yếu tố E-E-A-T", "status": "pass | warning | fail", "note": "giải thích ngắn" }
      ]
    }
  ],
  "improvements": [
    {
      "priority": "high | medium | low",
      "issue": "vấn đề cụ thể",
      "suggestion": "gợi ý cải thiện cụ thể"
    }
  ]
}

Chỉ trả về JSON, không có text thừa.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const data = extractJson(text)
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
