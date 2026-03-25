import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, getErrorMessage } from '../api'
import {
  ActivityFeedPanel,
  EmptyState,
  ErrorState,
  LoadingState,
  StatCard,
  StatusBadge,
  formatDate,
  formatLabel,
} from '../components/ui'

export const PmDashboardPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'pm'],
    queryFn: api.getPmDashboard,
  })
  const projectsQuery = useQuery({
    queryKey: ['projects', 'pm-summary'],
    queryFn: () => api.getProjects({ page: 1, limit: 6 }),
  })

  if (isLoading || projectsQuery.isLoading) {
    return <LoadingState label="Loading PM dashboard..." />
  }

  if (error || !data || projectsQuery.error || !projectsQuery.data) {
    return <ErrorState message={getErrorMessage(error ?? projectsQuery.error)} />
  }

  return (
    <div className="page-stack">
      <section className="stats-grid">
        <StatCard label="My Projects" value={data.projectSummary.totalProjects} tone="accent" />
        <StatCard label="Due This Week" value={data.upcomingDueDates.length} />
        <StatCard
          label="Critical Tasks"
          value={data.tasksByPriority.find((item) => item.priority === 'CRITICAL')?._count.priority ?? 0}
          tone="warning"
        />
      </section>
      <section className="two-column">
        <div className="page-stack">
          <div className="panel">
            <div className="panel-header">
              <h3>Tasks by Priority</h3>
            </div>
            <div className="priority-summary">
              {data.tasksByPriority.map((item) => (
                <div key={item.priority}>
                  <span>{formatLabel(item.priority)}</span>
                  <strong>{item._count.priority}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">
              <h3>Upcoming Due Dates</h3>
            </div>
            <div className="list-stack">
              {data.upcomingDueDates.map((task) => (
                <article key={task.id} className="list-row">
                  <div>
                    <strong>{task.title}</strong>
                    <p>{task.project.name}</p>
                  </div>
                  <span>{formatDate(task.dueDate)}</span>
                </article>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">
              <h3>Assigned Project Progress</h3>
              <Link className="ghost-button" to="/projects">
                Open projects
              </Link>
            </div>
            {projectsQuery.data.items.length === 0 ? (
              <EmptyState title="No projects yet">
                Create a project, assign it to a user, and project progress will appear here.
              </EmptyState>
            ) : (
              <div className="list-stack">
                {projectsQuery.data.items.map((project) => (
                  <article key={project.id} className="list-row">
                    <div>
                      <strong>{project.name}</strong>
                      <p>{project.assignedDeveloper?.name || 'No user assigned yet'}</p>
                    </div>
                    <div className="row-actions">
                      <StatusBadge status={project.status} />
                      <span>{formatDate(project.endDate)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
        <ActivityFeedPanel title="My Project Activity" />
      </section>
    </div>
  )
}
