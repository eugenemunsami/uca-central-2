// Faint, service-type colour coding for interventions.
// Deliberately subtle: a soft background + slightly stronger border/accent.
// These are NOT the RAG colours — RAG stays as its own green/amber/red dot.

const HUES: Record<string, string> = {
  Branding: '#8B7BE8',
  'Web Development': '#4C93E8',
  'Content Production': '#D579B0',
  'Print & Promotional': '#E08A4C',
  'Social Media Management': '#3FB8C4',
  'Google Ads': '#19A06E',
  'Business Insights': '#6C7BE0',
  Finance: '#6FB84C',
  Compliance: '#8A94A6',
  Coaching: '#E0B44C',
  Custom: '#9A9A9A',
}

const FALLBACK = '#9A9A9A'

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export interface Tint {
  hue: string
  bg: string        // faint fill for the card
  bgActive: string  // slightly stronger when selected
  border: string    // left accent / border
  text: string      // readable label colour on dark bg
}

export function categoryTint(category?: string | null): Tint {
  const key = (category ?? '').startsWith('Custom') ? 'Custom' : (category ?? '')
  const hue = HUES[key] ?? FALLBACK
  const { r, g, b } = hexToRgb(hue)
  return {
    hue,
    bg: `rgba(${r},${g},${b},0.06)`,
    bgActive: `rgba(${r},${g},${b},0.14)`,
    border: `rgba(${r},${g},${b},0.55)`,
    text: `rgba(${r},${g},${b},0.95)`,
  }
}

export function categoryLabelColor(category?: string | null): string {
  return categoryTint(category).text
}
