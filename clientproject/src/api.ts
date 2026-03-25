import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import type {
  Activity,
  AdminDashboard,
  ApiEnvelope,
  Client,
  DeveloperDashboard,
  NotificationItem,
  PaginatedResponse,
  PmDashboard,
  Project,
  Role,
  Task,
  TaskPriority,
  TaskStatus,
  User,
} from './types'

const apiBaseURL = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL ?? '/api')

const apiClient = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true,
})

let accessToken: string | null = null
let refreshHandler: (() => Promise<string | null>) | null = null
let unauthorizedHandler: (() => void) | null = null

type RetryConfig = AxiosRequestConfig & { _retry?: boolean }

export const setAccessToken = (token: string | null) => {
  accessToken = token
}

export const configureApiAuth = (handlers: {
  refreshAccessToken: () => Promise<string | null>
  onUnauthorized: () => void
}) => {
  refreshHandler = handlers.refreshAccessToken
  unauthorizedHandler = handlers.onUnauthorized
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined
    const url = config?.url ?? ''
    const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/refresh')

    if (
      error.response?.status === 401 &&
      config &&
      !config._retry &&
      !isAuthRoute &&
      refreshHandler
    ) {
      config._retry = true
      const nextToken = await refreshHandler()

      if (nextToken) {
        config.headers = config.headers ?? {}
        config.headers.Authorization = `Bearer ${nextToken}`
        return apiClient(config)
      }
    }

    if (error.response?.status === 401) {
      unauthorizedHandler?.()
    }

    return Promise.reject(error)
  },
)

const unwrap = async <T>(config: AxiosRequestConfig) => {
  const response = await apiClient.request<ApiEnvelope<T>>(config)
  return response.data.data
}

export const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Cannot reach the backend. Check that the API is running, the database is ready, and the browser origin is allowed.'
    }

    const responseData = error.response?.data as
      | {
          error?: {
            message?: string
            details?: {
              body?: {
                fieldErrors?: Record<string, string[] | undefined>
              }
              query?: {
                fieldErrors?: Record<string, string[] | undefined>
              }
              params?: {
                fieldErrors?: Record<string, string[] | undefined>
              }
            }
          }
        }
      | undefined

    const validationGroups = [
      responseData?.error?.details?.body?.fieldErrors,
      responseData?.error?.details?.query?.fieldErrors,
      responseData?.error?.details?.params?.fieldErrors,
    ]

    for (const fieldErrors of validationGroups) {
      if (!fieldErrors) {
        continue
      }

      for (const messages of Object.values(fieldErrors)) {
        const firstMessage = messages?.[0]
        if (firstMessage) {
          return firstMessage
        }
      }
    }

    return (
      responseData?.error?.message ??
      error.message
    )
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong'
}

const compactQuery = (query: Record<string, string | number | undefined | null>) => {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }

  const queryString = params.toString()
  return queryString.length > 0 ? `?${queryString}` : ''
}

