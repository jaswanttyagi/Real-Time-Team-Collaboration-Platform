import { Link } from 'react-router-dom'

export const ForbiddenPage = () => (
  <div className="simple-page">
    <div className="panel centered-card">
      <p className="eyebrow">403</p>
      <h2>Access denied</h2>
      <p>You do not have permission to open this page.</p>
      <Link className="primary-button" to="/dashboard">
        Go to dashboard
      </Link>
    </div>
  </div>
)
