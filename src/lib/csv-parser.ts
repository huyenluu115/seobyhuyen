import Papa from 'papaparse'

// Remove BOM (U+FEFF) and normalize line endings
function cleanRaw(raw: string): string {
  return raw
    .replace(/﻿/g, '')   // strip BOM wherever it appears
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

export function parseGoogleAdsCsv(raw: string): Record<string, string>[] {
  const cleaned = cleanRaw(raw)
  const lines = cleaned.split('\n').filter(l => l.trim() !== '')

  // Find the header row: must have ≥4 NON-EMPTY fields AND contain a known column keyword
  // Non-empty check prevents matching title rows that Sheets pads with trailing commas e.g. "Báo cáo...,,,,"
  const headerKeywords = ['campaign', 'keyword', 'search term', 'chiến dịch', 'từ khóa', 'cụm từ', 'impressions', 'clicks', 'lượt nhấp', 'lượt hiển thị', 'trạng thái']
  const headerIndex = lines.findIndex(l => {
    const parts = l.split(',').map(p => p.trim().replace(/^"|"$/g, ''))
    const nonEmpty = parts.filter(p => p !== '').length
    const normalized = l.normalize('NFC').toLowerCase()
    return nonEmpty >= 4 && headerKeywords.some(k => normalized.includes(k))
  })
  if (headerIndex === -1) return []

  const csvContent = lines.slice(headerIndex).join('\n')

  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/﻿/g, '').trim().normalize('NFC'),
  })

  if (!result.data.length) return []

  // Build case-insensitive key map from first row
  const sampleRow = result.data[0] as Record<string, string>
  const keyMap: Record<string, string> = {}
  Object.keys(sampleRow).forEach(k => { keyMap[k.toLowerCase()] = k })

  // Find the "main identifier" column name
  const idKey = ['campaign', 'chiến dịch', 'keyword', 'từ khóa', 'search term', 'cụm từ tìm kiếm']
    .map(k => keyMap[k])
    .find(k => k !== undefined)

  return result.data.filter((row) => {
    const r = row as Record<string, string>
    const val = idKey ? (r[idKey] || '').trim() : Object.values(r)[0]?.trim() || ''
    return val !== '' && val.toLowerCase() !== 'total' && val.toLowerCase() !== 'tổng'
  }) as Record<string, string>[]
}

export function parseCsvFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      try {
        const rows = parseGoogleAdsCsv(text)
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

export function exportToCsv(data: Record<string, unknown>[], filename: string) {
  const csv = Papa.unparse(data)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportToTxt(lines: string[], filename: string) {
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
