import { NextRequest, NextResponse } from 'next/server'

const STOP = new Set([
  'và','của','là','có','trong','cho','với','được','này','các','một','đã','sẽ','đó',
  'về','không','như','khi','họ','ra','để','từ','theo','vào','lên','đến','bởi','tại',
  'bị','hay','thì','mà','nên','nhưng','hoặc','vì','nếu','sau','trước','đây','đi',
  'lại','rất','đều','cũng','vẫn','thế','làm','tôi','bạn','chúng','người','năm',
  'ngày','tháng','ở','trên','dưới','giữa','ngoài','còn','hơn','khoảng','được',
  'the','be','is','are','was','were','have','has','had','do','does','did','will',
  'would','could','should','may','might','must','can','a','an','and','but','or',
  'for','so','at','by','from','in','into','of','on','to','with','that','this',
  'it','he','she','we','you','they','its','their','our','your','not','no','up',
  'out','if','about','who','which','when','where','how','what','than','then',
  'just','been','also','more','his','her','all','as','are','was',
])

function decode(str: string) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
}

function meta(html: string, name: string) {
  const m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i'))
  return m ? m[1].trim() : ''
}

function bodyText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim()
}

function ngrams(text: string) {
  const ws = text.toLowerCase()
    .replace(/[^a-z0-9À-ɏẠ-ỹ\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP.has(w))
  const total = ws.length || 1
  const count = <T extends string>(keys: T[]) => {
    const map = new Map<T, number>()
    for (const k of keys) map.set(k, (map.get(k) || 0) + 1)
    return [...map.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([text, count]) => ({ text, count, density: ((count / total) * 100).toFixed(2) }))
  }
  const uni = ws as string[]
  const bi = ws.slice(0, -1).map((w, i) => `${w} ${ws[i + 1]}`)
  const tri = ws.slice(0, -2).map((w, i) => `${w} ${ws[i + 1]} ${ws[i + 2]}`)
  return { uni: count(uni), bi: count(bi), tri: count(tri), total }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  let finalUrl = url, html = ''
  try {
    let cur = url
    for (let i = 0; i < 6; i++) {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 10000)
      const res = await fetch(cur, {
        signal: ctrl.signal, redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
        },
      })
      clearTimeout(t)
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location') || ''
        if (!loc) break
        cur = loc.startsWith('http') ? loc : new URL(loc, cur).href
      } else { finalUrl = cur; html = await res.text(); break }
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: `Không fetch được: ${e instanceof Error ? e.message : e}` }, { status: 500 })
  }
  if (!html) return NextResponse.json({ error: 'Không nhận được nội dung' }, { status: 500 })

  // Meta — decode HTML entities (&#226; → â, etc.)
  const title = decode((html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim())
  const desc = decode(meta(html, 'description') || meta(html, 'og:description'))
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]?.trim() || ''
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html)
  const metaRobots = meta(html, 'robots')
  const ogTitle = meta(html, 'og:title') || title
  const ogDesc = meta(html, 'og:description') || desc
  const ogImage = meta(html, 'og:image')
  const ogType = meta(html, 'og:type')
  const twitterCard = meta(html, 'twitter:card')

  // Headings H1-H6 in document order
  const headings: { level: number; text: string }[] = []
  const hRaw: { level: number; text: string; idx: number }[] = []
  for (let i = 1; i <= 6; i++) {
    const re = new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null)
      hRaw.push({ level: i, text: decode(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()), idx: m.index })
  }
  hRaw.sort((a, b) => a.idx - b.idx)
  headings.push(...hRaw.map(({ level, text }) => ({ level, text })))

  // Schema JSON-LD
  const schemas: { type: string; raw: object }[] = []
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const obj = JSON.parse(m[1].trim())
      const items = Array.isArray(obj) ? obj : [obj]
      for (const it of items) schemas.push({ type: it['@type'] || 'Unknown', raw: it })
    } catch { /* skip */ }
  }

  // Links
  const urlHost = new URL(finalUrl).hostname
  let internal = 0, external = 0, dofollow = 0, nofollow = 0, ugc = 0, sponsored = 0
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
    const href = m[1].trim()
    if (!href || /^(#|mailto:|tel:|javascript:)/.test(href)) continue
    const rel = (m[0].match(/rel=["']([^"']+)["']/i)?.[1] || '').toLowerCase().split(/[\s,]+/)
    let isExt = false
    try { isExt = new URL(href, finalUrl).hostname !== urlHost } catch { continue }
    if (isExt) external++; else internal++
    if (rel.includes('nofollow')) nofollow++
    if (rel.includes('ugc')) ugc++
    if (rel.includes('sponsored')) sponsored++
    if (!rel.includes('nofollow') && !rel.includes('ugc') && !rel.includes('sponsored')) dofollow++
  }

  // Images — collect src of imgs missing alt for detailed reporting
  const imgs = [...html.matchAll(/<img[^>]+>/gi)]
  const missingAltImgs = imgs
    .filter(m => {
      const a = m[0].match(/alt=["']([^"']*)["']/i)
      return !a || !a[1].trim()
    })
    .map(m => {
      const src = m[0].match(/src=["']([^"']+)["']/i)?.[1] || ''
      try { return src.startsWith('http') ? new URL(src).pathname.split('/').pop() || src : src.split('/').pop() || src }
      catch { return src }
    })
    .filter(Boolean)
    .slice(0, 10)
  const missingAlt = missingAltImgs.length

  // Content analysis
  const bt = bodyText(html)
  const wordCount = bt.split(/\s+/).filter(w => w.length > 1).length
  const sentences = bt.split(/[.!?。！？]+/).filter(s => s.trim().length > 10)
  const sentenceCount = Math.max(sentences.length, 1)
  const avgWPS = Math.round(wordCount / sentenceCount)
  const fleschScore = Math.max(0, Math.min(100, Math.round(122.235 - 1.015 * avgWPS)))
  const readLabel = fleschScore >= 90 ? 'Rất dễ đọc' : fleschScore >= 80 ? 'Dễ đọc' :
    fleschScore >= 70 ? 'Khá dễ đọc' : fleschScore >= 60 ? 'Trung bình' :
    fleschScore >= 50 ? 'Khá khó' : fleschScore >= 30 ? 'Khó đọc' : 'Rất khó đọc'

  const { uni, bi, tri } = ngrams(bt)

  return NextResponse.json({
    url, finalUrl,
    title, titleLen: title.length,
    desc, descLen: desc.length,
    canonical, canonicalOk: !!canonical && (canonical === finalUrl || canonical === url),
    viewport, metaRobots,
    ogTitle, ogDesc, ogImage, ogType, twitterCard,
    headings,
    schemas,
    links: { internal, external, dofollow, nofollow, ugc, sponsored },
    images: { total: imgs.length, missingAlt, missingAltImgs },
    wordCount, sentenceCount, avgWPS, fleschScore, readLabel,
    topUni: uni, topBi: bi, topTri: tri,
  })
}
