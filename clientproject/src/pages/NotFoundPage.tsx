import { Link } from 'react-router-dom'

export const NotFoundPage = () => (
  <div className="simple-page">
    <div className="panel centered-card">
      <p className="eyebrow">404</p>
      <h2>Page not found</h2>
      <p>The page you tried to open does not exist.</p>
      <Link className="primary-button" to="/dashboard">
        Return to dashboard
      </Link>
    </div>
  </div>
)
