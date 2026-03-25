import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, getErrorMessage } from '../api'
import { useAuth } from '../auth'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
  formatDate,
} from '../components/ui'
import type { Project } from '../types'

const defaultProjectForm = {
  clientId: '',
  name: '',
  description: '',
  category: '',
  developerInstructions: '',
  endDate: '',
  projectManagerId: '',
}

export const ProjectsPage = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [assigningProjectId, setAssigningProjectId] = useState<string | null>(null)
  const [selectedDeveloperId, setSelectedDeveloperId] = useState('')
  const [form, setForm] = useState(defaultProjectForm)

  const clientsQuery = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => api.getClients({ page: 1, limit: 50 }),
    enabled: user?.role !== 'DEVELOPER',
  })

  const pmUsersQuery = useQuery({
    queryKey: ['users', 'pm-options'],
    queryFn: () => api.getUsers({ role: 'PM', page: 1, limit: 50 }),
    enabled: user?.role === 'ADMIN',
  })

  const developersQuery = useQuery({
    queryKey: ['users', 'assignable-developers'],
    queryFn: api.getAssignableDevelopers,
    enabled: user?.role === 'PM',
  })

  const projectsQuery = useQuery({
    queryKey: ['projects', statusFilter, clientFilter, user?.role],
    queryFn: () =>
      api.getProjects({
        status: statusFilter || undefined,
        clientId: clientFilter || undefined,
        page: 1,
        limit: 20,
      }),
  })

  const activePmUsers = useMemo(
    () => (pmUsersQuery.data?.items ?? []).filter((item) => item.isActive),
    [pmUsersQuery.data?.items],
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingProject) {
        return api.updateProject(editingProject.id, {
          name: form.name,
          description: form.description || null,
          category: form.category || null,
          developerInstructions: form.developerInstructions || null,
          endDate: form.endDate || null,
          ...(user?.role === 'ADMIN' ? { projectManagerId: form.projectManagerId || null } : {}),
        })
      }

      return api.createProject({
        clientId: form.clientId,
        name: form.name,
        description: form.description,
        category: form.category,
        developerInstructions: form.developerInstructions,
        endDate: form.endDate || undefined,
        ...(user?.role === 'ADMIN' ? { projectManagerId: form.projectManagerId || undefined } : {}),
      })
    },
    onSuccess: () => {
      setEditingProject(null)
      setShowForm(false)
      setForm(defaultProjectForm)
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const assignMutation = useMutation({
    mutationFn: ({ projectId, developerId }: { projectId: string; developerId: string }) =>
      api.assignProject(projectId, developerId),
    onSuccess: () => {
      setAssigningProjectId(null)
      setSelectedDeveloperId('')
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['project'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['activities'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const requiredQueriesLoading =
    projectsQuery.isLoading ||
    (user?.role !== 'DEVELOPER' && clientsQuery.isLoading) ||
    pmUsersQuery.isLoading ||
    developersQuery.isLoading

  if (requiredQueriesLoading) {
    return <LoadingState label="Loading projects..." />
  }

  if (
    projectsQuery.error ||
    (user?.role !== 'DEVELOPER' && clientsQuery.error) ||
    pmUsersQuery.error ||
    developersQuery.error ||
    !projectsQuery.data
  ) {
    return (
      <ErrorState
        message={getErrorMessage(
          projectsQuery.error ?? clientsQuery.error ?? pmUsersQuery.error ?? developersQuery.error,
        )}
      />
    )
  }

  const resetProjectForm = () => {
    setEditingProject(null)
    setShowForm(false)
    setForm(defaultProjectForm)
  }

  const startEditingProject = (project: Project) => {
    setEditingProject(project)
    setShowForm(true)
    setForm({
      clientId: project.clientId,
      name: project.name,
      description: project.description || '',
      category: project.category || '',
      developerInstructions: project.developerInstructions || '',
      endDate: project.endDate ? project.endDate.slice(0, 10) : '',
      projectManagerId: project.createdById,
    })
  }

  const renderProjectCard = (project: Project) => (
    <article key={project.id} className="project-card">
      <div className="project-card-copy">
        <strong>{project.name}</strong>
        <p>{project.client.name}</p>
        <StatusBadge status={project.status} />
        <span>Type: {project.category || 'Not set'}</span>
        <span>Assigned PM: {project.createdBy.name}</span>
        <span>Assigned User: {project.assignedDeveloper?.name || 'Unassigned'}</span>
        <span>Deadline: {formatDate(project.endDate)}</span>
      </div>
      <div className="project-card-actions">
        <Link className="ghost-button" to={`/projects/${project.id}`}>
          Open project
        </Link>
        {user?.role === 'PM' || user?.role === 'ADMIN' ? (
          <button className="ghost-button" type="button" onClick={() => startEditingProject(project)}>
            Edit
          </button>
        ) : null}
        {user?.role === 'PM' ? (
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              setAssigningProjectId((current) => (current === project.id ? null : project.id))
              setSelectedDeveloperId(project.assignedDeveloperId || '')
            }}
          >
            Assign Project
          </button>
        ) : null}
        {assigningProjectId === project.id ? (
          <div className="assignment-box">
            <select
              value={selectedDeveloperId}
              onChange={(event) => setSelectedDeveloperId(event.target.value)}
            >
              <option value="">Select a developer</option>
              {(developersQuery.data?.developers ?? []).map((developer) => (
                <option key={developer.id} value={developer.id}>
                  {developer.name}
                </option>
              ))}
            </select>
            <button
              className="primary-button"
              type="button"
              disabled={!selectedDeveloperId}
              onClick={() =>
                assignMutation.mutate({
                  projectId: project.id,
                  developerId: selectedDeveloperId,
                })
              }
            >
              Confirm Assign
            </button>
          </div>
        ) : null}
        {user?.role === 'ADMIN' && project.status === 'COMPLETED' ? (
          <button
            className="ghost-button danger-button"
            type="button"
            onClick={() => {
              const shouldDelete = window.confirm(
                `Delete completed project "${project.name}"? This will remove it from Admin, PM, and Developer views.`,
              )

              if (shouldDelete) {
                deleteMutation.mutate(project.id)
              }
            }}
          >
            Delete Project
          </button>
        ) : null}
      </div>
    </article>
  )

  return (
    <div className="page-stack">
      {(user?.role === 'ADMIN' || user?.role === 'PM') && clientsQuery.data ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Project Management</h3>
              <p className="muted">
                {user?.role === 'ADMIN'
                  ? 'Create projects, set scope and deadline, then assign the project to a PM.'
                  : 'Create projects, set scope and deadline, then assign them to a developer.'}
              </p>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setShowForm((current) => !current)
                if (showForm && !editingProject) {
                  resetProjectForm()
                }
              }}
            >
              {showForm ? 'Close Form' : 'Add Project'}
            </button>
          </div>

          {showForm ? (
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault()
                saveMutation.mutate()
              }}
            >
              <label>
                Client
                <select
                  value={form.clientId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, clientId: event.target.value }))
                  }
                  required
                  disabled={Boolean(editingProject)}
                >
                  <option value="">Select a client</option>
                  {clientsQuery.data.items.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              {user.role === 'ADMIN' ? (
                <label>
                  Assigned PM
                  <select
                    value={form.projectManagerId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, projectManagerId: event.target.value }))
                    }
                    required
                  >
                    <option value="">Select a project manager</option>
                    {activePmUsers.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                Project Name
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                Project Description
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
              <label>
                Project Based On / Category / Type
                <input
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, category: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                What the Developer Has to Do
                <textarea
                  value={form.developerInstructions}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      developerInstructions: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Deadline
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, endDate: event.target.value }))
                  }
                />
              </label>
              <div className="inline-actions">
                <button className="primary-button" type="submit">
                  {editingProject ? 'Save Project' : 'Create Project'}
                </button>
                {editingProject ? (
                  <button className="ghost-button" type="button" onClick={resetProjectForm}>
                    Cancel
                  </button>
                ) : null}
              </div>
              {saveMutation.error ? (
                <div className="error-banner">{getErrorMessage(saveMutation.error)}</div>
              ) : null}
            </form>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{user?.role === 'DEVELOPER' ? 'Assigned Projects' : 'Projects'}</h3>
            <p className="muted">
              {user?.role === 'DEVELOPER'
                ? 'Only projects assigned to you appear here.'
                : 'Admin sees projects in their own workspace. PM sees only projects they created.'}
            </p>
          </div>
        </div>
        <div className="filter-bar compact">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
          </select>
          {user?.role !== 'DEVELOPER' && clientsQuery.data ? (
            <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
              <option value="">All clients</option>
              {clientsQuery.data.items.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {projectsQuery.data.items.length === 0 ? (
          <EmptyState title="No projects found">
            {user?.role === 'DEVELOPER'
              ? 'You will see projects here after a project manager assigns one to you.'
              : 'Create a project and assign it to a developer to start the workflow.'}
          </EmptyState>
        ) : (
          <div className="list-stack">{projectsQuery.data.items.map(renderProjectCard)}</div>
        )}

        {assignMutation.error ? (
          <div className="error-banner">{getErrorMessage(assignMutation.error)}</div>
        ) : null}
        {deleteMutation.error ? (
          <div className="error-banner">{getErrorMessage(deleteMutation.error)}</div>
        ) : null}
      </section>
    </div>
  )
}
