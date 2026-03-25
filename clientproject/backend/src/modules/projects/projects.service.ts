import {
  EntityType,
  NotificationType,
  Role,
  type Prisma,
  type ProjectStatus,
  type TaskPriority,
  type TaskStatus,
} from '@prisma/client'
import { prisma } from '../../prisma/client.js'
import { badRequest, forbidden, notFound } from '../../lib/errors.js'
import { getLimit, getPage } from '../../lib/pagination.js'
import { emitProjectDeleted, emitProjectUpdated } from '../../socket/index.js'
import { createInAppNotification } from '../notifications/notifications.service.js'
import { createProjectTask } from '../tasks/tasks.service.js'

const projectSummarySelect = {
  id: true,
  name: true,
  description: true,
  category: true,
  developerInstructions: true,
  status: true,
  clientId: true,
  createdById: true,
  assignedDeveloperId: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      name: true,
      contactName: true,
      contactEmail: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  assignedDeveloper: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  _count: {
    select: {
      tasks: true,
      activities: true,
    },
  },
} as const



// Helper function to build the where condition for listing projects based on user role and filters
const buildProjectWhere = (
  user: { id: string; role: Role },
  filters: { status?: ProjectStatus; clientId?: string },
): Prisma.ProjectWhereInput => {
  const where: Prisma.ProjectWhereInput = {}

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.clientId) {
    where.clientId = filters.clientId
  }

  if (user.role === Role.PM) {
    where.createdById = user.id
  }

  if (user.role === Role.DEVELOPER) {
    where.assignedDeveloperId = user.id
  }

  return where
}

const ensureProjectDeveloper = async (developerId: string) => {
  const user = await prisma.user.findFirst({
    where: {
      id: developerId,
      role: Role.DEVELOPER,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  })

  if (!user) {
    throw badRequest('Assigned developer must be an active user with the Developer role')
  }

  return user
}

// createing the project assigment notfication when new one is created 

const createProjectAssignmentNotification = async (input: {
  recipientUserId: string
  actorName: string
  projectId: string
  projectName: string
  isReassignment?: boolean
  actorRoleLabel: 'Admin' | 'Project Manager'
}) => {
  await createInAppNotification({
    recipientUserId: input.recipientUserId,
    type: input.isReassignment ? NotificationType.PROJECT_REASSIGNED : NotificationType.PROJECT_ASSIGNED,
    title: input.isReassignment ? 'Project reassigned' : 'Project assigned',
    message: input.isReassignment
      ? `${input.actorRoleLabel} ${input.actorName} reassigned you to the project ${input.projectName}.`
      : `${input.actorRoleLabel} ${input.actorName} assigned you the project ${input.projectName}.`,
    entityType: EntityType.PROJECT,
    entityId: input.projectId,
  })
}



const resolveProjectManagerId = async (
  user: { id: string; role: Role },
  projectManagerId?: string | null,
) => {
  if (user.role === Role.PM) {
    return user.id
  }

  if (!projectManagerId) {
    throw badRequest('Project manager is required when admin creates a project')
  }

  const projectManager = await prisma.user.findFirst({
    where: {
      id: projectManagerId,
      role: Role.PM,
      isActive: true,
    },
    select: {
      id: true,
    },
  })

  if (!projectManager) {
    throw notFound('Selected project manager was not found')
  }

  return projectManager.id
}

const getProjectForUser = async (projectId: string, user: { id: string; role: Role }) => {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...(user.role === Role.PM ? { createdById: user.id } : {}),
      ...(user.role === Role.DEVELOPER ? { assignedDeveloperId: user.id } : {}),
    },
    select: projectSummarySelect,
  })

  if (!project) {
    throw notFound('Project not found')
  }

  return project
}