export const api = {
  login: (payload: { email: string; password: string; role: Role }) =>
    unwrap<{ user: User; accessToken: string }>({
      method: 'POST',
      url: '/auth/login',
      data: payload,
    }),
  register: (payload: {
    name: string
    email: string
    password: string
    role: Role
  }) =>
    unwrap<{ user: User; accessToken: string }>({
      method: 'POST',
      url: '/auth/register',
      data: payload,
    }),
  refresh: () =>
    unwrap<{ accessToken: string }>({
      method: 'POST',
      url: '/auth/refresh',
    }),
  logout: () =>
    unwrap<{ message: string }>({
      method: 'POST',
      url: '/auth/logout',
    }),
  me: () =>
    unwrap<{ user: User }>({
      method: 'GET',
      url: '/auth/me',
    }),
  getUsers: (query: { role?: Role; page?: number; limit?: number }) =>
    unwrap<PaginatedResponse<User>>({
      method: 'GET',
      url: `/users${compactQuery(query)}`,
    }),
  getAssignableDevelopers: () =>
    unwrap<{ developers: Array<Pick<User, 'id' | 'name' | 'email'>> }>({
      method: 'GET',
      url: '/users/assignable/developers',
    }),
  createUser: (payload: { name: string; email: string; role: Role; tempPassword: string }) =>
    unwrap<{ user: User }>({
      method: 'POST',
      url: '/users',
      data: payload,
    }),
  updateUser: (id: string, payload: Partial<Pick<User, 'name' | 'role' | 'isActive'>>) =>
    unwrap<{ user: User }>({
      method: 'PATCH',
      url: `/users/${id}`,
      data: payload,
    }),
  getClients: (query: { search?: string; page?: number; limit?: number }) =>
    unwrap<PaginatedResponse<Client>>({
      method: 'GET',
      url: `/clients${compactQuery(query)}`,
    }),
  createClient: (payload: { name: string; contactName?: string; contactEmail?: string }) =>
    unwrap<{ client: Client }>({
      method: 'POST',
      url: '/clients',
      data: payload,
    }),
  updateClient: (
    id: string,
    payload: { name?: string; contactName?: string | null; contactEmail?: string | null },
  ) =>
    unwrap<{ client: Client }>({
      method: 'PATCH',
      url: `/clients/${id}`,
      data: payload,
    }),
  deleteClient: (id: string) =>
    unwrap<{ message: string }>({
      method: 'DELETE',
      url: `/clients/${id}`,
    }),
  getProjects: (query: { status?: string; clientId?: string; page?: number; limit?: number }) =>
    unwrap<PaginatedResponse<Project>>({
      method: 'GET',
      url: `/projects${compactQuery(query)}`,
    }),
  createProject: (payload: {
    clientId: string
    name: string
    description?: string
    category: string
    developerInstructions: string
    endDate?: string
    projectManagerId?: string
  }) =>
    unwrap<{ project: Project }>({
      method: 'POST',
      url: '/projects',
      data: payload,
    }),
  getProject: (id: string) =>
    unwrap<{ project: Project }>({
      method: 'GET',
      url: `/projects/${id}`,
    }),
  updateProject: (
    id: string,
    payload: {
      name?: string
      description?: string | null
      category?: string | null
      developerInstructions?: string | null
      status?: string
      endDate?: string | null
      projectManagerId?: string | null
    },
  ) =>
    unwrap<{ project: Project }>({
      method: 'PATCH',
      url: `/projects/${id}`,
      data: payload,
    }),
  assignProject: (id: string, developerId: string) =>
    unwrap<{ project: Project }>({
      method: 'PATCH',
      url: `/projects/${id}/assign`,
      data: { developerId },
    }),
  updateProjectStatus: (id: string, status: string) =>
    unwrap<{ project: Project }>({
      method: 'PATCH',
      url: `/projects/${id}/status`,
      data: { status },
    }),
  deleteProject: (id: string) =>
    unwrap<{ projectId: string; message: string }>({
      method: 'DELETE',
      url: `/projects/${id}`,
    }),
  getTasks: (query: {
    projectId?: string
    status?: TaskStatus | ''
    priority?: TaskPriority | ''
    from?: string
    to?: string
    page?: number
    limit?: number
  }) =>
    unwrap<PaginatedResponse<Task>>({
      method: 'GET',
      url: `/tasks${compactQuery(query)}`,
    }),
  createTask: (
    projectId: string,
    payload: {
      title: string
      description?: string
      assignedDeveloperId?: string | null
      priority: TaskPriority
      status?: TaskStatus
      dueDate?: string | null
    },
  ) =>
    unwrap<{ task: Task }>({
      method: 'POST',
      url: `/projects/${projectId}/tasks`,
      data: payload,
    }),
  getTask: (id: string) =>
    unwrap<{ task: Task }>({
      method: 'GET',
      url: `/tasks/${id}`,
    }),
  updateTask: (
    id: string,
    payload: {
      title?: string
      description?: string | null
      assignedDeveloperId?: string | null
      priority?: TaskPriority
      dueDate?: string | null
    },
  ) =>
    unwrap<{ task: Task }>({
      method: 'PATCH',
      url: `/tasks/${id}`,
      data: payload,
    }),
  updateTaskStatus: (id: string, status: TaskStatus) =>
    unwrap<{ task: Task; activity: Activity }>({
      method: 'PATCH',
      url: `/tasks/${id}/status`,
      data: { status },
    }),
  getAdminDashboard: () =>
    unwrap<AdminDashboard>({
      method: 'GET',
      url: '/dashboard/admin',
    }),
  getPmDashboard: () =>
    unwrap<PmDashboard>({
      method: 'GET',
      url: '/dashboard/pm',
    }),
  getDeveloperDashboard: () =>
    unwrap<DeveloperDashboard>({
      method: 'GET',
      url: '/dashboard/developer',
    }),
  getActivities: (query: {
    projectId?: string
    taskId?: string
    since?: string
    page?: number
    limit?: number
  }) =>
    unwrap<PaginatedResponse<Activity>>({
      method: 'GET',
      url: `/activities${compactQuery(query)}`,
    }),
  getNotifications: (query: { page?: number; limit?: number }) =>
    unwrap<PaginatedResponse<NotificationItem>>({
      method: 'GET',
      url: `/notifications${compactQuery(query)}`,
    }),
  getUnreadCount: () =>
    unwrap<{ unreadCount: number }>({
      method: 'GET',
      url: '/notifications/unread-count',
    }),
  markNotificationRead: (id: string) =>
    unwrap<{ notification: NotificationItem; unreadCount: number }>({
      method: 'PATCH',
      url: `/notifications/${id}/read`,
    }),
  markAllNotificationsRead: () =>
    unwrap<{ unreadCount: number }>({
      method: 'PATCH',
      url: '/notifications/read-all',
    }),
}
