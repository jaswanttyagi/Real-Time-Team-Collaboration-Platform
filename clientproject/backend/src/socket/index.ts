import type { Server as HttpServer } from 'node:http'
import { type Role, Prisma } from '@prisma/client'
import { Server } from 'socket.io'
import { env } from '../config/env.js'
import { prisma } from '../prisma/client.js'
import { verifyAccessToken } from '../lib/jwt.js'
import { addPresence, getOnlineUsersCount, removePresence } from './presence.js'

type UserPayload = {
  id: string
  role: Role
  email: string
  name: string
}

let io: Server | null = null

export const getIo = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized')
  }

  return io
}

const coerceTimestamp = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const buildActivityWhere = (user: UserPayload, since?: Date) => {
  const base: Prisma.ActivityLogWhereInput = since ? { createdAt: { gt: since } } : {}

  if (user.role === 'ADMIN') {
    return base
  }

  if (user.role === 'PM') {
    return {
      ...base,
      project: {
        createdById: user.id,
      },
    }
  }

  return {
    ...base,
    task: {
      assignedDeveloperId: user.id,
    },
  }
}

export const emitPresenceUpdate = () => {
  if (!io) {
    return
  }

  io.to('role:admin').emit('presence:update', {
    onlineUsers: getOnlineUsersCount(),
  })
}

export const emitActivity = (
  payload: unknown,
  _projectId: string,
  developerId?: string | null,
  ownerPmId?: string,
) => {
  if (!io) {
    return
  }

  io.to('role:admin').emit('activity:new', payload)

  if (ownerPmId) {
    io.to(`user:${ownerPmId}`).emit('activity:new', payload)
  }

  if (developerId) {
    io.to(`user:${developerId}`).emit('activity:new', payload)
  }
}

export const emitNotification = (recipientUserId: string, payload: unknown, unreadCount: number) => {
  if (!io) {
    return
  }

  if (payload !== null && payload !== undefined) {
    io.to(`user:${recipientUserId}`).emit('notification:new', payload)
  }

  io.to(`user:${recipientUserId}`).emit('notification:unread_count', { unreadCount })
}

export const emitProjectUpdated = (
  payload: unknown,
  ownerPmId?: string | null,
  developerIds: Array<string | null | undefined> = [],
) => {
  if (!io) {
    return
  }

  io.to('role:admin').emit('project:updated', payload)

  if (ownerPmId) {
    io.to(`user:${ownerPmId}`).emit('project:updated', payload)
  }

  const uniqueDeveloperIds = [...new Set(developerIds.filter((value): value is string => Boolean(value)))]
  for (const developerId of uniqueDeveloperIds) {
    io.to(`user:${developerId}`).emit('project:updated', payload)
  }
}

export const emitProjectDeleted = (
  projectId: string,
  ownerPmId?: string | null,
  developerIds: Array<string | null | undefined> = [],
) => {
  if (!io) {
    return
  }

  const payload = { projectId }

  io.to('role:admin').emit('project:deleted', payload)

  if (ownerPmId) {
    io.to(`user:${ownerPmId}`).emit('project:deleted', payload)
  }

  const uniqueDeveloperIds = [...new Set(developerIds.filter((value): value is string => Boolean(value)))]
  for (const developerId of uniqueDeveloperIds) {
    io.to(`user:${developerId}`).emit('project:deleted', payload)
  }
}

export const initializeSocket = (server: HttpServer) => {
  const isAllowedOrigin = (origin?: string) => {
    if (!origin) {
      return true
    }

    if (origin === env.CLIENT_URL) {
      return true
    }

    if (env.NODE_ENV !== 'production') {
      try {
        const { protocol } = new URL(origin)
        return protocol === 'http:' || protocol === 'https:'
      } catch {
        return false
      }
    }

    return false
  }

  io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          callback(null, true)
          return
        }

        callback(new Error('Origin not allowed by Socket.io CORS'))
      },
      credentials: true,
    },
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth.token

    if (typeof token !== 'string' || token.length === 0) {
      next(new Error('Unauthorized'))
      return
    }

    try {
      const payload = verifyAccessToken(token)
      socket.data.user = {
        id: payload.sub,
        role: payload.role,
        email: payload.email,
        name: payload.name,
      } satisfies UserPayload
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', async (socket) => {
    const user = socket.data.user as UserPayload

    socket.join(`user:${user.id}`)
    socket.join(`role:${user.role.toLowerCase()}`)

    const onlineUsers = addPresence(user.id, socket.id)
    if (user.role === 'ADMIN') {
      socket.emit('presence:update', { onlineUsers })
    }
    emitPresenceUpdate()

    const unreadCount = await prisma.notification.count({
      where: {
        recipientUserId: user.id,
        isRead: false,
      },
    })

    socket.emit('notification:unread_count', { unreadCount })

    socket.on('project:join', async (projectId: string) => {
      if (typeof projectId !== 'string' || projectId.length === 0) {
        return
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          createdById: true,
          assignedDeveloperId: true,
        },
      })

      if (!project) {
        return
      }

      if (
        user.role === 'ADMIN' ||
        project.createdById === user.id ||
        project.assignedDeveloperId === user.id
      ) {
        socket.join(`project:${project.id}`)
      }
    })

    socket.on('task:join', async (taskId: string) => {
      if (typeof taskId !== 'string' || taskId.length === 0) {
        return
      }

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          assignedDeveloperId: true,
          project: {
            select: {
              createdById: true,
            },
          },
        },
      })

      if (!task) {
        return
      }

      if (
        user.role === 'ADMIN' ||
        task.project.createdById === user.id ||
        task.assignedDeveloperId === user.id
      ) {
        socket.join(`task:${task.id}`)
      }
    })

    socket.on('activity:sync', async ({ since }: { since?: string }) => {
      const sinceDate = coerceTimestamp(since)
      const items = await prisma.activityLog.findMany({
        where: buildActivityWhere(user, sinceDate),
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
        include: {
          task: {
            select: {
              taskNumber: true,
            },
          },
          project: {
            select: {
              name: true,
            },
          },
        },
      })

      socket.emit('activity:missed', items)
    })

    socket.on('disconnect', () => {
      removePresence(user.id, socket.id)
      emitPresenceUpdate()
    })
  })

  return io
}
