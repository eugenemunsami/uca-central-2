import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { TOGGLEABLE_SECTIONS, isAggregatorUser } from './lib/types'
import Layout from './components/Layout'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import Dashboard from './pages/Dashboard'
import Beneficiaries from './pages/Beneficiaries'
import BeneficiaryDetail from './pages/BeneficiaryDetail'
import ClientBeneficiaryDetail from './pages/ClientBeneficiaryDetail'
import Onboarding from './pages/Onboarding'
import MyWork from './pages/MyWork'
import Huddle from './pages/Huddle'
import Escalations from './pages/Escalations'
import Admin from './pages/Admin'
import Portal from './pages/Portal'
import ClientWork from './pages/ClientWork'
import CentralHub from './pages/CentralHub'
import Archive2025 from './pages/Archive2025'

export default function App() {
  const { user, loading, recovery } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-white/40">
        Loading UCA Central...
      </div>
    )
  }

  // The invite / reset link lands on /set-password; also force it for a freshly
  // invited (pending) account or an active password-recovery session.
  if (location.pathname === '/set-password' || recovery || (user && user.status === 'pending')) {
    return <SetPassword />
  }

  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>

  if (user.role === 'external') {
    const portalHidden = (user.hidden_sections ?? []).includes('portal')
    const home = portalHidden ? '/my-work' : '/portal'
    // Aggregator-linked externals (e.g. BEE123) also get the Onboarding pipeline and a scoped
    // Beneficiaries section (their own aggregator + its sponsors; a client-safe beneficiary detail).
    const agg = isAggregatorUser(user)
    return (
      <Layout>
        <Routes>
          {!portalHidden && <Route path="/portal" element={<Portal />} />}
          <Route path="/my-work" element={<ClientWork />} />
          <Route path="/central-hub" element={<CentralHub />} />
          <Route path="/archive-2025" element={<Archive2025 />} />
          {agg && <Route path="/" element={<Dashboard />} />}
          {agg && <Route path="/beneficiaries" element={<Beneficiaries />} />}
          {agg && <Route path="/beneficiaries/:id" element={<ClientBeneficiaryDetail />} />}
          {agg && <Route path="/onboarding" element={<Onboarding />} />}
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </Layout>
    )
  }

  // Admin per-user section switches: a hidden section can't be reached directly either.
  const hidden = user.hidden_sections ?? []
  const hiddenPaths = TOGGLEABLE_SECTIONS.filter(s => hidden.includes(s.key)).map(s => s.path)
  if (hiddenPaths.includes(location.pathname)) return <Navigate to="/my-work" replace />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/beneficiaries" element={<Beneficiaries />} />
        <Route path="/beneficiaries/:id" element={<BeneficiaryDetail />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/my-work" element={<MyWork />} />
        <Route path="/huddle" element={<Huddle />} />
        <Route path="/escalations" element={<Escalations />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/central-hub" element={<CentralHub />} />
        <Route path="/archive-2025" element={<Archive2025 />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
