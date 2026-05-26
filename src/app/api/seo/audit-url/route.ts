import { NextRequest, NextResponse } from 'next/server'

export interface AuditResult {
  url: string
  finalUrl: string
  redirectHops: number
  title: string
  titleLen: number
  titleStatus: 'short' | 'ok' | 'long'
  description: string
  descLen: number
  descStatus: 'short' | 'ok' | 'long'
  h1s: string[]
  h1Count: number
  h1Status: 'ok' | 'missing' | 'multiple'
  h2Count: number
  h3Count: number
  headingSkip: boolean
  wordCount: number
  wordStatus: 'thin' | 'ok' | 'long'
  images: { total: number; missingAlt: number; shortAlt: number; spamAlt: number }
  internalLinks: number
  externalLinks: number
  canonical: string
  canonicalMatchesFinal: boolean
  viewport: boolean
  ogImage: boolean
  ogImageUrl: string
  ogTitle: string
  ogDescription: string
  twitterTitle: string
  twitterDescription: string
  twitterImageUrl: string
  ogType: string
  jsonLd: boolean
  twitterCard: boolean
  datePublished: boolean
  issues: string[]
  issueCount: number
  slug: string
  bodyText: string
}

function extractMeta(html: string, name: string): string {
  const m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i'))
  return m ? m[1].trim() : ''
}

