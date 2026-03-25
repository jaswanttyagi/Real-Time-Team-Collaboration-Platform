import type { PropsWithChildren } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { Shell } from './components/ui'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { ClientsPage } from './pages/ClientsPage'
import { DeveloperDashboardPage } from './pages/DeveloperDashboardPage'
import { DeveloperTaskPage } from './pages/DeveloperTaskPage'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PmDashboardPage } from './pages/PmDashboardPage'
import { ProjectDetailsPage } from './pages/ProjectDetailsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { UsersPage } from './pages/UsersPage'
import type { Role } from './types'

const BootSplash = () => (
  <div className="simple-page">
    <div className="panel centered-card">Loading workspace...</div>
  </div>
)

const GuestGate = () => {
  const { isAuthenticated, isBooting } = useAuth()

  if (isBooting) {
    return <BootSplash />
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

const AuthGate = () => {
  const { isAuthenticated, isBooting } = useAuth()

  if (isBooting) {
    return <BootSplash />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <Shell>
      <Outlet />
    </Shell>
  )
}

const RoleGate = ({ roles, children }: PropsWithChildren<{ roles: Role[] }>) => {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/403" replace />
  }

  return <>{children}</>
}

const DashboardSwitch = () => {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === 'ADMIN') {
    return <AdminDashboardPage />
  }

  if (user.role === 'PM') {
    return <PmDashboardPage />
  }

  return <DeveloperDashboardPage />
}

function App() {
  return (
    <Routes>
      <Route element={<GuestGate />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<LoginPage />} />
      </Route>

      <Route element={<AuthGate />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardSwitch />} />
        <Route
          path="/users"
          element={
            <RoleGate roles={['ADMIN']}>
              <UsersPage />
            </RoleGate>
          }
        />
        <Route
          path="/clients"
          element={
            <RoleGate roles={['ADMIN', 'PM']}>
              <ClientsPage />
            </RoleGate>
          }
        />
        <Route
          path="/projects"
          element={
            <RoleGate roles={['ADMIN', 'PM', 'DEVELOPER']}>
              <ProjectsPage />
            </RoleGate>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <RoleGate roles={['ADMIN', 'PM', 'DEVELOPER']}>
              <ProjectDetailsPage />
            </RoleGate>
          }
        />
        <Route
          path="/tasks/me"
          element={
            <RoleGate roles={['DEVELOPER']}>
              <DeveloperDashboardPage />
            </RoleGate>
          }
        />
        <Route
          path="/tasks/:taskId"
          element={
            <RoleGate roles={['DEVELOPER']}>
              <DeveloperTaskPage />
            </RoleGate>
          }
        />
      </Route>

      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
