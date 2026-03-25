import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import { prisma } from './prisma/client.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { usersRouter } from './modules/users/users.routes.js'
import { clientsRouter } from './modules/clients/clients.routes.js'
import { projectsRouter } from './modules/projects/projects.routes.js'
import { tasksRouter } from './modules/tasks/tasks.routes.js'
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js'
import { activitiesRouter } from './modules/activities/activities.routes.js'
import { notificationsRouter } from './modules/notifications/notifications.routes.js'
import { errorMiddleware } from './middleware/error.middleware.js'
import { notFoundMiddleware } from './middleware/not-found.middleware.js'

export const app = express()

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

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Origin not allowed by CORS'))
    },
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

app.get('/health', async (_req, res) => {
  try {
    await prisma.user.count()

    res.json({
      success: true,
      data: {
        status: 'ok',
        database: 'ready',
      },
    })
  } catch (error) {
    console.error('Health check failed', error)
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database is not ready. Run Prisma migration and seed before using the app.',
      },
    })
  }
})

app.use('/api/auth', authLimiter, authRouter)
app.use('/api/users', usersRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/activities', activitiesRouter)
app.use('/api/notifications', notificationsRouter)

app.use(notFoundMiddleware)
app.use(errorMiddleware)
