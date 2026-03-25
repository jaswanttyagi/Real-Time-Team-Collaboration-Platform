import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../lib/async-handler.js'
import { authenticate } from '../../middleware/auth.middleware.js'
import { validate } from '../../middleware/validate.middleware.js'
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from './notifications.service.js'

const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
})

const notificationParamsSchema = z.object({
  id: z.string().uuid(),
})

export const notificationsRouter = Router()

notificationsRouter.use(authenticate)

notificationsRouter.get(
  '/',
  validate({ query: listNotificationsQuerySchema }),
  asyncHandler(async (req, res) => {
    const data = await listNotifications(req.user!.id, req.query)
    res.json({
      success: true,
      data,
    })
  }),
)

notificationsRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const data = await getUnreadCount(req.user!.id)
    res.json({
      success: true,
      data,
    })
  }),
)

notificationsRouter.patch(
  '/:id/read',
  validate({ params: notificationParamsSchema }),
  asyncHandler(async (req, res) => {
    const data = await markNotificationAsRead(req.user!.id, req.params.id as string)
    res.json({
      success: true,
      data,
    })
  }),
)

notificationsRouter.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const data = await markAllNotificationsAsRead(req.user!.id)
    res.json({
      success: true,
      data,
    })
  }),
)
