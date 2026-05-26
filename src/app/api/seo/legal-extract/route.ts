import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

function getKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || ''
  return raw.split(',').map(k => k.trim()).filter(Boolean)
}

const PROMPT = `Bạn là chuyên gia phân tích văn bản pháp lý Việt Nam. Đọc toàn bộ văn bản PDF đính kèm và trích xuất các ý chính, điều khoản quan trọng.

Yêu cầu:
- Giữ nguyên thuật ngữ pháp lý, không diễn giải sai
- Ghi rõ số Điều/Khoản tương ứng
- Ưu tiên điều khoản có tác động thực tế (bỏ qua điều khoản hành chính thuần túy)

Trả về JSON theo đúng format sau, không có text thừa:
{
  "document_info": {
    "title": "tên văn bản",
    "type": "Thông tư | Nghị định | Quyết định | Quy định",
    "number": "số hiệu văn bản",
    "issued_by": "cơ quan ban hành",
    "effective_date": "ngày hiệu lực (nếu có)"
  },
  "key_points": [
    {
      "id": 1,
      "article": "Điều X, Khoản Y",
      "content": "nội dung ý chính",
      "importance": "high | medium | low",
      "category": "định nghĩa | quy định | yêu cầu | xử phạt | thủ tục"
    }
  ],
  "summary": "tóm tắt tổng quan văn bản trong 3-5 câu"
}`

export async function POST(req: NextRequest) {
  const keys = getKeys()
  if (!keys.length) return NextResponse.json({ error: 'Chưa cấu hình GEMINI_API_KEYS' }, { status: 500 })

  const formData = await req.formData()
  const file = formData.get('pdf') as File | null
  if (!file) return NextResponse.json({ error: 'Thiếu file PDF' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')

  for (const key of keys) {
    try {
      const res = await fetch(`${GEMINI_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: base64 } },
              { text: PROMPT },
            ],
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
      })

      if (res.status === 429) continue

      if (!res.ok) {
        const err = await res.json()
        return NextResponse.json({ error: err?.error?.message || `HTTP ${res.status}` }, { status: 500 })
      }

      const data = await res.json()
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return NextResponse.json({ error: 'Không parse được response từ AI' }, { status: 500 })
      return NextResponse.json(JSON.parse(jsonMatch[0]))
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Tất cả API key đã hết quota. Thử lại sau.' }, { status: 429 })
}
