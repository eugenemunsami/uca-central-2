import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, Briefcase, CalendarDays, Settings, LogOut, Building2, AlertTriangle, Rocket, LifeBuoy,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { Logo } from './ui'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['exco', 'manco', 'consultant'], key: 'dashboard' },
  { to: '/beneficiaries', label: 'Beneficiaries', icon: Users, roles: ['exco', 'manco', 'consultant'], key: 'beneficiaries' },
  { to: '/onboarding', label: 'Onboarding', icon: Rocket, roles: ['exco', 'manco', 'consultant'], key: 'onboarding' },
  { to: '/my-work', label: 'My work', icon: Briefcase, roles: ['exco', 'consultant', 'manco'] },
  { to: '/my-work', label: 'My work', icon: Briefcase, roles: ['external'] },
  { to: '/huddle', label: 'The Huddle', icon: CalendarDays, roles: ['exco', 'manco', 'consultant'], key: 'huddle' },
  { to: '/escalations', label: 'Escalations', icon: AlertTriangle, roles: ['exco', 'manco', 'consultant'], key: 'escalations' },
  { to: '/portal', label: 'Portal', icon: Building2, roles: ['external'], key: 'portal' },
  { to: '/admin', label: 'Admin', icon: Settings, roles: ['exco', 'manco'], key: 'admin' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  const hidden = user.hidden_sections ?? []
  const items = nav.filter(n => n.roles.includes(user.role) && !('key' in n && n.key && hidden.includes(n.key)))

  return (
    <div className="flex min-h-screen bg-ink-900">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-ink-600 bg-ink-800 p-5">
        <div className="mb-8"><Logo small /></div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-lime-soft text-lime' : 'text-white/50 hover:bg-ink-700 hover:text-white'
                }`
              }>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span layoutId="navbar" className="absolute left-0 h-6 w-[3px] rounded-r bg-lime" />
                  )}
                  <Icon size={17} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 border-t border-ink-600 pt-3">
          <NavLink to="/central-hub"
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive ? 'bg-lime-soft text-lime' : 'text-white/50 hover:bg-ink-700 hover:text-white'
              }`
            }>
            <LifeBuoy size={17} />
            Central Hub
          </NavLink>
        </div>
        <div className="mt-3 border-t border-ink-600 pt-4">
          <div className="text-sm text-white">{user.full_name}</div>
          <div className="text-[11px] uppercase tracking-wider text-lime">{user.role}</div>
          <button
            onClick={async () => { await signOut(); navigate('/login') }}
            className="mt-3 flex items-center gap-2 text-xs text-white/40 hover:text-white"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="page-fade flex-1 overflow-x-hidden p-8">{children}</main>
    </div>
  )
}
