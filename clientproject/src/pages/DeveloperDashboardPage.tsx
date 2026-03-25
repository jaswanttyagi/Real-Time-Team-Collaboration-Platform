import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import { api, getErrorMessage } from '../api'
import {
  ActivityFeedPanel,
  EmptyState,
  ErrorState,
  LoadingState,
  StatCard,
  StatusBadge,
  TaskFilters,
  TaskTable,
  formatDate,
} from '../components/ui'
import { useRealtime } from '../socket'
import type { TaskStatus } from '../types'

export const DeveloperDashboardPage = () => {
  const queryClient = useQueryClient()
  const { unreadCount } = useRealtime()
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(
    () => ({
      status: searchParams.get('status') ?? '',
      priority: searchParams.get('priority') ?? '',
      from: searchParams.get('from') ?? '',
      to: searchParams.get('to') ?? '',
    }),
    [searchParams],
  )

  const { data, isLoading, error } = useQuery({
    queryKey: ['tasks', 'developer', filters],
    queryFn: () =>
      api.getTasks({
        status: filters.status as TaskStatus | '',
        priority: filters.priority as '' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        from: filters.from,
        to: filters.to,
        page: 1,
        limit: 20,
      }),
  })

  const projectsQuery = useQuery({
    queryKey: ['projects', 'developer-assigned'],
    queryFn: () => api.getProjects({ page: 1, limit: 20 }),
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      api.updateTaskStatus(taskId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'developer'] })
    },
  })

  if (isLoading || projectsQuery.isLoading) {
    return <LoadingState label="Loading developer dashboard..." />
  }

  if (error || !data || projectsQuery.error || !projectsQuery.data) {
    return <ErrorState message={getErrorMessage(error ?? projectsQuery.error)} />
  }

  const overdueCount = data.items.filter((task) => task.isOverdue).length

  return (
    <div className="page-stack">
      <section className="stats-grid">
        <StatCard label="Assigned Projects" value={projectsQuery.data.items.length} tone="accent" />
        <StatCard label="Assigned Tasks" value={data.items.length} tone="accent" />
        <StatCard label="Unread Alerts" value={unreadCount} />
        <StatCard label="Overdue" value={overdueCount} tone="warning" />
      </section>
      <section className="panel">
        <div className="panel-header">
          <h3>Assigned Projects</h3>
        </div>
        {projectsQuery.data.items.length === 0 ? (
          <EmptyState title="No projects assigned">
            A project manager will assign a project to you, and it will appear here.
          </EmptyState>
        ) : (
          <div className="list-stack">
            {projectsQuery.data.items.map((project) => (
              <article key={project.id} className="project-card">
                <div>
                  <strong>{project.name}</strong>
                  <p>{project.client.name}</p>
                  <StatusBadge status={project.status} />
                  <span>Type: {project.category || 'Not set'}</span>
                  <span>Deadline: {formatDate(project.endDate)}</span>
                </div>
                <Link className="ghost-button" to={`/projects/${project.id}`}>
                  Open project
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
      <TaskFilters
        filters={filters}
        onChange={(next) => {
          const updated = new URLSearchParams(searchParams)
          for (const [key, value] of Object.entries(next)) {
            if (value) {
              updated.set(key, value)
            } else {
              updated.delete(key)
            }
          }
          setSearchParams(updated)
        }}
        onReset={() => {
          setSearchParams(new URLSearchParams())
        }}
      />
      <section className="two-column">
        <TaskTable
          role="DEVELOPER"
          tasks={data.items}
          onStatusChange={(taskId, status) => {
            updateStatusMutation.mutate({ taskId, status })
          }}
        />
        <ActivityFeedPanel title="Task Activity" />
      </section>
    </div>
  )
}
