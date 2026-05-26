import { NextRequest, NextResponse } from 'next/server'

export interface UrlStatusResult {
  url: string
  status: number
  finalUrl: string
  redirectHops: number
  time: number
  error?: string
}

export async function POST(req: NextRequest) {
  const { urls } = await req.json() as { urls: string[] }
  if (!Array.isArray(urls) || urls.length === 0) return NextResponse.json({ error: 'Missing urls' }, { status: 400 })
  if (urls.length > 50) return NextResponse.json({ error: 'Tối đa 50 URL mỗi lần' }, { status: 400 })

  const results: UrlStatusResult[] = await Promise.all(urls.map(async (rawUrl): Promise<UrlStatusResult> => {
    const url = rawUrl.trim().startsWith('http') ? rawUrl.trim() : 'https://' + rawUrl.trim()
    const start = Date.now()
    try {
      let current = url
      let hops = 0
      let lastStatus = 0
      for (let i = 0; i < 6; i++) {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 8000)
        const res = await fetch(current, {
          method: 'HEAD',
          redirect: 'manual',
          signal: ctrl.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)' },
        })
        clearTimeout(timer)
        lastStatus = res.status
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location') || ''
          if (!loc) break
          current = loc.startsWith('http') ? loc : new URL(loc, current).href
          hops++
        } else break
      }
      return { url: rawUrl.trim(), status: lastStatus, finalUrl: current, redirectHops: hops, time: Date.now() - start }
    } catch (e) {
      return { url: rawUrl.trim(), status: 0, finalUrl: url, redirectHops: 0, time: Date.now() - start, error: e instanceof Error ? e.message : String(e) }
    }
  }))

  return NextResponse.json({ results })
}
