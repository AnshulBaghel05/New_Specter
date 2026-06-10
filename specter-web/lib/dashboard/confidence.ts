// Confidence tier classifier for signal confidence (0–1).
// high >= 0.80, medium 0.50–0.79, low < 0.50.

export type ConfidenceTier = 'high' | 'medium' | 'low'

export function confidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.5) return 'medium'
  return 'low'
}
