import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api, getErrorMessage } from '../api'
import {
  ActivityFeedPanel,
  ErrorState,
  LoadingState,
  PriorityBadge,
  StatusBadge,
  formatDate,
} from '../components/ui'
import { useRealtime } from '../socket'
import type { TaskStatus } from '../types'

export const DeveloperTaskPage = () => {
  const queryClient = useQueryClient()
  const { taskId = '' } = useParams()
  const { joinTask } = useRealtime()

  useEffect(() => {
    if (taskId) {
      joinTask(taskId)
    }
  }, [joinTask, taskId])

  const { data, isLoading, error } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.getTask(taskId),
    enabled: taskId.length > 0,
  })

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => api.updateTaskStatus(taskId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  if (isLoading) {
    return <LoadingState label="Loading task..." />
  }

  if (error || !data) {
    return <ErrorState message={getErrorMessage(error)} />
  }

  const task = data.task

  return (
    <div className="page-stack">
      <section className="two-column">
        <div className="panel details-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Task #{task.taskNumber}</p>
              <h3>{task.title}</h3>
            </div>
            <div className="inline-badges">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>
          </div>
          <p>{task.description || 'No description provided.'}</p>
          <div className="detail-grid">
            <div>
              <span>Project</span>
              <strong>{task.project.name}</strong>
            </div>
            <div>
              <span>Client</span>
              <strong>{task.project.client.name}</strong>
            </div>
            <div>
              <span>Due Date</span>
              <strong>{formatDate(task.dueDate)}</strong>
            </div>
            <div>
              <span>Overdue</span>
              <strong>{task.isOverdue ? 'Yes' : 'No'}</strong>
            </div>
          </div>
          <div className="inline-actions">
            <select
              value={task.status}
              onChange={(event) => statusMutation.mutate(event.target.value as TaskStatus)}
            >
              <option value="TO_DO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
            </select>
          </div>
        </div>
        <ActivityFeedPanel title="Task Timeline" taskId={taskId} />
      </section>
    </div>
  )
}
