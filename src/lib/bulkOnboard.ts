import * as XLSX from 'xlsx'
import type { Beneficiary, Director, Sponsor } from './types'

// Columns of the standard onboarding sheet. Required = must be present per row.
export const TEMPLATE_COLUMNS: { key: string; label: string; required: boolean; example: string }[] = [
  { key: 'sponsor', label: 'Sponsor / Aggregator', required: true, example: 'BEE123' },
  { key: 'business_name', label: 'Business name', required: true, example: 'Thabo Logistics' },
  { key: 'industry', label: 'Industry', required: true, example: 'Transport & Logistics' },
  { key: 'contact_person', label: 'Primary contact name', required: true, example: 'Thabo Nkosi' },
  { key: 'contact_email', label: 'Primary contact email', required: true, example: 'thabo@thabologistics.co.za' },
  { key: 'contact_phone', label: 'Primary contact phone', required: true, example: '+27 82 445 1200' },
  { key: 'director1_name', label: 'Director 1 name', required: false, example: 'Thabo Nkosi' },
  { key: 'director1_email', label: 'Director 1 email', required: false, example: 'thabo@thabologistics.co.za' },
  { key: 'director1_phone', label: 'Director 1 phone', required: false, example: '+27 82 445 1200' },
  { key: 'director2_name', label: 'Director 2 name', required: false, example: 'Grace Nkosi' },
  { key: 'director2_email', label: 'Director 2 email', required: false, example: 'grace@thabologistics.co.za' },
  { key: 'director2_phone', label: 'Director 2 phone', required: false, example: '+27 83 220 9910' },
  { key: 'director3_name', label: 'Director 3 name', required: false, example: '' },
  { key: 'director3_email', label: 'Director 3 email', required: false, example: '' },
  { key: 'director3_phone', label: 'Director 3 phone', required: false, example: '' },
  { key: 'sow_signed_date', label: 'SOW signed date (YYYY-MM-DD)', required: true, example: '2026-06-15' },
  { key: 'ember360_report_url', label: 'Ember360 report link', required: false, example: 'https://ember360.example/report' },
  { key: 'expected_completion', label: 'Expected completion (YYYY-MM-DD)', required: false, example: '2026-09-01' },
  { key: 'needs_onsite', label: 'Needs on-site (Yes/No)', required: false, example: 'No' },
  { key: 'project_manager_email', label: 'Project manager email', required: false, example: 'rinaldo@uca.co.za' },
]

export function downloadTemplate() {
  const header = TEMPLATE_COLUMNS.map(c => c.label)
  const example = TEMPLATE_COLUMNS.map(c => c.example)
  const ws = XLSX.utils.aoa_to_sheet([header, example])
  ws['!cols'] = TEMPLATE_COLUMNS.map(() => ({ wch: 24 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Beneficiaries')
  XLSX.writeFile(wb, 'UCA_onboarding_template.xlsx')
}

export interface ParsedRow {
  row: number
  data: Partial<Beneficiary> & { name: string; sponsor_id: string }
  sponsorText: string
  pmEmail?: string
  errors: string[]
}

// map a header label back to its key (tolerant of case / spacing)
function keyFor(label: string): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const found = TEMPLATE_COLUMNS.find(c => norm(c.label) === norm(label) || norm(c.key) === norm(label))
  return found?.key ?? null
}

function asDate(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10)
}

export async function parseWorkbook(file: File, sponsors: Sponsor[]): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  return raw.map((r, i) => {
    const rec: Record<string, unknown> = {}
    Object.entries(r).forEach(([label, val]) => {
      const k = keyFor(label)
      if (k) rec[k] = val
    })

    const errors: string[] = []
    const val = (k: string) => String(rec[k] ?? '').trim()

    const sponsorText = val('sponsor')
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    const sponsor = sponsors.find(c => norm(c.name) === norm(sponsorText))

    TEMPLATE_COLUMNS.filter(c => c.required).forEach(c => {
      if (!val(c.key)) errors.push(`Missing ${c.label}`)
    })
    if (sponsorText && !sponsor) errors.push(`Unknown sponsor/aggregator "${sponsorText}"`)

    const directors: Director[] = []
    ;[1, 2, 3].forEach(n => {
      const name = val(`director${n}_name`)
      if (name) directors.push({
        name, email: val(`director${n}_email`) || null, phone: val(`director${n}_phone`) || null,
      })
    })

    return {
      row: i + 2,
      sponsorText,
      pmEmail: val('project_manager_email') || undefined,
      errors,
      data: {
        name: val('business_name'),
        sponsor_id: sponsor?.id ?? '',
        industry: val('industry') || null,
        contact_person: val('contact_person') || null,
        contact_email: val('contact_email') || null,
        contact_phone: val('contact_phone') || null,
        directors,
        sow_signed_date: asDate(rec['sow_signed_date']),
        ember360_report_url: val('ember360_report_url') || null,
        expected_completion: asDate(rec['expected_completion']),
        needs_onsite: /^y/i.test(val('needs_onsite')),
        stage: 'implementation',
      },
    }
  })
}
