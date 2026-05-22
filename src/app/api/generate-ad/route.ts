import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

function getKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || ''
  return raw.split(',').map(k => k.trim()).filter(Boolean)
}

async function callGemini(prompt: string, keys: string[]): Promise<{ data?: Record<string, unknown>; error?: string }> {
  let allDailyExhausted = true
  for (const key of keys) {
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
      }),
    })
    if (res.status === 429) {
      const errBody = await res.json().catch(() => ({}))
      const msg: string = errBody?.error?.message || ''
      // Per-minute rate limit resets quickly; daily quota does not
      if (msg.toLowerCase().includes('per day') || msg.toLowerCase().includes('quota')) {
        continue  // daily quota exhausted for this key
      }
      // Per-minute limit — this key is still valid, just briefly throttled
      allDailyExhausted = false
      continue
    }
    if (!res.ok) {
      const err = await res.json()
      return { error: err?.error?.message || `HTTP ${res.status}` }
    }
    const data = await res.json()
    return { data }
  }
  if (allDailyExhausted) {
    return { error: 'Tất cả API key đã hết quota ngày hôm nay. Quota tự reset lúc 0h (giờ Mỹ) — thử lại vào ngày mai hoặc thêm key mới.' }
  }
  return { error: 'Các API key đang bị rate limit (15 req/phút). Đợi 1 phút rồi thử lại.' }
}

export async function POST(req: NextRequest) {
  const keys = getKeys()
  if (!keys.length) return NextResponse.json({ error: 'Chưa cấu hình GEMINI_API_KEYS trong .env.local' }, { status: 500 })

  const { keyword, url, usp, industry, language } = await req.json()
  if (!keyword) return NextResponse.json({ error: 'Thiếu từ khóa' }, { status: 400 })

  const lang = language === 'en' ? 'English' : 'Vietnamese'
  const prompt = `You are a Google Ads expert. Write a Responsive Search Ad (RSA) in ${lang} for the following:

Keyword: ${keyword}
Landing page URL: ${url || 'not provided'}
Industry: ${industry || 'general'}
Unique selling points (USP): ${usp || 'not provided'}

Rules:
- Write EXACTLY 15 headlines, each MAX 30 characters (including spaces). Count carefully.
- Write EXACTLY 4 descriptions, each MAX 90 characters (including spaces). Count carefully.
- Suggest 2 display URL paths (each max 15 chars, no spaces, lowercase, use hyphens)
- Headlines: include keyword in at least 3, include numbers/stats if possible, include CTAs (e.g. "Liên hệ ngay", "Tư vấn miễn phí"), be specific not generic
- Descriptions: expand on benefits, include CTA, address pain points
- Do NOT add character counts or numbering in the output text itself
- Vary the angles: feature, benefit, social proof, urgency, question

Respond ONLY with valid JSON in this exact format:
{
  "headlines": ["h1", "h2", ..., "h15"],
  "descriptions": ["d1", "d2", "d3", "d4"],
  "urlPaths": ["path1", "path2"],
  "tips": ["tip about this specific ad", "another tip"]
}`

  try {
    const { data, error } = await callGemini(prompt, keys)
    if (error) return NextResponse.json({ error }, { status: 500 })
    const text = (data as Record<string, unknown>)?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const jsonMatch = (text as string).match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Không parse được response từ AI' }, { status: 500 })
    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