function stripTags(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function extractMainContent(html: string): string {
  return html
    // Remove non-content blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    // Convert headings → markdown so analyzeContent can detect H1/H2/H3
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `\n# ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `\n## ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n### ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    // Preserve paragraph/list breaks
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${t.replace(/<[^>]+>/g, '').trim()}`)
    // Strip remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode HTML entities — numeric first (Vietnamese chars use &#7875; etc.)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&[a-z]+;/gi, ' ')
    // Normalize whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function countWords(text: string) {
  return text.split(/\s+/).filter(w => w.length > 1).length
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  let finalUrl = url
  let redirectHops = 0
  let html = ''

  try {
    // Track redirects manually
    let currentUrl = url
    for (let i = 0; i < 6; i++) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 12000)
      const res = await fetch(currentUrl, {
        signal: ctrl.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Upgrade-Insecure-Requests': '1',
        },
      })
      clearTimeout(timer)

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location') || ''
        if (!loc) break
        currentUrl = loc.startsWith('http') ? loc : new URL(loc, currentUrl).href
        redirectHops++
      } else {
        finalUrl = currentUrl
        html = await res.text()
        break
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error
      ? (e.cause ? `${e.message} (${e.cause})` : e.message)
      : String(e)
    return NextResponse.json({ error: `Không fetch được: ${msg}` }, { status: 500 })
  }

  if (!html) return NextResponse.json({ error: 'Không nhận được nội dung trang' }, { status: 500 })

  // ── Title ────────────────────────────────────────────────────────────────
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = (titleMatch?.[1] || '').trim()
  const titleLen = title.length
  const titleStatus: AuditResult['titleStatus'] = titleLen < 30 ? 'short' : titleLen > 65 ? 'long' : 'ok'

  // ── Description ──────────────────────────────────────────────────────────
  const description = extractMeta(html, 'description') || extractMeta(html, 'og:description')
  const descLen = description.length
  const descStatus: AuditResult['descStatus'] = descLen < 70 ? 'short' : descLen > 160 ? 'long' : 'ok'

  // ── Headings ─────────────────────────────────────────────────────────────
  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
  const h1s = h1Matches.map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean)
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length
  const h3Count = (html.match(/<h3[\s>]/gi) || []).length
  const h1Count = h1s.length
  const h1Status: AuditResult['h1Status'] = h1Count === 0 ? 'missing' : h1Count > 1 ? 'multiple' : 'ok'
  const headingSkip = h2Count === 0 && h3Count > 0

  // ── Word count ───────────────────────────────────────────────────────────
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i)
  const fullBodyText = stripTags(bodyMatch?.[0] || html)
  const wordCount = countWords(fullBodyText)
  const wordStatus: AuditResult['wordStatus'] = wordCount < 300 ? 'thin' : wordCount > 3000 ? 'long' : 'ok'

  // ── Images ───────────────────────────────────────────────────────────────
  const imgMatches = [...html.matchAll(/<img[^>]+>/gi)]
  const totalImages = imgMatches.length
  let missingAlt = 0, shortAlt = 0, spamAlt = 0
  for (const m of imgMatches) {
    const altMatch = m[0].match(/alt=["']([^"']*)["']/i)
    if (!altMatch) { missingAlt++; continue }
    const alt = altMatch[1].trim()
    if (alt.length === 0) { missingAlt++; continue }
    if (alt.length < 5) shortAlt++
    if (alt.length > 125 || alt.split(/\s+/).length > 15) spamAlt++
  }

  // ── Links ────────────────────────────────────────────────────────────────
  const linkMatches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)]
  const urlObj = new URL(finalUrl)
  let internalLinks = 0, externalLinks = 0
  for (const m of linkMatches) {
    const href = m[1].trim()
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue
    try {
      const hObj = new URL(href, finalUrl)
      if (hObj.hostname === urlObj.hostname) internalLinks++
      else externalLinks++
    } catch { /* skip */ }
  }

  // ── Canonical ────────────────────────────────────────────────────────────
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
  const canonical = canonicalMatch?.[1]?.trim() || ''
  const canonicalMatchesFinal = canonical === finalUrl || canonical === url

  // ── Tech checks ──────────────────────────────────────────────────────────
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html)
  const ogImageUrl = extractMeta(html, 'og:image')
  const ogImage = !!ogImageUrl
  const ogType = extractMeta(html, 'og:type')
  const ogTitle = extractMeta(html, 'og:title') || title
  const ogDescription = extractMeta(html, 'og:description') || description
  const twitterTitle = extractMeta(html, 'twitter:title') || ogTitle
  const twitterDescription = extractMeta(html, 'twitter:description') || ogDescription
  const twitterImageUrl = extractMeta(html, 'twitter:image') || ogImageUrl
  const jsonLd = /<script[^>]+type=["']application\/ld\+json["']/i.test(html)
  const twitterCard = !!extractMeta(html, 'twitter:card')
  const datePublished = /datePublished|date_published|article:published_time/i.test(html)

  // ── Build issues list ────────────────────────────────────────────────────
  const issues: string[] = []
  if (redirectHops > 1) issues.push(`Redirect chain: ${redirectHops} bước (lý tưởng ≤1)`)
  if (titleStatus === 'short') issues.push(`Title quá ngắn (${titleLen} ký tự, cần ≥30)`)
  if (titleStatus === 'long') issues.push(`Title quá dài (${titleLen} ký tự, nên ≤65)`)
  if (!title) issues.push('Thiếu title tag')
  if (descStatus === 'short') issues.push(`Meta description quá ngắn (${descLen} ký tự, cần ≥70)`)
  if (descStatus === 'long') issues.push(`Meta description quá dài (${descLen} ký tự, nên ≤160)`)
  if (!description) issues.push('Thiếu meta description')
  if (h1Status === 'missing') issues.push('Thiếu thẻ H1')
  if (h1Status === 'multiple') issues.push(`Có ${h1Count} thẻ H1, chỉ nên có 1`)
  if (headingSkip) issues.push('Heading nhảy cấp: có H3 nhưng không có H2')
  if (wordStatus === 'thin') issues.push(`Nội dung mỏng (${wordCount} từ, nên ≥300)`)
  if (missingAlt > 0) issues.push(`${missingAlt} ảnh thiếu thuộc tính alt`)
  if (shortAlt > 0) issues.push(`${shortAlt} ảnh alt quá ngắn (<5 ký tự)`)
  if (spamAlt > 0) issues.push(`${spamAlt} ảnh alt có thể spam (>125 ký tự hoặc >15 từ)`)
  if (!canonical) issues.push('Thiếu canonical tag')
  else if (!canonicalMatchesFinal) issues.push(`Canonical trỏ sai URL`)
  if (!viewport) issues.push('Thiếu meta viewport (không mobile-friendly)')
  if (!ogImage) issues.push('Thiếu og:image')
  if (!twitterCard) issues.push('Thiếu meta twitter:card')
  if (!datePublished) issues.push('Không tìm thấy datePublished / dateModified')
  if (redirectHops > 0) issues.push(`${redirectHops} redirect hop`)

  const slug = finalUrl.replace(/https?:\/\//, '').split('?')[0]
  const bodyText = extractMainContent(html)

  return NextResponse.json({
    url, finalUrl, redirectHops,
    title, titleLen, titleStatus,
    description, descLen, descStatus,
    h1s, h1Count, h1Status, h2Count, h3Count, headingSkip,
    wordCount, wordStatus,
    images: { total: totalImages, missingAlt, shortAlt, spamAlt },
    internalLinks, externalLinks,
    canonical, canonicalMatchesFinal,
    viewport, ogImage, ogImageUrl, ogType, ogTitle, ogDescription,
    twitterCard, twitterTitle, twitterDescription, twitterImageUrl,
    jsonLd, datePublished,
    issues, issueCount: issues.length, slug, bodyText,
  } satisfies AuditResult)
}
