import { useMemo, useState, type ChangeEvent, type PropsWithChildren } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { api, getErrorMessage } from '../api'
import { useAuth } from '../auth'
import { useRealtime } from '../socket'
import type {
  Activity,
  NotificationItem,
  Role,
  Task,
  TaskPriority,
  TaskStatus,
} from '../types'

export const formatLabel = (value: string) =>
  value === 'PM'
    ? 'Project Manager'
    : value === 'DEVELOPER'
      ? 'User'
      : value
          .toLowerCase()
          .replaceAll('_', ' ')
          .replace(/\b\w/g, (character) => character.toUpperCase())

export const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return 'No date'
  }

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export const formatRelativeTime = (value: string) => {
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const diff = new Date(value).getTime() - Date.now()
  const minutes = Math.round(diff / (1000 * 60))

  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, 'minute')
  }

  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) {
    return formatter.format(hours, 'hour')
  }

  const days = Math.round(hours / 24)
  return formatter.format(days, 'day')
}

export const StatusBadge = ({ status }: { status: TaskStatus | string }) => (
  <span className={`pill status-${status.toLowerCase()}`}>{formatLabel(status)}</span>
)

export const PriorityBadge = ({ priority }: { priority: TaskPriority | string }) => (
  <span className={`pill priority-${priority.toLowerCase()}`}>{formatLabel(priority)}</span>
)

