import type { BeneficiaryView, Comm, InterventionView, Profile, WeeklyUpdate } from './types'

const esc = (s?: string | null) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const fmtDT = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const CHANNEL: Record<string, string> = {
  call: 'Call', email: 'Email', meeting: 'Meeting', whatsapp: 'WhatsApp', site_visit: 'Site visit',
}

/**
 * Opens a print-ready window with the full evidence pack for a beneficiary:
 * every intervention's weekly updates plus the communication log. The user
 * prints it to PDF from the browser dialog. Works in demo and live mode.
 */
export function openEvidencePack(
  beneficiary: BeneficiaryView,
  interventions: InterventionView[],
  updates: WeeklyUpdate[],
  comms: Comm[],
  people: Profile[],
) {
  const who = (id?: string | null) => people.find(p => p.id === id)?.full_name ?? 'UCA'

  const ivBlocks = interventions.map(iv => {
    const rows = updates
      .filter(u => u.intervention_id === iv.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(u => `
        <div class="upd">
          <div class="upd-h">${fmt(u.created_at)} · ${esc(who(u.author_id))}</div>
          <table class="kv">
            ${u.completed_work ? `<tr><th>Completed</th><td>${esc(u.completed_work)}</td></tr>` : ''}
            ${u.in_progress ? `<tr><th>In progress</th><td>${esc(u.in_progress)}</td></tr>` : ''}
            ${u.blocker ? `<tr><th>Blocker</th><td>${esc(u.blocker)}</td></tr>` : ''}
            ${u.blocker_owner ? `<tr><th>Blocker owner</th><td>${esc(u.blocker_owner)}</td></tr>` : ''}
            ${u.next_action ? `<tr><th>Next action</th><td>${esc(u.next_action)}</td></tr>` : ''}
            ${u.next_update_due ? `<tr><th>Next update</th><td>${fmt(u.next_update_due)}</td></tr>` : ''}
          </table>
        </div>`).join('')
    return `
      <section class="iv">
        <h3>${esc(iv.title)} <span class="cat">${esc(iv.category)}</span></h3>
        <div class="meta">Consultant: ${esc(iv.consultant_name ?? 'unassigned')} · Status: ${esc(iv.status)} · Due: ${fmt(iv.due_date)}</div>
        ${rows || '<div class="empty">No updates logged.</div>'}
      </section>`
  }).join('')

  const commRows = comms
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .map(c => `
      <tr>
        <td>${fmtDT(c.occurred_at)}</td>
        <td>${CHANNEL[c.channel] ?? c.channel}</td>
        <td>${esc(who(c.author_id))}</td>
        <td>${esc(c.context)}${c.email_text ? `<div class="mail">Written follow-up:<br>${esc(c.email_text)}</div>` : ''}</td>
      </tr>`).join('')

  const html = `<!doctype html><html><head><meta charset="utf-8">
    <title>Evidence pack — ${esc(beneficiary.name)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 32px; line-height: 1.5; }
      .bar { height: 6px; background: #9FD150; margin-bottom: 18px; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      h2 { font-size: 15px; margin: 28px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
      h3 { font-size: 14px; margin: 0 0 4px; }
      .sub { color: #555; font-size: 12px; margin-bottom: 4px; }
      .cat { color: #777; font-weight: normal; font-size: 11px; }
      .meta { color: #555; font-size: 11px; margin-bottom: 8px; }
      .iv { margin: 14px 0; padding: 12px 14px; border: 1px solid #e2e2e2; border-radius: 8px; page-break-inside: avoid; }
      .upd { border-left: 3px solid #19A06E; padding-left: 10px; margin: 8px 0; }
      .upd-h { font-size: 11px; color: #666; margin-bottom: 3px; }
      table.kv { border-collapse: collapse; width: 100%; font-size: 12px; }
      table.kv th { text-align: left; color: #666; font-weight: normal; width: 120px; vertical-align: top; padding: 1px 8px 1px 0; }
      table.log { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 6px; }
      table.log th { background: #f4f4f2; text-align: left; padding: 6px 8px; font-size: 11px; }
      table.log td { border-top: 1px solid #eee; padding: 6px 8px; vertical-align: top; }
      .mail { margin-top: 4px; padding: 6px 8px; background: #f7f7f5; border-radius: 4px; color: #444; font-size: 11px; }
      .empty { color: #999; font-size: 12px; }
      .foot { margin-top: 30px; color: #999; font-size: 10px; border-top: 1px solid #eee; padding-top: 8px; }
      @media print { body { margin: 14mm; } }
    </style></head><body>
    <div class="bar"></div>
    <h1>Evidence pack — ${esc(beneficiary.name)}</h1>
    <div class="sub">${esc(beneficiary.industry ?? '')} · ${esc(beneficiary.client_name)}${beneficiary.sponsor_name ? ' · ' + esc(beneficiary.sponsor_name) : ''}</div>
    <div class="sub">SOW signed ${fmt(beneficiary.sow_signed_date)} · Project manager ${esc(beneficiary.pm_name ?? 'unassigned')} · Generated ${fmt(new Date().toISOString())}</div>
    <h2>Interventions &amp; update history</h2>
    ${ivBlocks || '<div class="empty">No interventions.</div>'}
    <h2>Communication log</h2>
    <table class="log">
      <thead><tr><th>Date &amp; time</th><th>Channel</th><th>Logged by</th><th>Context</th></tr></thead>
      <tbody>${commRows || '<tr><td colspan="4" class="empty">No communications logged.</td></tr>'}</tbody>
    </table>
    <div class="foot">UCA Central — generated for internal record and client reporting. Contains proof of work and effort trail.</div>
    <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
    </body></html>`

  const w = window.open('', '_blank')
  if (!w) { alert('Please allow pop-ups to generate the evidence pack.'); return }
  w.document.open(); w.document.write(html); w.document.close()
}
