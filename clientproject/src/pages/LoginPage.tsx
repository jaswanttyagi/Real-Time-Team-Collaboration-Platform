import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getErrorMessage } from '../api'
import { useAuth } from '../auth'
import type { Role } from '../types'

type AuthMode = 'login' | 'signup'

const loginRoleOptions: Array<{ value: Role; label: string; hint: string }> = [
  { value: 'ADMIN', label: 'Admin', hint: 'Agency-wide visibility and management' },
  { value: 'PM', label: 'Project Manager', hint: 'Own projects, tasks, and review alerts' },
  { value: 'DEVELOPER', label: 'User', hint: 'Assigned tasks, status updates, and notifications' },
]

const signupRoleOptions: Array<{ value: Role; label: string; hint: string }> = [
  { value: 'ADMIN', label: 'Admin', hint: 'Create the first admin account for the workspace' },
  { value: 'PM', label: 'Project Manager', hint: 'Create and manage your own projects' },
  { value: 'DEVELOPER', label: 'User', hint: 'Work on assigned tasks as a normal user' },
]

const demoAccounts = [
  {
    label: 'Admin Demo',
    email: 'admin@agency.local',
    password: 'Admin@123',
    role: 'ADMIN' as Role,
  },
  {
    label: 'PM Demo',
    email: 'pm1@agency.local',
    password: 'Pm@12345',
    role: 'PM' as Role,
  },
  {
    label: 'User Demo',
    email: 'dev1@agency.local',
    password: 'Dev@12345',
    role: 'DEVELOPER' as Role,
  },
]

export const LoginPage = () => {
  const { login, signup, isAuthenticated, isBooting } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginRole, setLoginRole] = useState<Role>('ADMIN')
  const [name, setName] = useState('')
  const [signupRole, setSignupRole] = useState<Role>('DEVELOPER')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isBooting && isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError(null)

    if (nextMode === 'login') {
      setName('')
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (mode === 'login') {
        await login({ email, password, role: loginRole })
      } else {
        await signup({ name, email, password, role: signupRole })
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const applyDemoAccount = (account: (typeof demoAccounts)[number]) => {
    setMode('login')
    setLoginRole(account.role)
    setEmail(account.email)
    setPassword(account.password)
    setError(null)
  }

  return (
    <div className="login-page">
      <section className="login-card">
        <div className="login-copy">
          <p className="eyebrow">Technical Assessment Build</p>
          <h1>Real-Time Client Project Dashboard</h1>
          <p>
            Sign in or create an account to manage clients, projects, tasks, live activity, and
            real-time notifications.
          </p>

          <div className="auth-mode-switch" aria-label="Authentication mode">
            <button
              className={mode === 'login' ? 'mode-pill active' : 'mode-pill'}
              onClick={() => switchMode('login')}
              type="button"
            >
              Login
            </button>
            <button
              className={mode === 'signup' ? 'mode-pill active' : 'mode-pill'}
              onClick={() => switchMode('signup')}
              type="button"
            >
              Sign up
            </button>
          </div>

          {mode === 'login' ? (
            <div className="auth-role-grid">
              {loginRoleOptions.map((option) => (
                <button
                  key={option.value}
                  className={loginRole === option.value ? 'role-card active' : 'role-card'}
                  onClick={() => setLoginRole(option.value)}
                  type="button"
                >
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="auth-role-grid compact">
                {signupRoleOptions.map((option) => (
                  <button
                    key={option.value}
                    className={signupRole === option.value ? 'role-card active' : 'role-card'}
                    onClick={() => setSignupRole(option.value)}
                    type="button"
                  >
                    <strong>{option.label}</strong>
                    <span>{option.hint}</span>
                  </button>
                ))}
              </div>
              <div className="auth-note">
                The first admin can sign up here. After that, create additional admins from the
                Users page inside the admin area.
              </div>
            </>
          )}
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          {mode === 'signup' ? (
            <label>
              Full name
              <input value={name} onChange={(event) => setName(event.target.value)} type="text" />
            </label>
          ) : null}

          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              minLength={8}
            />
          </label>

          {mode === 'login' ? (
            <label>
              Login as
              <select
                value={loginRole}
                onChange={(event) => setLoginRole(event.target.value as Role)}
              >
                {loginRoleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Account type
              <select
                value={signupRole}
                onChange={(event) => setSignupRole(event.target.value as Role)}
              >
                {signupRoleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error ? <div className="error-banner">{error}</div> : null}
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? mode === 'login'
                ? 'Signing in...'
                : 'Creating account...'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <div className="seeded-accounts">
          <strong>Demo account examples</strong>
          {demoAccounts.map((account) => (
            <button
              key={account.label}
              className="demo-account-button"
              onClick={() => applyDemoAccount(account)}
              type="button"
            >
              {account.label}: `{account.email}` / `{account.password}`
            </button>
          ))}
          <span className="muted">
            Demo workspace starts with 1 client, 1 PM, and 1 user example. Admin can create more
            users and clients after login.
          </span>
        </div>
      </section>
    </div>
  )
}
