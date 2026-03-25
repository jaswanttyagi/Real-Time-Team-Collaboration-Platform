import type { NextFunction, Request, Response } from 'express'
import type { ZodTypeAny } from 'zod'
import { AppError } from '../lib/errors.js'

type ValidationShape = {
  body?: ZodTypeAny
  query?: ZodTypeAny
  params?: ZodTypeAny
}

const replaceRequestValues = (
  target: Record<string, unknown>,
  nextValues: Record<string, unknown>,
) => {

  for (const key of Object.keys(target)) {
    delete target[key]
  }

  Object.assign(target, nextValues)
}

export const validate = (schemas: ValidationShape) => (req: Request, _res: Response, next: NextFunction) => {
    const errors: Record<string, unknown> = {}
    // here we validate req body and if error present then reurn the error otherwise perform validarion
    if (schemas.body) {
    const parsed = schemas.body.safeParse(req.body)
    if (!parsed.success) {
      errors.body = parsed.error.flatten()
    } else {
      req.body = parsed.data
    }
  }
//   validate query
  if (schemas.query) {
    const parsed = schemas.query.safeParse(req.query)
    if (!parsed.success) {
      errors.query = parsed.error.flatten()
    } else {
      replaceRequestValues(req.query as Record<string, unknown>, parsed.data as Record<string, unknown>)
    }
  }

  if (schemas.params) {
    const parsed = schemas.params.safeParse(req.params)
    if (!parsed.success) {
      errors.params = parsed.error.flatten()
    } else {
      replaceRequestValues(req.params as Record<string, unknown>, parsed.data as Record<string, unknown>)
    }
  }
// if validation error present then we send the error response otherwise  we move to next middleware
  if (Object.keys(errors).length > 0) {
    next(new AppError(422, 'VALIDATION_ERROR', 'Validation failed', errors))
    return
  }

  next()
}
