import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Rag } from '../lib/types'
import { RAG_HEX, RAG_LABEL } from '../lib/rag'

export function Logo({ small }: { small?: boolean }) {
  const [errored, setErrored] = useState(false)

  // Fallback text wordmark (used if the bundled PNG ever fails to load).
  if (errored) {
    return (
      <div className="flex items-center gap-2">
        <span className={`display text-white ${small ? 'text-lg' : 'text-2xl'}`}>UCA</span>
        <span className="block h-[3px] w-7 bg-lime slash" />
        {!small && <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">Central</span>}
      </div>
    )
  }

  return (
    <img
      src="/uca-logo.png"
      alt="UCA Central"
      draggable={false}
      onError={() => setErrored(true)}
      className={`w-auto select-none ${small ? 'h-7' : 'h-11'}`}
    />
  )
}

export function RagDot({ rag, pulse }: { rag: Rag; pulse?: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${pulse && rag === 'red' ? 'animate-pulse-ring' : ''}`}
      style={{ background: RAG_HEX[rag] }}
      aria-label={RAG_LABEL[rag]}
    />
  )
}

export function RagPill({ rag, reason }: { rag: Rag; reason?: string | null }) {
  const hex = RAG_HEX[rag]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: `${hex}1f`, color: hex }}
      title={reason ?? undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: hex }} />
      {RAG_LABEL[rag]}
    </span>
  )
}

export function StatCard({
  label, value, sub, accent = '#9FD150', icon, delay = 0,
}: { label: string; value: ReactNode; sub?: string; accent?: string; icon?: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="card card-hover p-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="label">{label}</div>
          <div className="display mt-2 text-3xl" style={{ color: accent }}>{value}</div>
          {sub && <div className="mt-1 text-xs text-white/40">{sub}</div>}
        </div>
        {icon && <div className="opacity-40" style={{ color: accent }}>{icon}</div>}
      </div>
    </motion.div>
  )
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`card my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} p-6`}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg text-white">{title}</h2>
              <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mb-4 block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-white/30">{hint}</span>}
    </label>
  )
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-500 p-8 text-center text-sm text-white/30">
      {text}
    </div>
  )
}

export function timeAgo(iso?: string | null) {
  if (!iso) return 'never'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'last week'
  return `${Math.floor(days / 7)} weeks ago`
}

export function fmtDate(iso?: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}
