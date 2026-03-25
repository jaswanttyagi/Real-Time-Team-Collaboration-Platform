import cron from 'node-cron'
import { EntityType, NotificationType, TaskStatus } from '@prisma/client'
import { prisma } from '../prisma/client.js'
import { createInAppNotificationOnce } from '../modules/notifications/notifications.service.js'

const formatTaskDate = (value: Date) =>
  new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value)

// Function to notify users whose tasks are due within next 24 hours

const sendDueSoonNotifications = async (now: Date) => {
  const nextDay = new Date(now)
  nextDay.setHours(nextDay.getHours() + 24)

  // Fetching the tasks that are due soon but not completed

  const dueSoonTasks = await prisma.task.findMany({
    where: {
      dueDate: {
        gte: now,
        lte: nextDay,
      },
      status: {
        not: TaskStatus.DONE,
      },
      isOverdue: false,
      assignedDeveloperId: {
        not: null,
      },
    },
    select: {
      id: true,
      taskNumber: true,
      title: true,
      dueDate: true,
      assignedDeveloperId: true,
      project: {
        select: {
          name: true,
        },
      },
    },
  })
  for (const task of dueSoonTasks) {
    if (!task.assignedDeveloperId || !task.dueDate) {
      continue
    }
    //here we are Creating the notification and also ensures duplicate notification should not sent 
    await createInAppNotificationOnce({
      recipientUserId: task.assignedDeveloperId,
      type: NotificationType.DUE_DATE_SOON,
      title: 'Task due soon',
      message: `Task #${task.taskNumber} in ${task.project.name} is due on ${formatTaskDate(task.dueDate)}.`,
      entityType: EntityType.TASK,
      entityId: task.id,
    })
  }
}

//  this function is mark the overdue tasks and notify the assigned user and the project manager so they can take action

const markOverdueTasksAndNotify = async (now: Date) => {
  const overdueTasks = await prisma.task.findMany({
    where: {
      dueDate: {
        lt: now,
      },
      isOverdue: false,
      status: {
        not: TaskStatus.DONE,
      },
    },
    select: {
      id: true,
      taskNumber: true,
      dueDate: true,
      assignedDeveloperId: true,
      project: {
        select: {
          name: true,
          createdById: true,
        },
      },
    },
  })

  if (overdueTasks.length === 0) {
    return
  }
  await prisma.task.updateMany({
    where: {
      id: {
        in: overdueTasks.map((task) => task.id),
      },
    },
    data: {
      isOverdue: true,
      overdueFlaggedAt: now,
    },
  })
  for (const task of overdueTasks) {
    const message = `Task #${task.taskNumber} in ${task.project.name} is overdue as of ${formatTaskDate(task.dueDate!)}.`

    if (task.assignedDeveloperId) {
      await createInAppNotificationOnce({
        recipientUserId: task.assignedDeveloperId,
        type: NotificationType.TASK_OVERDUE,
        title: 'Task overdue',
        message,
        entityType: EntityType.TASK,
        entityId: task.id,
      })
    }

    await createInAppNotificationOnce({
      recipientUserId: task.project.createdById,
      type: NotificationType.TASK_OVERDUE,
      title: 'Task overdue',
      message,
      entityType: EntityType.TASK,
      entityId: task.id,
    })
  }
}
// registering the cron job to run every hour and check for overdue tasks and tasks that are due soon
export const registerOverdueJob = () => {
  cron.schedule('0 * * * *', async () => {
    const now = new Date()

    await sendDueSoonNotifications(now)
    await markOverdueTasksAndNotify(now)
  })
}
