export type Role = 'ADMIN' | 'PM' | 'DEVELOPER'
export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'
export type TaskStatus = 'TO_DO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_REASSIGNED'
  | 'TASK_IN_REVIEW'
  | 'PROJECT_ASSIGNED'
  | 'PROJECT_REASSIGNED'
  | 'TASK_UPDATED'
  | 'TASK_OVERDUE'
  | 'DUE_DATE_SOON'
export type EntityType = 'TASK' | 'PROJECT'

export type User = {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type SimplePerson = {
  id: string
  name: string
  email?: string
}

export type Client = {
  id: string
  name: string
  contactName: string | null
  contactEmail: string | null
  createdAt: string
  updatedAt: string
}

export type Project = {
  id: string
  name: string
  description: string | null
  category: string | null
  developerInstructions: string | null
  status: ProjectStatus
  clientId: string
  createdById: string
  assignedDeveloperId: string | null
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
  client: Client
  createdBy: SimplePerson
  assignedDeveloper: SimplePerson | null
  _count?: {
    tasks: number
    activities: number
  }
}

export type Task = {
  id: string
  taskNumber: number
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  isOverdue: boolean
  overdueFlaggedAt: string | null
  createdAt: string
  updatedAt: string
  projectId: string
  assignedDeveloperId: string | null
  project: {
    id: string
    name: string
    createdById: string
    client: {
      id: string
      name: string
    }
  }
  assignedDeveloper: SimplePerson | null
  createdBy: SimplePerson | null
  updatedBy: SimplePerson | null
}

export type Activity = {
  id: string
  projectId: string
  taskId: string
  actorUserId: string
  eventType: string
  oldStatus: TaskStatus | null
  newStatus: TaskStatus | null
  actorNameSnapshot: string
  taskTitleSnapshot: string
  message: string
  createdAt: string
  task: {
    taskNumber: number
    assignedDeveloperId: string | null
  }
  project: {
    name: string
    createdById: string
  }
}

export type NotificationItem = {
  id: string
  recipientUserId: string
  type: NotificationType
  title: string
  message: string
  entityType: EntityType
  entityId: string
  isRead: boolean
  readAt: string | null
  createdAt: string
}

export type PaginatedResponse<T> = {
  items: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    unreadCount?: number
  }
}

export type AdminDashboard = {
  totalProjects: number
  tasksByStatus: Record<TaskStatus, number>
  overdueCount: number
  onlineUsers: number
  recentActivity: Activity[]
}

export type PmDashboard = {
  projectSummary: {
    totalProjects: number
  }
  tasksByPriority: Array<{
    priority: TaskPriority
    _count: {
      priority: number
    }
  }>
  upcomingDueDates: Array<
    Task & {
      project: {
        id: string
        name: string
      }
    }
  >
  recentActivity: Activity[]
}

export type DeveloperDashboard = {
  assignedProjects?: Project[]
  assignedTasks: Task[]
  unreadCount: number
  recentActivity: Activity[]
}

export type ApiEnvelope<T> = {
  success: boolean
  data: T
}
