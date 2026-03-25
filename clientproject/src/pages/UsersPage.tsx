import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api'
import { ErrorState, LoadingState, formatLabel } from '../components/ui'
import type { Role } from '../types'

const defaultForm = {
  name: '',
  email: '',
  role: 'DEVELOPER' as Role,
  tempPassword: '',
}

export const UsersPage = () => {
  const queryClient = useQueryClient()
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [form, setForm] = useState(defaultForm)

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', roleFilter],
    queryFn: () => api.getUsers({ role: roleFilter || undefined, page: 1, limit: 25 }),
  })

  const createMutation = useMutation({
    mutationFn: api.createUser,
    onSuccess: () => {
      setForm(defaultForm)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { role?: Role; isActive?: boolean } }) =>
      api.updateUser(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  if (isLoading) {
    return <LoadingState label="Loading users..." />
  }

  if (error || !data) {
    return <ErrorState message={getErrorMessage(error)} />
  }

  return (
    <div className="page-stack">
      <section className="two-column">
        <form
          className="panel form-grid"
          onSubmit={(event) => {
            event.preventDefault()
            createMutation.mutate(form)
          }}
        >
          <div className="panel-header">
            <h3>Create User</h3>
          </div>
          <label>
            Full name
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </label>
          <label>
            Role
            <select
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({ ...current, role: event.target.value as Role }))
              }
            >
              <option value="ADMIN">Admin</option>
              <option value="PM">Project Manager</option>
              <option value="DEVELOPER">User</option>
            </select>
          </label>
          <label>
            Temporary password
            <input
              type="password"
              value={form.tempPassword}
              onChange={(event) =>
                setForm((current) => ({ ...current, tempPassword: event.target.value }))
              }
              required
            />
          </label>
          <button className="primary-button" type="submit">
            Create user
          </button>
          {createMutation.error ? (
            <div className="error-banner">{getErrorMessage(createMutation.error)}</div>
          ) : null}
        </form>

        <div className="panel">
          <div className="panel-header">
            <h3>User Directory</h3>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as Role | '')}
            >
              <option value="">All roles</option>
              <option value="ADMIN">Admin</option>
              <option value="PM">PM</option>
              <option value="DEVELOPER">User</option>
            </select>
          </div>
          <div className="list-stack">
            {data.items.map((user) => (
              <article key={user.id} className="list-row">
                <div>
                  <strong>{user.name}</strong>
                  <p>
                    {user.email} | {formatLabel(user.role)} | {user.isActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div className="inline-actions">
                  <select
                    value={user.role}
                    onChange={(event) =>
                      updateMutation.mutate({
                        id: user.id,
                        payload: { role: event.target.value as Role },
                      })
                    }
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="PM">PM</option>
                    <option value="DEVELOPER">User</option>
                  </select>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() =>
                      updateMutation.mutate({
                        id: user.id,
                        payload: { isActive: !user.isActive },
                      })
                    }
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
