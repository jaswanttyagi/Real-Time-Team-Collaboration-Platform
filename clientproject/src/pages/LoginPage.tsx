import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getErrorMessage } from '../api'
import { useAuth } from '../auth'

type AuthMode = 'login' | 'signup'

const demoAccounts = [
  {
    label: 'Admin Demo',
    email: 'admin@agency.local',
    password: 'Admin@123',
  },
  {
    label: 'PM Demo',
    email: 'pm1@agency.local',
    password: 'Pm@12345',
  },
  {
    label: 'User Demo',
    email: 'dev1@agency.local',
    password: 'Dev@12345',
  },
]

export const LoginPage = () => {
  const { login, signup, isAuthenticated, isBooting } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
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
        await login({ email, password })
      } else {
        await signup({ name, email, password, role: 'ADMIN' })
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const applyDemoAccount = (account: (typeof demoAccounts)[number]) => {
    setMode('login')
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

          {mode === 'signup' ? (
            <>
              <div className="auth-note">
                Sign up here to create a new admin workspace. After that admin logs in, they can
                add their own clients, PMs, users, projects, and tasks inside that private
                workspace.
              </div>
            </>
          ) : (
            <div className="auth-note">
              Sign in with your email and password. Your saved role decides whether you open the
              admin, project manager, or user workspace.
            </div>
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

          {mode === 'signup' ? (
            <label>
              Account type
              <input type="text" value="Admin workspace" readOnly />
            </label>
          ) : null}

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
            Demo workspace starts with 1 admin, 1 client, 1 PM, and 1 user example. Each admin
            manages their own PMs, users, clients, and projects after login.
          </span>
        </div>
      </section>
    </div>
  )
}
