import { NextRequest, NextResponse } from 'next/server'
import { anthropic, extractJson } from '@/lib/anthropic'

const SYSTEM_PROMPT = `Bạn là chuyên gia SEO keyword research với 10 năm kinh nghiệm. Nhiệm vụ của bạn là phân tích từ khóa seed và tạo ra bộ từ khóa chiến lược, có cấu trúc rõ ràng, phù hợp với thị trường Việt Nam.

Khi phân tích từ khóa, bạn luôn:
- Phân nhóm theo search intent (Informational / Transactional / Navigational / Commercial)
- Đề xuất từ khóa long-tail có tiềm năng cao
- Gợi ý topic cluster xoay quanh từ khóa chính
- Đánh giá mức độ cạnh tranh: Thấp / Trung bình / Cao
- Trả lời bằng tiếng Việt, rõ ràng, có cấu trúc

Định dạng output luôn theo cấu trúc JSON được chỉ định.`

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Chưa cấu hình ANTHROPIC_API_KEY' }, { status: 500 })

  const { seed_keyword, industry, goal, target_audience } = await req.json()
  if (!seed_keyword) return NextResponse.json({ error: 'Thiếu từ khóa seed' }, { status: 400 })

  const userPrompt = `Hãy nghiên cứu từ khóa cho thông tin sau:

Từ khóa seed: ${seed_keyword}
Lĩnh vực / ngành: ${industry || 'chưa xác định'}
Mục tiêu SEO: ${goal || 'tăng traffic'}
Đối tượng mục tiêu: ${target_audience || 'chưa xác định'}

Yêu cầu output dạng JSON như sau:
{
  "primary_keyword": "từ khóa chính",
  "search_intent": "loại intent",
  "difficulty": "Thấp | Trung bình | Cao",
  "keyword_groups": [
    {
      "intent": "Informational | Transactional | Navigational | Commercial",
      "keywords": [
        {
          "keyword": "từ khóa",
          "difficulty": "Thấp | Trung bình | Cao",
          "note": "ghi chú ngắn về tiềm năng"
        }
      ]
    }
  ],
  "long_tail_keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3", "từ khóa 4", "từ khóa 5"],
  "topic_clusters": [
    {
      "pillar": "chủ đề trụ cột",
      "subtopics": ["chủ đề con 1", "chủ đề con 2", "chủ đề con 3"]
    }
  ],
  "content_ideas": ["ý tưởng bài viết 1", "ý tưởng bài viết 2", "ý tưởng bài viết 3", "ý tưởng bài viết 4", "ý tưởng bài viết 5"]
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
