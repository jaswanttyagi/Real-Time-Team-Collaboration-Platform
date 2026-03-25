import type { Role } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'
import { forbidden, unauthorized } from '../lib/errors.js'

export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(unauthorized())
      return
    }

    if (!roles.includes(req.user.role)) {
      next(forbidden())
      return
    }

    next()
  }
