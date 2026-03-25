import bcrypt from 'bcryptjs'
import {
  ActivityType,
  EntityType,
  NotificationType,
  PrismaClient,
  ProjectStatus,
  Role,
  TaskPriority,
  TaskStatus,
} from '@prisma/client'

export const demoAccounts = {
  admin: {
    name: 'Anika Rao',
    email: 'admin@agency.local',
    password: 'Admin@123',
  },
  pm: {
    name: 'Rohan Mehta',
    email: 'pm1@agency.local',
    password: 'Pm@12345',
  },
  developer: {
    name: 'Ravi Nair',
    email: 'dev1@agency.local',
    password: 'Dev@12345',
  },
} as const

export const demoEmails = new Set(
  Object.values(demoAccounts).map((account) => account.email.toLowerCase()),
)

const addDays = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date
}

const taskBlueprints = [
  {
    title: 'Setup project base',
    description: 'Folders, access, and starter structure for the demo project.',
    status: TaskStatus.TO_DO,
    priority: TaskPriority.MEDIUM,
    offset: 2,
    readTaskAlert: true,
  },
  {
    title: 'Login + dashboard',
    description: 'Connect the login flow and role-based dashboard entry.',
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
    offset: -2,
    readTaskAlert: false,
  },
  {
    title: 'Assign project flow',
    description: 'Allow the PM to assign the project and notify the user.',
    status: TaskStatus.IN_REVIEW,
    priority: TaskPriority.CRITICAL,
    offset: 3,
    readTaskAlert: false,
  },
  {
    title: 'Cleanup completed state',
    description: 'Handle the completed state and admin cleanup path properly.',
    status: TaskStatus.DONE,
    priority: TaskPriority.MEDIUM,
    offset: -5,
    readTaskAlert: false,
  },
] as const

const ensureUser = async (
  prisma: PrismaClient,
  input: {
    name: string
    email: string
    role: Role
    password: string
    workspaceAdminId?: string | null
  },
) => {
  const passwordHash = await bcrypt.hash(input.password, 10)

  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      role: input.role,
      passwordHash,
      workspaceAdminId: input.workspaceAdminId ?? null,
      isActive: true,
    },
    create: {
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash,
      workspaceAdminId: input.workspaceAdminId ?? null,
      isActive: true,
    },
  })
}

const ensureClient = async (prisma: PrismaClient, adminId: string) => {
  const existing = await prisma.client.findFirst({
    where: {
      name: 'Acme Health',
      createdById: adminId,
    },
  })

  if (existing) {
    return prisma.client.update({
      where: { id: existing.id },
      data: {
        contactName: 'Julia Clarke',
        contactEmail: 'julia@acme-health.test',
        createdById: adminId,
      },
    })
  }

  return prisma.client.create({
    data: {
      name: 'Acme Health',
      contactName: 'Julia Clarke',
      contactEmail: 'julia@acme-health.test',
      createdById: adminId,
    },
  })
}

const ensureProject = async (
  prisma: PrismaClient,
  input: {
    clientId: string
    developerId: string
    pmId: string
  },
) => {
  const existing = await prisma.project.findFirst({
    where: {
      name: 'Acme Website Revamp',
      createdById: input.pmId,
    },
  })

  const projectData = {
    description:
      'Simple demo project for testing PM assignment, notifications, and project progress.',
    category: 'Marketing Website',
    developerInstructions:
      'Update project and task statuses as you work so the PM and admin can see the progress.',
    clientId: input.clientId,
    createdById: input.pmId,
    assignedDeveloperId: input.developerId,
    status: ProjectStatus.ACTIVE,
    startDate: addDays(-7),
    endDate: addDays(14),
  }

  if (existing) {
    return prisma.project.update({
      where: { id: existing.id },
      data: projectData,
    })
  }

  return prisma.project.create({
    data: {
      name: 'Acme Website Revamp',
      ...projectData,
    },
  })
}

const ensureTask = async (
  prisma: PrismaClient,
  input: {
    projectId: string
    pmId: string
    developerId: string
    title: string
    description: string
    status: TaskStatus
    priority: TaskPriority
    offset: number
  },
) => {
  const dueDate = addDays(input.offset)
  const isOverdue = dueDate < new Date() && input.status !== TaskStatus.DONE

  const existing = await prisma.task.findFirst({
    where: {
      title: input.title,
      projectId: input.projectId,
    },
  })

  const taskData = {
    description: input.description,
    assignedDeveloperId: input.developerId,
    priority: input.priority,
    status: input.status,
    dueDate,
    isOverdue,
    overdueFlaggedAt: isOverdue ? new Date() : null,
    createdById: input.pmId,
    updatedById: input.status === TaskStatus.TO_DO ? input.pmId : input.developerId,
  }

  if (existing) {
    return prisma.task.update({
      where: { id: existing.id },
      data: taskData,
    })
  }

  return prisma.task.create({
    data: {
      title: input.title,
      projectId: input.projectId,
      ...taskData,
    },
  })
}

