'use client'
import { useRef, useState } from 'react'
import { Upload, FileText, Link } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseCsvFile, parseGoogleAdsCsv } from '@/lib/csv-parser'
import { cn } from '@/lib/utils'

interface CsvUploaderProps {
  onData: (rows: Record<string, string>[]) => void
  onSampleLoad?: () => void
  label?: string
  className?: string
}

export function CsvUploader({ onData, onSampleLoad, label = 'Upload CSV', className }: CsvUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [driveUrl, setDriveUrl] = useState('')
  const [tab, setTab] = useState<'file' | 'link'>('file')

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) { setError('Chỉ chấp nhận file .csv'); return }
    setError(''); setLoading(true); setFileName(file.name)
    try {
      const rows = await parseCsvFile(file)
      if (rows.length === 0) { setError('File không có dữ liệu hoặc sai định dạng'); setLoading(false); return }
      onData(rows)
    } catch {
      setError('Không đọc được file. Kiểm tra lại định dạng CSV.')
    } finally { setLoading(false) }
  }

  async function handleDriveLink() {
    if (!driveUrl.trim()) return
    setError(''); setLoading(true)
    try {
      const res = await fetch(`/api/fetch-csv?url=${encodeURIComponent(driveUrl.trim())}`)
      const contentType = res.headers.get('content-type') || ''
      if (!res.ok || contentType.includes('json')) {
        const json = await res.json()
        setError(json.error || 'Không tải được file')
        return
      }
      const text = await res.text()
      const rows = parseGoogleAdsCsv(text)
      if (rows.length === 0) { setError('File không có dữ liệu hoặc sai định dạng'); return }
      setFileName('Google Drive file')
      onData(rows)
    } catch {
      setError('Không tải được file. Kiểm tra lại link.')
    } finally { setLoading(false) }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Tab switcher */}
      <div className="flex rounded-lg border bg-gray-50 p-0.5 text-xs">
        <button
          onClick={() => setTab('file')}
          className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-colors',
            tab === 'file' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
          )}>
          <Upload size={12} />Upload file
        </button>
        <button
          onClick={() => setTab('link')}
          className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-colors',
            tab === 'link' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
          )}>
          <Link size={12} />Google Drive link
        </button>
      </div>

      {tab === 'file' ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => inputRef.current?.click()}
          className={cn('border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
            dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
          )}>
          <Upload className="mx-auto mb-2 text-gray-400" size={28} />
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-xs text-gray-400 mt-1">Kéo thả hoặc click để chọn file .csv từ Google Ads</p>
          {loading && <p className="text-xs text-blue-500 mt-2">Đang phân tích...</p>}
          {fileName && !loading && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-blue-600">
              <FileText size={13} />{fileName}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <p className="text-xs text-gray-500">Dán link Google Sheets hoặc Google Drive (phải được chia sẻ <strong>Anyone with link</strong>)</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={driveUrl}
              onChange={e => setDriveUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDriveLink()}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1 text-xs border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
            />
            <Button size="sm" onClick={handleDriveLink} disabled={loading || !driveUrl.trim()}>
              {loading ? 'Đang tải...' : 'Tải'}
            </Button>
          </div>
          {fileName === 'Google Drive file' && !loading && (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <FileText size={13} />Đã tải file thành công
            </div>
          )}
          <p className="text-[11px] text-gray-400">
            Cách share Sheets: <strong>Share</strong> → <strong>Change to Anyone with link</strong> → Viewer → Copy link
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
      {onSampleLoad && (
        <Button variant="outline" size="sm" onClick={onSampleLoad} className="w-full text-gray-600">
          📂 Tải dữ liệu mẫu để thử
        </Button>
      )}
      <input ref={inputRef} type="file" accept=".csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}