// this function to get project for management actions like update, assign, delete) with proper authorization checks
const getProjectForManagement = async (projectId: string, user: { id: string; role: Role }) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignedDeveloper: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!project) {
    throw notFound('Project not found')
  }

  if (user.role === Role.PM && project.createdById !== user.id) {
    throw forbidden('You can only manage projects you created')
  }

  if (user.role === Role.DEVELOPER) {
    throw forbidden('Developers cannot manage project assignment')
  }

  return project
}


// aceessing the project by id
export const getProjectById = async (projectId: string, user: { id: string; role: Role }) =>
  getProjectForUser(projectId, user)

export const listProjects = async (
  user: { id: string; role: Role },
  query: { status?: ProjectStatus; clientId?: string; page?: number; limit?: number },
) => {
  const page = getPage(query.page?.toString())
  const limit = getLimit(query.limit?.toString())
  const where = buildProjectWhere(user, query)

  const [items, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: projectSummarySelect,
    }),
    prisma.project.count({ where }),
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

export const createProject = async (
  user: { id: string; role: Role; name?: string },
  input: {
    clientId: string
    name: string
    description?: string
    category: string
    developerInstructions: string
    endDate?: string
    projectManagerId?: string
  },
) => {
  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
  })

  if (!client) {
    throw notFound('Client not found')
  }

  const ownerId = await resolveProjectManagerId(user, input.projectManagerId)

  const project = await prisma.project.create({
    data: {
      clientId: input.clientId,
      name: input.name,
      description: input.description,
      category: input.category,
      developerInstructions: input.developerInstructions,
      startDate: new Date(),
      endDate: input.endDate ? new Date(input.endDate) : null,
      createdById: ownerId,
    },
    select: projectSummarySelect,
  })

  // Emit project created event with the project manager as the main recipient for real-time updates
  emitProjectUpdated(project, project.createdById)

  if (user.role === Role.ADMIN && project.createdById !== user.id) {
    await createProjectAssignmentNotification({
      recipientUserId: project.createdById,
      actorName: user.name ?? 'Admin',
      actorRoleLabel: 'Admin',
      projectId: project.id,
      projectName: project.name,
    })
  }

  return project
}

export const updateProject = async (
  projectId: string,
  user: { id: string; role: Role; name?: string },
  input: {
    name?: string
    description?: string | null
    category?: string | null
    developerInstructions?: string | null
    status?: ProjectStatus
    endDate?: string | null
    projectManagerId?: string | null
  },
) => {
  // Fetch the project with authorization checks for management actions
  const project = await getProjectForManagement(projectId, user)
  // Resolve the new project manager ID if provided
  const ownerId =
    user.role === Role.ADMIN && input.projectManagerId !== undefined
      ? await resolveProjectManagerId(user, input.projectManagerId)
      : undefined

  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      name: input.name,
      description: input.description,
      category:
        input.category !== undefined ? (input.category === null ? null : input.category) : undefined,
      developerInstructions:
        input.developerInstructions !== undefined
          ? input.developerInstructions === null
            ? null
            : input.developerInstructions
          : undefined,
      status: input.status,
      endDate: input.endDate ? new Date(input.endDate) : input.endDate === null ? null : undefined,
      createdById: ownerId,
    },
    select: projectSummarySelect,
  })

  emitProjectUpdated(updatedProject, updatedProject.createdById, [
    project.createdById,
    project.assignedDeveloperId,
    updatedProject.assignedDeveloperId,
  ])

  if (
    user.role === Role.ADMIN &&
    updatedProject.createdById !== project.createdById &&
    updatedProject.createdById !== user.id
  ) {
    await createProjectAssignmentNotification({
      recipientUserId: updatedProject.createdById,
      actorName: user.name ?? 'Admin',
      actorRoleLabel: 'Admin',
      projectId: updatedProject.id,
      projectName: updatedProject.name,
      isReassignment: true,
    })
  }

  return updatedProject
}


// here how a PM assign the project to  developer conatins the all logiv for the authorization and also create the notification for the developer when new project is assigned to him or her and also when the project is reassigned to another developer then also it will create the notification for the new developer about the reassignment with the proper message and also emit the real time update to all connected clients about the project update with the help of socket

