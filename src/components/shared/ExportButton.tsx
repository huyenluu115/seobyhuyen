'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportToCsv } from '@/lib/csv-parser'

interface ExportButtonProps {
  data: Record<string, unknown>[]
  filename: string
  label?: string
  disabled?: boolean
}

export function ExportButton({ data, filename, label = 'Export CSV', disabled }: ExportButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || data.length === 0}
      onClick={() => exportToCsv(data, filename)}
      className="gap-1.5"
    >
      <Download size={14} />
      {label}
    </Button>
  )
}
