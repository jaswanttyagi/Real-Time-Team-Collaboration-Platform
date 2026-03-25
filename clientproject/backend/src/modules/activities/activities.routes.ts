import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import { authenticate } from '../../middleware/auth.middleware.js'
import { validate } from '../../middleware/validate.middleware.js'
import { activitiesQuerySchema } from './activities.schemas.js'
import { listActivities } from './activities.service.js'

export const activitiesRouter = Router()

activitiesRouter.use(authenticate)

activitiesRouter.get(
  '/',
  validate({ query: activitiesQuerySchema }),
  asyncHandler(async (req, res) => {
    const data = await listActivities(req.user!, req.query)
    res.json({
      success: true,
      data,
    })
  }),
)
