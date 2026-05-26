import { NextRequest, NextResponse } from 'next/server'

function extractMeta(html: string, name: string): string {
  const m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i'))
  return m ? m[1].trim() : ''
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 })
  }

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SchemaBot/1.0)' },
    })
    clearTimeout(timer)
    const html = await res.text()

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = (extractMeta(html, 'og:title') || titleMatch?.[1] || '').trim()
    const description = (extractMeta(html, 'og:description') || extractMeta(html, 'description') || '').trim()
    const image = extractMeta(html, 'og:image').trim()

    return NextResponse.json({ title, description, image })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