export const assignProjectToDeveloper = async (
  projectId: string,
  user: { id: string; role: Role },
  developerId: string,
) => {
  if (user.role !== Role.PM) {
    throw forbidden('Only project managers can assign a project to a user')
  }

  const project = await getProjectForManagement(projectId, user)
  const developer = await ensureProjectDeveloper(developerId)

  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      assignedDeveloperId: developer.id,
    },
    select: projectSummarySelect,
  })

  if (project.assignedDeveloperId !== developer.id) {
    await createProjectAssignmentNotification({
      recipientUserId: developer.id,
      actorName: project.createdBy.name,
      actorRoleLabel: 'Project Manager',
      projectId: project.id,
      projectName: project.name,
      isReassignment: Boolean(project.assignedDeveloperId),
    })
  }
  // Emit project updated event with the assigned developer as the main recipient for real-time updates
  emitProjectUpdated(updatedProject, project.createdById, [
    project.assignedDeveloperId,
    developer.id,
  ])

  return updatedProject
}

export const updateProjectStatus = async (
  projectId: string,
  user: { id: string; role: Role },
  status: ProjectStatus,
) => {
  // fetching project from their id
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
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

  if (user.role === Role.PM && project.createdById !== user.id) {
    throw forbidden('You can only update projects you created')
  }

  if (user.role === Role.DEVELOPER && project.assignedDeveloperId !== user.id) {
    throw forbidden('You can only update projects assigned to you')
  }

  if (project.status === status) {
    throw badRequest('Project is already in that status')
  }
  // if status fetched then update the project
  const updatedProject = await prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      status,
    },
    select: projectSummarySelect,
  })

  emitProjectUpdated(updatedProject, project.createdById, [project.assignedDeveloperId])

  return updatedProject
}


// project deletion is only allowed by admin and admin can delte the project when it is completed many case are possibles

export const deleteCompletedProject = async (
  projectId: string,
  user: { id: string; role: Role },
) => {
  if (user.role !== Role.ADMIN) {
    throw forbidden('Only admins can delete projects')
  }
// Fetch the project with related tasks and notifications to ensure it exists and is completed
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      status: true,
      createdById: true,
      assignedDeveloperId: true,
      tasks: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!project) {
    throw notFound('Project not found')
  }

  if (project.status !== 'COMPLETED') {
    throw badRequest('Only completed projects can be deleted')
  }
  // if porject fetch successfully fetch the task
  const taskIds = project.tasks.map((task) => task.id)
  const notificationConditions: Prisma.NotificationWhereInput[] = [
    {
      entityType: EntityType.PROJECT,
      entityId: project.id,
    },
  ]

  if (taskIds.length > 0) {
    notificationConditions.push({
      entityType: EntityType.TASK,
      entityId: {
        in: taskIds,
      },
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({
      where: {
        OR: notificationConditions,
      },
    })

    await tx.activityLog.deleteMany({
      where: {
        projectId: project.id,
      },
    })

    await tx.task.deleteMany({
      where: {
        projectId: project.id,
      },
    })

    await tx.project.delete({
      where: {
        id: project.id,
      },
    })
  })

  emitProjectDeleted(project.id, project.createdById, [project.assignedDeveloperId])

  return {
    projectId: project.id,
    message: 'Completed project deleted successfully',
  }
}

export const createTaskForProject = async (
  projectId: string,
  user: { id: string; role: Role; name: string; email: string },
  input: {
    title: string
    description?: string
    assignedDeveloperId?: string | null
    status?: TaskStatus
    priority: TaskPriority
    dueDate?: string | null
  },
) =>
  createProjectTask(projectId, user, {
    title: input.title,
    description: input.description,
    assignedDeveloperId: input.assignedDeveloperId ?? null,
    status: input.status ?? 'TO_DO',
    priority: input.priority,
    dueDate: input.dueDate ?? null,
  })
