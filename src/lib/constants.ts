export const THRESHOLDS = {
  ctr: { good: 5, warning: 2 },
  convRate: { good: 3, warning: 1 },
  qualityScore: { good: 7, warning: 4 },
  impressionShare: { good: 60, warning: 30 },
}

export const SCORE_COLOR = {
  good: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  poor: 'bg-red-100 text-red-800',
}

export const SCORE_LABEL = {
  good: 'Tốt',
  warning: 'Cần cải thiện',
  poor: 'Kém',
}
