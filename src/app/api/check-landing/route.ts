import { NextRequest, NextResponse } from 'next/server'

interface HtmlAnalysis {
  https: boolean
  title: string | null
  titleLen: number
  titleHasKeyword: boolean
  metaDesc: string | null
  metaDescLen: number
  metaDescHasKeyword: boolean
  h1s: string[]
  h1HasKeyword: boolean
  hasViewport: boolean
  imagesWithoutAlt: number
  totalImages: number
  hasCta: boolean
  ctaWords: string[]
  contentLength: number
  hasSchemaMarkup: boolean
  canonicalUrl: string | null
}

interface SpeedData {
  mobileScore: number
  desktopScore: number
  lcp: string
  fcp: string
  tbt: string
  cls: string
  speedIndex: string
  opportunities: { title: string; savings: string }[]
}

function extractMeta(html: string, name: string): string | null {
  const m = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'))
  return m ? m[1].trim() : null
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function analyzeHtml(url: string, keyword: string): Promise<HtmlAnalysis> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12000)
  const res = await fetch(url, {
    signal: ctrl.signal,
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    },
  })
  clearTimeout(timer)
  const html = await res.text()
  const kw = keyword.toLowerCase()

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : null
  const titleLen = title?.length || 0
  const titleHasKeyword = kw ? (title?.toLowerCase().includes(kw) || false) : true

  // Meta description
  const metaDesc = extractMeta(html, 'description')
  const metaDescLen = metaDesc?.length || 0
  const metaDescHasKeyword = kw ? (metaDesc?.toLowerCase().includes(kw) || false) : true

  // H1s
  const h1Matches = [...html.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi)]
  const h1s = h1Matches.map(m => m[1].trim())
  const h1HasKeyword = kw ? h1s.some(h => h.toLowerCase().includes(kw)) : h1s.length > 0

  // Viewport
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html)

  // Images
  const imgMatches = [...html.matchAll(/<img[^>]+>/gi)]
  const totalImages = imgMatches.length
  const imagesWithoutAlt = imgMatches.filter(m => !/alt=["'][^"']+["']/i.test(m[0])).length

  // CTA detection (Vietnamese + English)
  const ctaKeywords = ['liên hệ', 'mua ngay', 'đăng ký', 'tư vấn', 'dùng thử', 'báo giá', 'nhận ngay',
    'contact', 'buy now', 'get started', 'free trial', 'sign up', 'book now', 'order now']
  const bodyText = stripTags(html).toLowerCase()
  const foundCta = ctaKeywords.filter(c => bodyText.includes(c))
  const hasCta = foundCta.length > 0

  // Schema markup
  const hasSchemaMarkup = /<script[^>]+type=["']application\/ld\+json["']/i.test(html)

  // Canonical
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
  const canonicalUrl = canonicalMatch ? canonicalMatch[1] : null

  return {
    https: url.startsWith('https://'),
    title, titleLen, titleHasKeyword,
    metaDesc, metaDescLen, metaDescHasKeyword,
    h1s, h1HasKeyword,
    hasViewport,
    imagesWithoutAlt, totalImages,
    hasCta, ctaWords: foundCta.slice(0, 3),
    contentLength: bodyText.length,
    hasSchemaMarkup,
    canonicalUrl,
  }
}

async function fetchPageSpeed(url: string, strategy: 'mobile' | 'desktop'): Promise<number | null> {
  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 20000)
    const res = await fetch(apiUrl, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json()
    const score = data?.lighthouseResult?.categories?.performance?.score
    return score !== undefined ? Math.round(score * 100) : null
  } catch { return null }
}

async function fetchPageSpeedFull(url: string): Promise<SpeedData | null> {
  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 25000)
    const res = await fetch(apiUrl, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json()
    const lr = data?.lighthouseResult
    if (!lr) return null
    const audits = lr.audits || {}
    const mobileScore = Math.round((lr.categories?.performance?.score || 0) * 100)
    const opportunities = (lr.categories?.performance?.auditRefs || [])
      .filter((ref: { group?: string }) => ref.group === 'load-opportunities')
      .map((ref: { id: string }) => {
        const a = audits[ref.id]
        return a ? { title: a.title, savings: a.displayValue || '' } : null
      })
      .filter(Boolean)
      .slice(0, 4)
    return {
      mobileScore,
      desktopScore: 0,
      lcp: audits['largest-contentful-paint']?.displayValue || '--',
      fcp: audits['first-contentful-paint']?.displayValue || '--',
      tbt: audits['total-blocking-time']?.displayValue || '--',
      cls: audits['cumulative-layout-shift']?.displayValue || '--',
      speedIndex: audits['speed-index']?.displayValue || '--',
      opportunities,
    }
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  const keyword = req.nextUrl.searchParams.get('keyword') || ''

  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  try { new URL(url) } catch { return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 }) }

  const [htmlResult, speedResult, desktopScore] = await Promise.allSettled([
    analyzeHtml(url, keyword),
    fetchPageSpeedFull(url),
    fetchPageSpeed(url, 'desktop'),
  ])

  const htmlAnalysis = htmlResult.status === 'fulfilled' ? htmlResult.value : null
  const speedData = speedResult.status === 'fulfilled' ? speedResult.value : null
  if (speedData && desktopScore.status === 'fulfilled' && desktopScore.value !== null) {
    speedData.desktopScore = desktopScore.value
  }

  return NextResponse.json({ htmlAnalysis, speedData, error: htmlAnalysis ? null : 'Không fetch được trang. Có thể trang chặn bot.' })
}
