import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, getErrorMessage } from '../api'
import { useAuth } from '../auth'
import {
  ActivityFeedPanel,
  ErrorState,
  LoadingState,
  StatusBadge,
  TaskFilters,
  TaskTable,
  formatDate,
} from '../components/ui'
import { useRealtime } from '../socket'
import type { Task, TaskPriority, TaskStatus } from '../types'

const emptyTaskForm = {
  title: '',
  description: '',
  assignedDeveloperId: '',
  priority: 'MEDIUM' as TaskPriority,
  status: 'TO_DO' as TaskStatus,
  dueDate: '',
}

export const ProjectDetailsPage = () => {
  const { user } = useAuth()
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { joinProject } = useRealtime()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskForm, setTaskForm] = useState(emptyTaskForm)

  useEffect(() => {
    if (projectId) {
      joinProject(projectId)
    }
  }, [joinProject, projectId])

  const filters = {
    status: searchParams.get('status') ?? '',
    priority: searchParams.get('priority') ?? '',
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
  }

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId),
    enabled: projectId.length > 0,
  })

  const tasksQuery = useQuery({
    queryKey: ['tasks', projectId, filters],
    queryFn: () =>
      api.getTasks({
        projectId,
        status: filters.status as TaskStatus | '',
        priority: filters.priority as '' | TaskPriority,
        from: filters.from,
        to: filters.to,
        page: 1,
        limit: 20,
      }),
    enabled: projectId.length > 0 && user?.role !== 'DEVELOPER',
  })

  const developersQuery = useQuery({
    queryKey: ['users', 'assignable-developers'],
    queryFn: api.getAssignableDevelopers,
    enabled: user?.role !== 'DEVELOPER',
  })

  const projectStatusMutation = useMutation({
    mutationFn: (status: string) => api.updateProjectStatus(projectId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const saveTaskMutation = useMutation({
    mutationFn: async () => {
      if (editingTask) {
        return api.updateTask(editingTask.id, {
          title: taskForm.title,
          description: taskForm.description || null,
          assignedDeveloperId: taskForm.assignedDeveloperId || null,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate || null,
        })
      }

      return api.createTask(projectId, {
        title: taskForm.title,
        description: taskForm.description,
        assignedDeveloperId: taskForm.assignedDeveloperId || null,
        priority: taskForm.priority,
        status: taskForm.status,
        dueDate: taskForm.dueDate || null,
      })
    },
    onSuccess: () => {
      setEditingTask(null)
      setTaskForm(emptyTaskForm)
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const taskStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      api.updateTaskStatus(taskId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['activities'] })
    },
  })

  const deleteProjectMutation = useMutation({
    mutationFn: () => api.deleteProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['project'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['activities'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      navigate('/projects')
    },
  })

  const loadingManagementView =
    projectQuery.isLoading ||
    (user?.role !== 'DEVELOPER' && tasksQuery.isLoading) ||
    (user?.role !== 'DEVELOPER' && developersQuery.isLoading)

  if (loadingManagementView) {
    return <LoadingState label="Loading project workspace..." />
  }

  if (
    projectQuery.error ||
    !projectQuery.data ||
    (user?.role !== 'DEVELOPER' && (tasksQuery.error || developersQuery.error || !tasksQuery.data || !developersQuery.data))
  ) {
    return (
      <ErrorState
        message={getErrorMessage(projectQuery.error ?? tasksQuery.error ?? developersQuery.error)}
      />
    )
  }

  const project = projectQuery.data.project
  const availableDevelopers = developersQuery.data?.developers ?? []
  const taskItems = tasksQuery.data?.items ?? []

  if (user?.role === 'DEVELOPER') {
    return (
      <div className="page-stack">
        <section className="two-column">
          <div className="panel details-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{project.client.name}</p>
                <h3>{project.name}</h3>
              </div>
              <select
                value={project.status}
                onChange={(event) => projectStatusMutation.mutate(event.target.value)}
              >
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <p>{project.description || 'No project description provided.'}</p>
            <div className="detail-grid">
              <div>
                <span>Project Type</span>
                <strong>{project.category || 'Not set'}</strong>
              </div>
              <div>
                <span>Assigned PM</span>
                <strong>{project.createdBy.name}</strong>
              </div>
              <div>
                <span>Deadline</span>
                <strong>{formatDate(project.endDate)}</strong>
              </div>
              <div>
                <span>Status</span>
                <StatusBadge status={project.status} />
              </div>
            </div>
          </div>
          <div className="panel details-card">
            <div className="panel-header">
              <h3>What You Need To Do</h3>
            </div>
            <p>{project.developerInstructions || 'No developer instructions were added yet.'}</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <section className="panel details-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">{project.client.name}</p>
            <h3>{project.name}</h3>
          </div>
          <div className="project-card-actions">
            <select
              value={project.status}
              onChange={(event) => projectStatusMutation.mutate(event.target.value)}
            >
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
            </select>
            {user?.role === 'ADMIN' && project.status === 'COMPLETED' ? (
              <button
                className="ghost-button danger-button"
                type="button"
                onClick={() => {
                  const shouldDelete = window.confirm(
                    `Delete completed project "${project.name}"? This will remove it from Admin, PM, and Developer views.`,
                  )

                  if (shouldDelete) {
                    deleteProjectMutation.mutate()
                  }
                }}
              >
                Delete Project
              </button>
            ) : null}
          </div>
        </div>
        <p>{project.description || 'No project description provided.'}</p>
        <div className="detail-grid">
          <div>
            <span>Project Type</span>
            <strong>{project.category || 'Not set'}</strong>
          </div>
          <div>
            <span>Assigned PM</span>
            <strong>{project.createdBy.name}</strong>
          </div>
          <div>
            <span>Assigned User</span>
            <strong>{project.assignedDeveloper?.name || 'Unassigned'}</strong>
          </div>
          <div>
            <span>Deadline</span>
            <strong>{formatDate(project.endDate)}</strong>
          </div>
          <div>
            <span>Status</span>
            <StatusBadge status={project.status} />
          </div>
        </div>
        <div className="project-instructions">
          <span>What the Developer Has to Do</span>
          <strong>{project.developerInstructions || 'No developer instructions provided.'}</strong>
        </div>
        {deleteProjectMutation.error ? (
          <div className="error-banner">{getErrorMessage(deleteProjectMutation.error)}</div>
        ) : null}
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

      <section className="project-layout">
        <div className="page-stack">
          <form
            className="panel form-grid"
            onSubmit={(event) => {
              event.preventDefault()
              saveTaskMutation.mutate()
            }}
          >
            <div className="panel-header">
              <h3>{editingTask ? `Edit Task #${editingTask.taskNumber}` : 'Create Task'}</h3>
            </div>
            <label>
              Title
              <input
                value={taskForm.title}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, title: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Description
              <textarea
                value={taskForm.description}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
            <label>
              Assigned user
              <select
                value={taskForm.assignedDeveloperId}
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    assignedDeveloperId: event.target.value,
                  }))
                }
              >
                <option value="">Unassigned</option>
                {availableDevelopers.map((developer) => (
                  <option key={developer.id} value={developer.id}>
                    {developer.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select
                value={taskForm.priority}
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    priority: event.target.value as TaskPriority,
                  }))
                }
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </label>
            {!editingTask ? (
              <label>
                Initial status
                <select
                  value={taskForm.status}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      status: event.target.value as TaskStatus,
                    }))
                  }
                >
                  <option value="TO_DO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="DONE">Done</option>
                </select>
              </label>
            ) : null}
            <label>
              Due date
              <input
                type="date"
                value={taskForm.dueDate}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                }
              />
            </label>
            <div className="inline-actions">
              <button className="primary-button" type="submit">
                {editingTask ? 'Save Task' : 'Create Task'}
              </button>
              {editingTask ? (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setEditingTask(null)
                    setTaskForm(emptyTaskForm)
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
            {saveTaskMutation.error ? (
              <div className="error-banner">{getErrorMessage(saveTaskMutation.error)}</div>
            ) : null}
          </form>

          <TaskTable
            role="PM"
            tasks={taskItems}
            onEdit={(task) => {
              setEditingTask(task)
              setTaskForm({
                title: task.title,
                description: task.description || '',
                assignedDeveloperId: task.assignedDeveloperId || '',
                priority: task.priority,
                status: task.status,
                dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
              })
            }}
            onStatusChange={(taskId, status) => {
              taskStatusMutation.mutate({ taskId, status })
            }}
          />
        </div>
        <ActivityFeedPanel title="Project Activity" projectId={projectId} />
      </section>
    </div>
  )
}
