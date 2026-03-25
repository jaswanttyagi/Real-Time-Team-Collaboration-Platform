import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, getErrorMessage } from '../api'
import {
  ActivityFeedPanel,
  ErrorState,
  LoadingState,
  StatCard,
  StatusBadge,
  formatLabel,
} from '../components/ui'
import { useRealtime } from '../socket'

export const AdminDashboardPage = () => {
  const { onlineUsers } = useRealtime()
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: api.getAdminDashboard,
  })
  const usersQuery = useQuery({
    queryKey: ['users', 'admin-summary'],
    queryFn: () => api.getUsers({ page: 1, limit: 4 }),
  })
  const clientsQuery = useQuery({
    queryKey: ['clients', 'admin-summary'],
    queryFn: () => api.getClients({ page: 1, limit: 4 }),
  })
  const projectsQuery = useQuery({
    queryKey: ['projects', 'admin-summary'],
    queryFn: () => api.getProjects({ page: 1, limit: 4 }),
  })

  if (isLoading) {
    return <LoadingState label="Loading admin dashboard..." />
  }

  if (error || !data) {
    return <ErrorState message={getErrorMessage(error)} />
  }

  return (
    <div className="page-stack">
      <section className="stats-grid">
        <StatCard label="Total Projects" value={data.totalProjects} tone="accent" />
        <StatCard label="Overdue Tasks" value={data.overdueCount} tone="warning" />
        <StatCard label="Online Users" value={onlineUsers ?? data.onlineUsers} />
        <StatCard label="In Review" value={data.tasksByStatus.IN_REVIEW} />
      </section>

      <section className="two-column">
        <div className="panel">
          <div className="panel-header">
            <h3>Status Overview</h3>
          </div>
          <div className="status-grid">
            <div>
              <span>To Do</span>
              <strong>{data.tasksByStatus.TO_DO}</strong>
            </div>
            <div>
              <span>In Progress</span>
              <strong>{data.tasksByStatus.IN_PROGRESS}</strong>
            </div>
            <div>
              <span>In Review</span>
              <strong>{data.tasksByStatus.IN_REVIEW}</strong>
            </div>
            <div>
              <span>Done</span>
              <strong>{data.tasksByStatus.DONE}</strong>
            </div>
          </div>
        </div>
        <ActivityFeedPanel title="Live Agency Activity" />
      </section>

      <section className="management-grid">
        <div className="panel management-card">
          <div className="panel-header">
            <h3>User Management</h3>
            <Link className="ghost-button" to="/users">
              Open users
            </Link>
          </div>
          <strong className="management-count">{usersQuery.data?.meta.total ?? 0}</strong>
          <span className="muted">
            Create users, assign Admin or PM or User roles, activate or deactivate accounts, and
            view the full team list.
          </span>
          <div className="management-list">
            {(usersQuery.data?.items ?? []).map((user) => (
              <div key={user.id} className="list-row compact-row">
                <div>
                  <strong>{user.name}</strong>
                  <p>{formatLabel(user.role)}</p>
                </div>
                <span>{user.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel management-card">
          <div className="panel-header">
            <h3>Client Management</h3>
            <Link className="ghost-button" to="/clients">
              Open clients
            </Link>
          </div>
          <strong className="management-count">{clientsQuery.data?.meta.total ?? 0}</strong>
          <span className="muted">
            Create, update, delete, and review every client record from one admin area.
          </span>
          <div className="management-list">
            {(clientsQuery.data?.items ?? []).map((client) => (
              <div key={client.id} className="list-row compact-row">
                <div>
                  <strong>{client.name}</strong>
                  <p>{client.contactName || 'No contact yet'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel management-card">
          <div className="panel-header">
            <h3>Project Management</h3>
            <Link className="ghost-button" to="/projects">
              Open projects
            </Link>
          </div>
          <strong className="management-count">{projectsQuery.data?.meta.total ?? 0}</strong>
          <span className="muted">
            Create projects, assign a PM, view every project, and update project details and
            status.
          </span>
          <div className="management-list">
            {(projectsQuery.data?.items ?? []).map((project) => (
              <div key={project.id} className="list-row compact-row">
                <div>
                  <strong>{project.name}</strong>
                  <p>
                    PM: {project.createdBy.name}
                    <br />
                    User: {project.assignedDeveloper?.name || 'Unassigned'}
                  </p>
                </div>
                <StatusBadge status={project.status} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
