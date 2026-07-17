import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Beneficiaries from './pages/Beneficiaries'
import BeneficiaryDetail from './pages/BeneficiaryDetail'
import MyWork from './pages/MyWork'
import Huddle from './pages/Huddle'
import Escalations from './pages/Escalations'
import Admin from './pages/Admin'
import Portal from './pages/Portal'
import ClientWork from './pages/ClientWork'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-white/40">
        Loading UCA Central...
      </div>
    )
  }
  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>

  if (user.role === 'external') {
    return (
      <Layout>
        <Routes>
          <Route path="/portal" element={<Portal />} />
          <Route path="/my-work" element={<ClientWork />} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
      </Layout>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/beneficiaries" element={<Beneficiaries />} />
        <Route path="/beneficiaries/:id" element={<BeneficiaryDetail />} />
        <Route path="/my-work" element={<MyWork />} />
        <Route path="/huddle" element={<Huddle />} />
        <Route path="/escalations" element={<Escalations />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
