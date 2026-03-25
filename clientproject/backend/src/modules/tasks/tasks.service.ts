import {
  EntityType,
  NotificationType,
  Role,
  TaskStatus,
  type Prisma,
  type TaskPriority,
} from '@prisma/client'
import { prisma } from '../../prisma/client.js'
import { badRequest, forbidden, notFound } from '../../lib/errors.js'
import { getLimit, getPage } from '../../lib/pagination.js'
import type { WorkspaceUser } from '../../lib/workspace.js'
import { createTaskStatusActivity } from '../activities/activities.service.js'
import { createInAppNotification } from '../notifications/notifications.service.js'
import { emitActivity } from '../../socket/index.js'

const taskSelect = {
  id: true,
  taskNumber: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  isOverdue: true,
  overdueFlaggedAt: true,
  createdAt: true,
  updatedAt: true,
  projectId: true,
  assignedDeveloperId: true,
  project: {
    select: {
      id: true,
      name: true,
      createdById: true,
      client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  assignedDeveloper: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
    },
  },
  updatedBy: {
    select: {
      id: true,
      name: true,
    },
  },
} as const

const priorityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const

const getPriorityRank = (priority: TaskPriority) => priorityOrder.indexOf(priority)

const normalizeDateValue = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null

const formatTaskDate = (value: Date | string | null | undefined) => {
  if (!value) {
    return 'No due date'
  }

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

const computeOverdueState = (dueDate?: Date | null, status?: TaskStatus) => {
  // agar due date nahi hai ya task done hai to overdue false hi rahega
  if (!dueDate || status === TaskStatus.DONE) {
    return {
      isOverdue: false,
      overdueFlaggedAt: null,
    }
  }

  return dueDate < new Date()
    ? {
        isOverdue: true,
        // here we are storing when the task was flagged as overdue
        overdueFlaggedAt: new Date(),
      }
    : {
        isOverdue: false,
        overdueFlaggedAt: null,
      }
}

const ensureDeveloper = async (developerId: string | null | undefined, scopeAdminId: string) => {
  if (!developerId) {
    return null
  }

  const user = await prisma.user.findFirst({
    where: {
      id: developerId,
      role: Role.DEVELOPER,
      isActive: true,
      workspaceAdminId: scopeAdminId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  })

  // random user assign na ho jaye isliye yaha check hai
  if (!user) {
    throw badRequest('Assigned developer must be an active developer')
  }

  return user
}

const getProjectScope = async (projectId: string, user: WorkspaceUser) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: {
        select: {
          name: true,
          createdById: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  if (!project) {
    throw notFound('Project not found')
  }

  if (user.role === Role.ADMIN && project.client.createdById !== user.scopeAdminId) {
    throw forbidden('You can only manage tasks inside your own admin workspace')
  }

  // PM sirf apne created projects ke andar task manage kar skta hai
  if (user.role === Role.PM && project.createdById !== user.id) {
    throw forbidden('You can only manage tasks inside projects you created')
  }

  return project
}

const getTaskAccessWhere = (taskId: string, user: WorkspaceUser) => {
  if (user.role === Role.ADMIN) {
    return {
      id: taskId,
      project: {
        client: {
          createdById: user.scopeAdminId,
        },
      },
    }
  }

  if (user.role === Role.PM) {
    return {
      id: taskId,
      project: {
        createdById: user.id,
      },
    }
  }

  return {
    id: taskId,
    assignedDeveloperId: user.id,
  }
}

const getTaskForAccess = async (taskId: string, user: WorkspaceUser) => {
  const task = await prisma.task.findFirst({
    where: getTaskAccessWhere(taskId, user),
    select: taskSelect,
  })

  if (!task) {
    throw notFound('Task not found')
  }

  return task
}

const buildTaskWhere = (
  user: WorkspaceUser,
  query: { projectId?: string; status?: TaskStatus; priority?: TaskPriority; from?: string; to?: string },
): Prisma.TaskWhereInput => {
  const where: Prisma.TaskWhereInput = {}

  if (query.projectId) {
    where.projectId = query.projectId
  }

  if (query.status) {
    where.status = query.status
  }

  if (query.priority) {
    where.priority = query.priority
  }

  if (query.from || query.to) {
    where.dueDate = {}

    if (query.from) {
      where.dueDate.gte = new Date(query.from)
    }

    if (query.to) {
      where.dueDate.lte = new Date(query.to)
    }
  }

  if (user.role === Role.ADMIN) {
    where.project = {
      client: {
        createdById: user.scopeAdminId,
      },
    }
  }

  if (user.role === Role.PM) {
    where.project = {
      createdById: user.id,
    }
  }

  if (user.role === Role.DEVELOPER) {
    where.assignedDeveloperId = user.id
  }

  return where
}

const createAssignmentNotification = async (input: {
  developerId: string
  projectName: string
  taskId: string
  taskNumber: number
  isReassignment?: boolean
}) => {
  await createInAppNotification({
    recipientUserId: input.developerId,
    type: input.isReassignment ? NotificationType.TASK_REASSIGNED : NotificationType.TASK_ASSIGNED,
    title: input.isReassignment ? 'Task reassigned' : 'New task assigned',
    message: input.isReassignment
      ? `Task #${input.taskNumber} in ${input.projectName} was reassigned to you.`
      : `You were assigned Task #${input.taskNumber} in ${input.projectName}.`,
    entityType: EntityType.TASK,
    entityId: input.taskId,
  })
}

const formatTaskStatus = (status: TaskStatus) =>
  status
    .toLowerCase()
    .replaceAll('_', ' ')
    // for making more redable
    .replace(/\b\w/g, (character) => character.toUpperCase())

const createDeveloperProgressNotifications = async (input: {
  actorName: string
  taskId: string
  taskNumber: number
  projectName: string
  projectManagerId: string
  scopeAdminId: string
  oldStatus: TaskStatus
  newStatus: TaskStatus
}) => {
  const recipientIds = [
    input.projectManagerId,
    input.scopeAdminId,
  ]

  const title =
    input.newStatus === TaskStatus.IN_REVIEW ? 'Task moved to In Review' : 'Task progress updated'

  const message = `Developer ${input.actorName} updated Task #${input.taskNumber} from ${formatTaskStatus(input.oldStatus)} to ${formatTaskStatus(input.newStatus)} in ${input.projectName}.`

  // duplicate ids aaye to bhi ek hi bande ko ek baar notification jayegi
  for (const recipientUserId of [...new Set(recipientIds)]) {
    await createInAppNotification({
      recipientUserId,
      type:
        input.newStatus === TaskStatus.IN_REVIEW
          ? NotificationType.TASK_IN_REVIEW
          : NotificationType.TASK_UPDATED,
      title,
      message,
      entityType: EntityType.TASK,
      entityId: input.taskId,
    })
  }
}

export const listTasks = async (
  user: WorkspaceUser,
  query: {
    projectId?: string
    status?: TaskStatus
    priority?: TaskPriority
    from?: string
    to?: string
    page?: number
    limit?: number
  },
) => {
  const page = getPage(query.page?.toString())
  const limit = getLimit(query.limit?.toString())
  const where = buildTaskWhere(user, query)

  const [items, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      // pehle due date, fir latest created task
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: taskSelect,
    }),
    prisma.task.count({ where }),
  ])

  const orderedItems =
    user.role === Role.DEVELOPER
      ? [...items].sort((left, right) => {
          // developer ko important tasks upar dikkhenhge at the top of bell
          const priorityDiff = getPriorityRank(left.priority) - getPriorityRank(right.priority)
          if (priorityDiff !== 0) {
            return priorityDiff
          }

          if (!left.dueDate && !right.dueDate) {
            return 0
          }

          if (!left.dueDate) {
            return 1
          }

          if (!right.dueDate) {
            return -1
          }

          return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime()
        })
      : items

  return {
    items: orderedItems,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
}

export const getTaskById = async (taskId: string, user: WorkspaceUser) =>
  getTaskForAccess(taskId, user)

export const createProjectTask = async (
  projectId: string,
  user: WorkspaceUser,
  input: {
    title: string
    description?: string
    assignedDeveloperId: string | null
    status: TaskStatus
    priority: TaskPriority
    dueDate: string | null
  },
) => {
  const project = await getProjectScope(projectId, user)
  const developer = await ensureDeveloper(input.assignedDeveloperId, user.scopeAdminId)
  const dueDate = input.dueDate ? new Date(input.dueDate) : null
  const overdueState = computeOverdueState(dueDate, input.status)

  const task = await prisma.task.create({
    data: {
      projectId,
      title: input.title,
      description: input.description,
      assignedDeveloperId: developer?.id ?? null,
      status: input.status,
      priority: input.priority,
      dueDate,
      ...overdueState,
      createdById: user.id,
      updatedById: user.id,
    },
    select: taskSelect,
  })

  if (developer) {
    await createAssignmentNotification({
      developerId: developer.id,
      projectName: project.name,
      taskId: task.id,
      taskNumber: task.taskNumber,
    })
  }

  return task
}

export const updateTask = async (
  taskId: string,
  user: WorkspaceUser,
  input: {
    title?: string
    description?: string | null
    assignedDeveloperId?: string | null
    priority?: TaskPriority
    dueDate?: string | null
  },
) => {
  const existingTask = await getTaskForAccess(taskId, user)

  // dev ko sirf status update ka access dena hai, details edit nahi
  if (user.role === Role.DEVELOPER) {
    throw forbidden('Developers cannot edit task details')
  }

  const nextDeveloper =
    input.assignedDeveloperId !== undefined
      ? await ensureDeveloper(input.assignedDeveloperId, user.scopeAdminId)
      : existingTask.assignedDeveloper

  const dueDate =
    input.dueDate !== undefined
      ? input.dueDate
        ? new Date(input.dueDate)
        : null
      : existingTask.dueDate

  const overdueState = computeOverdueState(dueDate ? new Date(dueDate) : null, existingTask.status)

  const updatedTask = await prisma.task.update({
    where: {
      id: taskId,
    },
    data: {
      title: input.title,
      description: input.description,
      assignedDeveloperId:
        input.assignedDeveloperId !== undefined ? nextDeveloper?.id ?? null : undefined,
      priority: input.priority,
      dueDate,
      ...overdueState,
      updatedById: user.id,
    },
    select: taskSelect,
  })

  const nextDeveloperId = nextDeveloper?.id ?? null
  const assignmentChanged =
    input.assignedDeveloperId !== undefined && existingTask.assignedDeveloperId !== nextDeveloperId

  if (assignmentChanged && nextDeveloper) {
    await createAssignmentNotification({
      developerId: nextDeveloper.id,
      projectName: updatedTask.project.name,
      taskId: updatedTask.id,
      taskNumber: updatedTask.taskNumber,
      isReassignment: Boolean(existingTask.assignedDeveloperId),
    })
  }

  const updatedFields: string[] = []

  if (input.title !== undefined && input.title !== existingTask.title) {
    updatedFields.push('title')
  }

  if (input.description !== undefined && input.description !== existingTask.description) {
    updatedFields.push('description')
  }

  if (input.priority !== undefined && input.priority !== existingTask.priority) {
    updatedFields.push('priority')
  }

  if (
    input.dueDate !== undefined &&
    normalizeDateValue(input.dueDate ? new Date(input.dueDate) : null) !==
      normalizeDateValue(existingTask.dueDate)
  ) {
    updatedFields.push(`due date (${formatTaskDate(dueDate)})`)
  }

  // assignment same hai but task details change hui hai to assigned dev ko notifivation jayega
  if (!assignmentChanged && updatedFields.length > 0 && updatedTask.assignedDeveloperId) {
    await createInAppNotification({
      recipientUserId: updatedTask.assignedDeveloperId,
      type: NotificationType.TASK_UPDATED,
      title: 'Task updated',
      message: `Task #${updatedTask.taskNumber} in ${updatedTask.project.name} was updated: ${updatedFields.join(', ')}.`,
      entityType: EntityType.TASK,
      entityId: updatedTask.id,
    })
  }

  return updatedTask
}

export const updateTaskStatus = async (
  taskId: string,
  user: WorkspaceUser,
  status: TaskStatus,
) => {
  const existingTask = await prisma.task.findFirst({
    where: getTaskAccessWhere(taskId, user),
    include: {
      project: {
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              workspaceAdminId: true,
            },
          },
        },
      },
      assignedDeveloper: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  if (!existingTask) {
    throw notFound('Task not found')
  }

  if (user.role === Role.DEVELOPER && existingTask.assignedDeveloperId !== user.id) {
    throw forbidden('You can only update status on tasks assigned to you')
  }

  if (existingTask.status === status) {
    throw badRequest('Task is already in that status')
  }

  const overdueState = computeOverdueState(existingTask.dueDate, status)

  const { task, activity } = await prisma.$transaction(async (tx) => {
    const updatedTask = await tx.task.update({
      where: { id: taskId },
      data: {
        status,
        ...overdueState,
        updatedById: user.id,
      },
      select: taskSelect,
    })

    const nextActivity = await createTaskStatusActivity(tx, {
      projectId: existingTask.projectId,
      taskId: existingTask.id,
      actorUserId: user.id,
      actorNameSnapshot: user.name,
      taskTitleSnapshot: existingTask.title,
      oldStatus: existingTask.status,
      newStatus: status,
      taskNumber: existingTask.taskNumber,
    })

    return {
      task: updatedTask,
      activity: nextActivity,
    }
  })

  emitActivity(activity, user.scopeAdminId, task.assignedDeveloperId, task.project.createdById)

  if (user.role === Role.DEVELOPER) {
    await createDeveloperProgressNotifications({
      actorName: user.name,
      taskId: existingTask.id,
      taskNumber: existingTask.taskNumber,
      projectName: existingTask.project.name,
      projectManagerId: existingTask.project.createdById,
      scopeAdminId: existingTask.project.createdBy.workspaceAdminId ?? user.scopeAdminId,
      oldStatus: existingTask.status,
      newStatus: status,
    })
  }

  return { task, activity }
}
