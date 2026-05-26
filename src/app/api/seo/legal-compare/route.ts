import { NextRequest, NextResponse } from 'next/server'
import { anthropic, extractJson } from '@/lib/anthropic'

const SYSTEM_PROMPT = `Bạn là chuyên gia kiểm duyệt nội dung pháp lý. Nhiệm vụ của bạn là đối chiếu bài viết với danh sách ý chính từ văn bản pháp lý, đánh giá bài viết có đề cập đầy đủ và chính xác không.

Khi đối chiếu, bạn:
- Kiểm tra từng ý chính xem bài viết có đề cập không
- Đánh giá thông tin trong bài có khớp với văn bản gốc không
- Chỉ ra cụ thể đoạn nào trong bài viết liên quan đến ý nào
- Gợi ý bổ sung cụ thể cho từng điểm còn thiếu

Trả lời bằng tiếng Việt. Định dạng output theo cấu trúc JSON được chỉ định.`

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Chưa cấu hình ANTHROPIC_API_KEY' }, { status: 500 })

  const { key_points, article_content } = await req.json()
  if (!key_points || !article_content) {
    return NextResponse.json({ error: 'Thiếu key_points hoặc article_content' }, { status: 400 })
  }

  const userPrompt = `Đây là danh sách ý chính từ văn bản pháp lý:
${JSON.stringify(key_points, null, 2)}

Đây là bài viết cần đối chiếu:
--- BÀI VIẾT ---
${article_content}
--- HẾT BÀI VIẾT ---

Hãy đối chiếu bài viết với từng ý chính và trả về JSON như sau:
{
  "overall_status": "Đầy đủ | Thiếu một số điểm | Thiếu nhiều điểm",
  "coverage_score": 85,
  "comparison": [
    {
      "id": 1,
      "key_point": "nội dung ý chính từ văn bản",
      "status": "covered | partial | missing | incorrect",
      "found_in_article": "trích dẫn đoạn liên quan trong bài (nếu có)",
      "suggestion": "gợi ý bổ sung / sửa nếu thiếu hoặc sai"
    }
  ],
  "missing_points": [
    {
      "id": 1,
      "content": "ý chính bị thiếu",
      "suggested_addition": "gợi ý đoạn văn bổ sung cụ thể"
    }
  ],
  "incorrect_points": [
    {
      "id": 1,
      "content": "thông tin sai trong bài",
      "correct_info": "thông tin đúng theo văn bản pháp lý",
      "article_excerpt": "đoạn bài viết cần sửa"
    }
  ]
}

Chỉ trả về JSON, không có text thừa.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
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
