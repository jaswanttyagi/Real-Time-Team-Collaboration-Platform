import {Router} from 'express'
import {asyncHandler} from '../../lib/async-handler.js'
import {authenticate} from '../../middleware/auth.middleware.js'
import {validate} from '../../middleware/validate.middleware.js'
import {loginSchema, registerSchema} from './auth.schemas.js'
import {getCurrentUser, login, logout, refreshAccessToken, register} from './auth.service.js'

export const authRouter = Router()

authRouter.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const data = await login(req, res, req.body.email, req.body.password, req.body.role)
    res.json({
      success: true,
      data,
    })
  }),
)

authRouter.post(
  '/register',
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const data = await register(req, res, req.body)
    res.json({
      success: true,
      data,
    })
  }),
)

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const data = await refreshAccessToken(req, res)
    res.json({
      success: true,
      data,
    })
  }),
)

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const data = await logout(req, res)
    res.json({
      success: true,
      data,
    })
  }),
)

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req.user!.id)
    res.json({
      success: true,
      data: {
        user,
      },
    })
  }),
)
