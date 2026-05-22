import { cn } from '@/lib/utils'
import { SCORE_COLOR, SCORE_LABEL } from '@/lib/constants'

interface ScoreCardProps {
  score: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

function getLevel(score: number): 'good' | 'warning' | 'poor' {
  if (score >= 70) return 'good'
  if (score >= 40) return 'warning'
  return 'poor'
}

export function ScoreCard({ score, showLabel = true, size = 'md' }: ScoreCardProps) {
  const level = getLevel(score)
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : size === 'lg' ? 'text-lg px-4 py-1.5 font-bold' : 'text-sm px-3 py-1'

  return (
    <span className={cn('rounded-full font-semibold inline-flex items-center gap-1', SCORE_COLOR[level], sizeClass)}>
      {score}
      {showLabel && <span className="font-normal opacity-80">/ 100 · {SCORE_LABEL[level]}</span>}
    </span>
  )
}

export function QsBadge({ score }: { score: number }) {
  const level = score >= 7 ? 'good' : score >= 4 ? 'warning' : 'poor'
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-xs font-semibold', SCORE_COLOR[level])}>
      {score}/10
    </span>
  )
}
