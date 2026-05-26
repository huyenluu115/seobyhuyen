import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  try {
    const origin = new URL(url.startsWith('http') ? url : 'https://' + url).origin
    const robotsUrl = `${origin}/robots.txt`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    const res = await fetch(robotsUrl, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)' },
    })
    clearTimeout(timer)
    if (!res.ok) return NextResponse.json({ error: `Robots.txt trả về ${res.status}`, status: res.status }, { status: 200 })
    const text = await res.text()
    return NextResponse.json({ text, url: robotsUrl, status: res.status })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
