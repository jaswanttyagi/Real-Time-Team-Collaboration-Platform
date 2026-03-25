import { Router } from 'express'
import { asyncHandler } from '../../lib/async-handler.js'
import { authenticate } from '../../middleware/auth.middleware.js'
import { authorize } from '../../middleware/role.middleware.js'
import { validate } from '../../middleware/validate.middleware.js'
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamsSchema,
} from './users.schemas.js'
import { createUser, listAssignableDevelopers, listUsers, updateUser } from './users.service.js'

export const usersRouter = Router()

usersRouter.use(authenticate)

usersRouter.get(
  '/assignable/developers',
  authorize('ADMIN', 'PM'),
  asyncHandler(async (_req, res) => {
    const developers = await listAssignableDevelopers()
    res.json({
      success: true,
      data: {
        developers,
      },
    })
  }),
)

usersRouter.use(authorize('ADMIN'))

usersRouter.get(
  '/',
  validate({ query: listUsersQuerySchema }),
  asyncHandler(async (req, res) => {
    const data = await listUsers(req.query)
    res.json({
      success: true,
      data,
    })
  }),
)

usersRouter.post(
  '/',
  validate({ body: createUserSchema }),
  asyncHandler(async (req, res) => {
    const user = await createUser(req.body)
    res.status(201).json({
      success: true,
      data: {
        user,
      },
    })
  }),
)

usersRouter.patch(
  '/:id',
  validate({ params: userIdParamsSchema, body: updateUserSchema }),
  asyncHandler(async (req, res) => {
    const user = await updateUser(req.params.id as string, req.body)
    res.json({
      success: true,
      data: {
        user,
      },
    })
  }),
)
