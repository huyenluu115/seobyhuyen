import { NextRequest, NextResponse } from 'next/server'

function buildDownloadUrl(url: string): string | null {
  // Google Sheets: https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=GID
  const sheetsMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (sheetsMatch) {
    const sheetId = sheetsMatch[1]
    const gidMatch = url.match(/[#&?]gid=(\d+)/)
    const gid = gidMatch ? gidMatch[1] : '0'
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
  }
  // Google Drive file: https://drive.google.com/file/d/FILE_ID/view
  const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (driveMatch) return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`
  // drive.google.com/open?id=FILE_ID
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idMatch) return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`
  return null
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url param' }, { status: 400 })

  const downloadUrl = buildDownloadUrl(url)
  if (!downloadUrl) {
    return NextResponse.json(
      { error: 'Không nhận ra link. Dán link Google Sheets (docs.google.com/spreadsheets/...) hoặc Google Drive.' },
      { status: 400 }
    )
  }

  try {
    const res = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      return NextResponse.json(
        { error: 'File chưa được chia sẻ công khai. Vào Sheets → Share → Anyone with the link → Viewer.' },
        { status: 400 }
      )
    }
    return new NextResponse(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch {
    return NextResponse.json(
      { error: 'Không tải được file. Kiểm tra lại quyền chia sẻ.' },
      { status: 500 }
    )
  }
}
