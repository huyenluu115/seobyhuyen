import { NextRequest, NextResponse } from 'next/server'

function extractTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'gi')
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) results.push(m[1].trim())
  return results
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    const res = await fetch(url.startsWith('http') ? url : 'https://' + url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)' },
    })
    clearTimeout(timer)
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 200 })

    const xml = await res.text()
    const isIndex = /<sitemapindex/i.test(xml)

    if (isIndex) {
      const sitemaps = extractTags(xml, 'loc')
      const lastmods = extractTags(xml, 'lastmod')
      return NextResponse.json({ type: 'index', sitemaps, lastmods, count: sitemaps.length })
    }

    const locs = extractTags(xml, 'loc')
    const lastmods = extractTags(xml, 'lastmod')
    const changefreqs = extractTags(xml, 'changefreq')
    const priorities = extractTags(xml, 'priority')

    return NextResponse.json({
      type: 'urlset',
      count: locs.length,
      sample: locs.slice(0, 20),
      lastmods: lastmods.slice(0, 20),
      changefreqs: changefreqs.slice(0, 20),
      priorities: priorities.slice(0, 20),
      hasImages: /<image:image/i.test(xml),
      hasVideo: /<video:video/i.test(xml),
      hasNews: /<news:news/i.test(xml),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
