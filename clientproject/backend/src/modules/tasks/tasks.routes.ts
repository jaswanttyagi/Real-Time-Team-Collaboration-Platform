import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import { authenticate } from '../../middleware/auth.middleware.js'
import { authorize } from '../../middleware/role.middleware.js'
import { validate } from '../../middleware/validate.middleware.js'
import {
  listTasksQuerySchema,
  taskIdParamsSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from './tasks.schemas.js'
import { getTaskById, listTasks, updateTask, updateTaskStatus } from './tasks.service.js'

export const tasksRouter = Router()

tasksRouter.use(authenticate)

tasksRouter.get(
  '/',
  authorize('ADMIN', 'PM', 'DEVELOPER'),
  validate({ query: listTasksQuerySchema }),
  asyncHandler(async (req, res) => {
    const data = await listTasks(req.user!, req.query)
    res.json({
      success: true,
      data,
    })
  }),
)

tasksRouter.get(
  '/:id',
  authorize('ADMIN', 'PM', 'DEVELOPER'),
  validate({ params: taskIdParamsSchema }),
  asyncHandler(async (req, res) => {
    const task = await getTaskById(req.params.id as string, req.user!)
    res.json({
      success: true,
      data: {
        task,
      },
    })
  }),
)

tasksRouter.patch(
  '/:id',
  authorize('ADMIN', 'PM'),
  validate({ params: taskIdParamsSchema, body: updateTaskSchema }),
  asyncHandler(async (req, res) => {
    const task = await updateTask(req.params.id as string, req.user!, req.body)
    res.json({
      success: true,
      data: {
        task,
      },
    })
  }),
)

tasksRouter.patch(
  '/:id/status',
  authorize('ADMIN', 'PM', 'DEVELOPER'),
  validate({ params: taskIdParamsSchema, body: updateTaskStatusSchema }),
  asyncHandler(async (req, res) => {
    const data = await updateTaskStatus(req.params.id as string, req.user!, req.body.status)
    res.json({
      success: true,
      data,
    })
  }),
)
