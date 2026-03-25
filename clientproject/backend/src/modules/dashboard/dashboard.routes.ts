import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import { authenticate } from '../../middleware/auth.middleware.js'
import { authorize } from '../../middleware/role.middleware.js'
import {
  getAdminDashboard,
  getDeveloperDashboard,
  getPmDashboard,
} from './dashboard.service.js'

export const dashboardRouter = Router()

dashboardRouter.use(authenticate)

dashboardRouter.get(
  '/admin',
  authorize('ADMIN'),
  asyncHandler(async (_req, res) => {
    const data = await getAdminDashboard(_req.user!)
    res.json({
      success: true,
      data,
    })
  }),
)

dashboardRouter.get(
  '/pm',
  authorize('PM'),
  asyncHandler(async (req, res) => {
    const data = await getPmDashboard(req.user!)
    res.json({
      success: true,
      data,
    })
  }),
)

dashboardRouter.get(
  '/developer',
  authorize('DEVELOPER'),
  asyncHandler(async (req, res) => {
    const data = await getDeveloperDashboard(req.user!)
    res.json({
      success: true,
      data,
    })
  }),
)