const ensureNotification = async (
  prisma: PrismaClient,
  input: {
    recipientUserId: string
    type: NotificationType
    title: string
    message: string
    entityType: EntityType
    entityId: string
    isRead: boolean
  },
) => {
  const existing = await prisma.notification.findFirst({
    where: {
      recipientUserId: input.recipientUserId,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      message: input.message,
    },
  })

  if (existing) {
    return prisma.notification.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        message: input.message,
        isRead: input.isRead,
        readAt: input.isRead ? existing.readAt ?? new Date() : null,
      },
    })
  }

  return prisma.notification.create({
    data: {
      ...input,
      readAt: input.isRead ? new Date() : null,
    },
  })
}

const ensureActivityLog = async (
  prisma: PrismaClient,
  input: {
    projectId: string
    taskId: string
    actorUserId: string
    oldStatus: TaskStatus
    newStatus: TaskStatus
    actorName: string
    taskTitle: string
    taskNumber: number
    createdAt: Date
  },
) => {
  const message = `${input.actorName} moved task #${input.taskNumber} from ${input.oldStatus} to ${input.newStatus}`

  const existing = await prisma.activityLog.findFirst({
    where: {
      taskId: input.taskId,
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
      message,
    },
  })

  if (existing) {
    return prisma.activityLog.update({
      where: { id: existing.id },
      data: {
        actorNameSnapshot: input.actorName,
        taskTitleSnapshot: input.taskTitle,
      },
    })
  }

  return prisma.activityLog.create({
    data: {
      projectId: input.projectId,
      taskId: input.taskId,
      actorUserId: input.actorUserId,
      eventType: ActivityType.TASK_STATUS_CHANGED,
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
      actorNameSnapshot: input.actorName,
      taskTitleSnapshot: input.taskTitle,
      message,
      createdAt: input.createdAt,
    },
  })
}

export const ensureDemoWorkspace = async (prisma: PrismaClient) => {
  const { admin, pm, developer } = await ensureDemoUsers(prisma)

  const client = await ensureClient(prisma, admin.id)
  const project = await ensureProject(prisma, {
    clientId: client.id,
    pmId: pm.id,
    developerId: developer.id,
  })

  await ensureNotification(prisma, {
    recipientUserId: developer.id,
    type: NotificationType.PROJECT_ASSIGNED,
    title: 'Project assigned',
    message: `Project Manager ${pm.name} assigned you the project ${project.name}.`,
    entityType: EntityType.PROJECT,
    entityId: project.id,
    isRead: false,
  })

  for (const [index, blueprint] of taskBlueprints.entries()) {
    const task = await ensureTask(prisma, {
      projectId: project.id,
      pmId: pm.id,
      developerId: developer.id,
      title: blueprint.title,
      description: blueprint.description,
      status: blueprint.status,
      priority: blueprint.priority,
      offset: blueprint.offset,
    })

    await ensureNotification(prisma, {
      recipientUserId: developer.id,
      type: NotificationType.TASK_ASSIGNED,
      title: 'Task assigned',
      message: `Task: ${task.title}`,
      entityType: EntityType.TASK,
      entityId: task.id,
      isRead: blueprint.readTaskAlert,
    })

    if (blueprint.status === TaskStatus.IN_REVIEW) {
      await ensureNotification(prisma, {
        recipientUserId: pm.id,
        type: NotificationType.TASK_IN_REVIEW,
        title: 'Review needed',
        message: `${task.title} is ready`,
        entityType: EntityType.TASK,
        entityId: task.id,
        isRead: false,
      })
    }

    if (blueprint.status !== TaskStatus.TO_DO) {
      await ensureActivityLog(prisma, {
        projectId: project.id,
        taskId: task.id,
        actorUserId: developer.id,
        oldStatus: TaskStatus.TO_DO,
        newStatus: blueprint.status,
        actorName: developer.name,
        taskTitle: task.title,
        taskNumber: task.taskNumber,
        createdAt: addDays(index - 2),
      })
    }
  }
}

export const ensureDemoUsers = async (prisma: PrismaClient) => {
  const admin = await ensureUser(prisma, {
    name: demoAccounts.admin.name,
    email: demoAccounts.admin.email,
    role: Role.ADMIN,
    password: demoAccounts.admin.password,
    workspaceAdminId: null,
  })

  const pm = await ensureUser(prisma, {
    name: demoAccounts.pm.name,
    email: demoAccounts.pm.email,
    role: Role.PM,
    password: demoAccounts.pm.password,
    workspaceAdminId: admin.id,
  })

  const developer = await ensureUser(prisma, {
    name: demoAccounts.developer.name,
    email: demoAccounts.developer.email,
    role: Role.DEVELOPER,
    password: demoAccounts.developer.password,
    workspaceAdminId: admin.id,
  })

  return { admin, pm, developer }
}