export const StatCard = ({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  tone?: 'neutral' | 'warning' | 'accent'
}) => (
  <article className={`stat-card stat-${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </article>
)

export const EmptyState = ({ title, children }: PropsWithChildren<{ title: string }>) => (
  <div className="empty-state">
    <strong>{title}</strong>
    <p>{children}</p>
  </div>
)

export const LoadingState = ({ label = 'Loading...' }: { label?: string }) => (
  <div className="panel muted">{label}</div>
)

export const ErrorState = ({ message }: { message: string }) => (
  <div className="panel error-banner">{message}</div>
)

export const TaskFilters = ({
  filters,
  onChange,
  onReset,
}: {
  filters: { status: string; priority: string; from: string; to: string }
  onChange: (next: Partial<{ status: string; priority: string; from: string; to: string }>) => void
  onReset: () => void
}) => {
  const handleChange =
    (field: 'status' | 'priority' | 'from' | 'to') => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onChange({ [field]: event.target.value })
    }

  return (
    <div className="filter-bar">
      <select value={filters.status} onChange={handleChange('status')}>
        <option value="">All statuses</option>
        <option value="TO_DO">To Do</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="IN_REVIEW">In Review</option>
        <option value="DONE">Done</option>
      </select>
      <select value={filters.priority} onChange={handleChange('priority')}>
        <option value="">All priorities</option>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>
      <input type="date" value={filters.from} onChange={handleChange('from')} />
      <input type="date" value={filters.to} onChange={handleChange('to')} />
      <button className="ghost-button" type="button" onClick={onReset}>
        Clear Filters
      </button>
    </div>
  )
}

const mergeActivityLists = (
  base: Activity[],
  live: Activity[],
  projectId?: string,
  taskId?: string,
  limit = 10,
) => {
  const scopedLive = live.filter((item) => {
    if (projectId && item.projectId !== projectId) {
      return false
    }

    if (taskId && item.taskId !== taskId) {
      return false
    }

    return true
  })

  const map = new Map<string, Activity>()
  for (const item of [...scopedLive, ...base]) {
    map.set(item.id, item)
  }

  return Array.from(map.values())
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit)
}

export const ActivityFeedPanel = ({
  title,
  projectId,
  taskId,
  limit = 10,
}: {
  title: string
  projectId?: string
  taskId?: string
  limit?: number
}) => {
  const { liveActivities } = useRealtime()
  const { data, isLoading, error } = useQuery({
    queryKey: ['activities', projectId ?? 'all', taskId ?? 'all', limit],
    queryFn: () => api.getActivities({ projectId, taskId, page: 1, limit }),
  })

  const items = useMemo(
    () => mergeActivityLists(data?.items ?? [], liveActivities, projectId, taskId, limit),
    [data?.items, limit, liveActivities, projectId, taskId],
  )

  return (
    <aside className="panel activity-panel">
      <div className="panel-header">
        <h3>{title}</h3>
      </div>
      {isLoading ? <LoadingState label="Loading activity..." /> : null}
      {error ? <ErrorState message={getErrorMessage(error)} /> : null}
      {!isLoading && !error && items.length === 0 ? (
        <EmptyState title="No activity yet">Status changes will appear here in real time.</EmptyState>
      ) : null}
      <div className="activity-list">
        {items.map((activity) => (
          <article key={activity.id} className="activity-item">
            <p>{activity.message}</p>
            <span>
              {activity.project.name} | {formatRelativeTime(activity.createdAt)}
            </span>
          </article>
        ))}
      </div>
    </aside>
  )
}

const NotificationDropdown = ({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: NotificationItem[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
}) => (
  <div className="notification-dropdown">
    <div className="notification-toolbar">
      <strong>Notifications</strong>
      <button className="ghost-button" type="button" onClick={onMarkAllRead}>
        Mark all as read
      </button>
    </div>
    <p className="muted">{unreadCount} unread</p>
    <div className="notification-list">
      {notifications.length === 0 ? (
        <EmptyState title="All clear">Assignments, updates, and deadline alerts will appear here.</EmptyState>
      ) : null}
      {notifications.map((notification) => (
        <article
          key={notification.id}
          className={`notification-item ${notification.isRead ? 'read' : 'unread'}`}
        >
          <div>
            <strong>{notification.title}</strong>
            <p>{notification.message}</p>
            <span>{formatRelativeTime(notification.createdAt)}</span>
          </div>
          {!notification.isRead ? (
            <button className="ghost-button" type="button" onClick={() => onMarkRead(notification.id)}>
              Mark read
            </button>
          ) : null}
        </article>
      ))}
    </div>
  </div>
)

export const NotificationBell = () => {
  const queryClient = useQueryClient()
  const { unreadCount: liveUnreadCount } = useRealtime()
  const [open, setOpen] = useState(false)
  const { data } = useQuery({
    queryKey: ['notifications', 'dropdown'],
    queryFn: () => api.getNotifications({ page: 1, limit: 10 }),
  })

  const markOneMutation = useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllMutation = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const unreadCount = liveUnreadCount || data?.meta.unreadCount || 0

  return (
    <div className="notification-wrapper">
      <button className="notification-trigger" type="button" onClick={() => setOpen((value) => !value)}>
        Bell
        {unreadCount > 0 ? <span className="notification-badge">{unreadCount}</span> : null}
      </button>
      {open ? (
        <NotificationDropdown
          notifications={data?.items ?? []}
          unreadCount={unreadCount}
          onMarkRead={(id) => {
            markOneMutation.mutate(id)
          }}
          onMarkAllRead={() => {
            markAllMutation.mutate()
          }}
        />
      ) : null}
    </div>
  )
}

export const Shell = ({ children }: PropsWithChildren) => {
  const { user, logout } = useAuth()
  const location = useLocation()

  const links = useMemo(() => {
    if (!user) {
      return []
    }

    const shared = [
      { to: '/dashboard', label: 'Dashboard', roles: ['ADMIN', 'PM', 'DEVELOPER'] as Role[] },
      { to: '/projects', label: 'Projects', roles: ['ADMIN', 'PM', 'DEVELOPER'] as Role[] },
    ]

    const adminPm = [{ to: '/clients', label: 'Clients', roles: ['ADMIN', 'PM'] as Role[] }]

    const adminOnly = [{ to: '/users', label: 'Users', roles: ['ADMIN'] as Role[] }]
    const developerOnly = [{ to: '/tasks/me', label: 'My Work', roles: ['DEVELOPER'] as Role[] }]

    return [...shared, ...adminPm, ...adminOnly, ...developerOnly].filter((link) =>
      link.roles.includes(user.role),
    )
  }, [user])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/dashboard">
          Client Project
          <span>Real-time agency control room</span>
        </Link>
        <nav className="sidebar-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              to={link.to}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="shell-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Route</p>
            <h1>{location.pathname === '/dashboard' ? 'Dashboard' : formatLabel(location.pathname.replaceAll('/', ' ').trim() || 'dashboard')}</h1>
          </div>
          <div className="topbar-actions">
            <NotificationBell />
            <div className="profile-chip">
              <strong>{user?.name}</strong>
              <span>{user ? formatLabel(user.role) : ''}</span>
            </div>
            <button className="ghost-button" type="button" onClick={() => void logout()}>
              Logout
            </button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}

export const TaskTable = ({
  tasks,
  role,
  onEdit,
  onStatusChange,
}: {
  tasks: Task[]
  role: Role
  onEdit?: (task: Task) => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
}) => (
  <div className="panel table-panel">
    <table className="task-table">
      <thead>
        <tr>
          <th>Task</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Due</th>
          <th>Assigned User</th>
          <th>Project</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id}>
            <td>
              <strong>#{task.taskNumber}</strong> {task.title}
            </td>
            <td>
              <StatusBadge status={task.status} />
            </td>
            <td>
              <PriorityBadge priority={task.priority} />
            </td>
            <td>{task.isOverdue ? <span className="overdue-text">Overdue</span> : formatDate(task.dueDate)}</td>
            <td>{task.assignedDeveloper?.name ?? 'Unassigned'}</td>
            <td>{task.project.name}</td>
            <td>
              <div className="inline-actions">
                {role === 'DEVELOPER' ? (
                  <Link className="ghost-button" to={`/tasks/${task.id}`}>
                    Open
                  </Link>
                ) : (
                  <button className="ghost-button" type="button" onClick={() => onEdit?.(task)}>
                    Edit
                  </button>
                )}
                <select value={task.status} onChange={(event) => onStatusChange(task.id, event.target.value as TaskStatus)}>
                  <option value="TO_DO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="DONE">Done</option>
                </select>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
