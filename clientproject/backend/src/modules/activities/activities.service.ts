import { type Prisma, type TaskStatus } from '@prisma/client'
import { prisma } from '../../prisma/client.js'
import { getLimit, getPage } from '../../lib/pagination.js'
import type { WorkspaceUser } from '../../lib/workspace.js'

const activitySelect = {
  id: true,
  projectId: true,
  taskId: true,
  actorUserId: true,
  eventType: true,
  oldStatus: true,
  newStatus: true,
  actorNameSnapshot: true,
  taskTitleSnapshot: true,
  message: true,
  createdAt: true,
  task:{
    select:{
      taskNumber: true,
      assignedDeveloperId: true,
    },
  },
  project:{
    select:{
      name: true,
      createdById: true,
    },
  },
} as const

export const buildActivityAccessWhere = (
  user: WorkspaceUser,
  filters: {
    projectId?: string
    taskId?:string
    since?:string
  },
): Prisma.ActivityLogWhereInput => {
  const where:Prisma.ActivityLogWhereInput = {}
  // applying filters based on query params if present and also based on user role if user is admin then he can access all the activities if user is pm then he can access activities of project which he created and if user is developer then he can access activities of task which are assigned to him

  if (filters.projectId){
    where.projectId = filters.projectId
  }

  if (filters.taskId) {
    where.taskId = filters.taskId
  }

  if (filters.since){
    where.createdAt = {
      gt: new Date(filters.since),
    }
  }

  // allow to acess all activities if user is admin -> (like add clients , add user , delete user , delete projects etc)
  if (user.role==='ADMIN'){
    return {
      ...where,
      project: {
        client: {
          createdById: user.scopeAdminId,
        },
      },
    }
  }

  // if user is pm then it can acess the activites of project and assigned the project to Developer

  if (user.role==='PM'){
    return {
      ...where,
      project:{
        createdById: user.id,
      },
    }
  }

  return {
    ...where,
    task: {
      assignedDeveloperId: user.id,
    },
  }
}

export const listActivities = async(
  user: WorkspaceUser,
  query: { projectId?: string; taskId?: string; since?: string; page?: number; limit?: number },
) =>{
  const page = getPage(query.page?.toString())
  const limit = getLimit(query.limit?.toString(), 20, 50)
  const where = buildActivityAccessWhere(user, query)

  const [items, total] = await prisma.$transaction([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: activitySelect,
    }),
    prisma.activityLog.count({ where }),
  ])

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
}

export const createTaskStatusActivity = async(
  tx: Prisma.TransactionClient,
  input:{
    projectId: string
    taskId: string
    actorUserId: string
    actorNameSnapshot: string
    taskTitleSnapshot: string
    oldStatus: TaskStatus
    newStatus: TaskStatus
    taskNumber: number
  },

  
) =>
  // generating the readable message for activity log if task status is changed
  tx.activityLog.create({
    data:{
      projectId: input.projectId,
      taskId: input.taskId,
      actorUserId: input.actorUserId,
      eventType: 'TASK_STATUS_CHANGED',
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
      actorNameSnapshot: input.actorNameSnapshot,
      taskTitleSnapshot: input.taskTitleSnapshot,
      message: `${input.actorNameSnapshot} moved Task #${input.taskNumber} from ${input.oldStatus.replaceAll('_', ' ')} to ${input.newStatus.replaceAll('_', ' ')}`,
    },
    select: activitySelect,
  })
