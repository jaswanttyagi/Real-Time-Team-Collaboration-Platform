import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '../api'
import { useAuth } from '../auth'
import { ErrorState, LoadingState } from '../components/ui'
import type { Client } from '../types'

const defaultClientForm = {
  name: '',
  contactName: '',
  contactEmail: '',
}

export const ClientsPage = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [form, setForm] = useState(defaultClientForm)

  const { data, isLoading, error } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => api.getClients({ search, page: 1, limit: 20 }),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingClient) {
        return api.updateClient(editingClient.id, {
          name: form.name,
          contactName: form.contactName || null,
          contactEmail: form.contactEmail || null,
        })
      }

      return api.createClient({
        name: form.name,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
      })
    },
    onSuccess: () => {
      setEditingClient(null)
      setForm(defaultClientForm)
      void queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (clientId: string) => api.deleteClient(clientId),
    onSuccess: () => {
      setEditingClient(null)
      setForm(defaultClientForm)
      void queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  if (isLoading) {
    return <LoadingState label="Loading clients..." />
  }

  if (error || !data) {
    return <ErrorState message={getErrorMessage(error)} />
  }

  return (
    <div className="page-stack">
      <section className="panel search-bar">
        <input
          placeholder="Search clients by name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </section>
      <section className="two-column">
        {user?.role === 'ADMIN' ? (
          <form
            className="panel form-grid"
            onSubmit={(event) => {
              event.preventDefault()
              saveMutation.mutate()
            }}
          >
            <div className="panel-header">
              <h3>{editingClient ? 'Edit Client' : 'Create Client'}</h3>
            </div>
            <label>
              Client name
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <label>
              Contact name
              <input
                value={form.contactName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, contactName: event.target.value }))
                }
              />
            </label>
            <label>
              Contact email
              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) =>
                  setForm((current) => ({ ...current, contactEmail: event.target.value }))
                }
              />
            </label>
            <div className="inline-actions">
              <button className="primary-button" type="submit">
                {editingClient ? 'Save changes' : 'Create client'}
              </button>
              {editingClient ? (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setEditingClient(null)
                    setForm(defaultClientForm)
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
            {saveMutation.error ? (
              <div className="error-banner">{getErrorMessage(saveMutation.error)}</div>
            ) : null}
          </form>
        ) : null}
        <div className="panel">
          <div className="panel-header">
            <h3>Client Directory</h3>
          </div>
          <div className="list-stack">
            {data.items.map((client) => (
              <article key={client.id} className="list-row">
                <div>
                  <strong>{client.name}</strong>
                  <p>
                    {client.contactName || 'No contact'} | {client.contactEmail || 'No email'}
                  </p>
                </div>
                {user?.role === 'ADMIN' ? (
                  <div className="inline-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => {
                        setEditingClient(client)
                        setForm({
                          name: client.name,
                          contactName: client.contactName || '',
                          contactEmail: client.contactEmail || '',
                        })
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="ghost-button danger-button"
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete client "${client.name}"?`)) {
                          deleteMutation.mutate(client.id)
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          {deleteMutation.error ? (
            <div className="error-banner">{getErrorMessage(deleteMutation.error)}</div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
