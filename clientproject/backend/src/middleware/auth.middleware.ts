import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../lib/jwt.js'
import { unauthorized } from '../lib/errors.js'

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization

  // we take the token from the header and verify it if not valid then we send unauthorised error
  // if token is valid then we append it in header 

  if (!header || !header.startsWith('Bearer ')) {
    next(unauthorized())
    return
  }

  const token = header.slice('Bearer '.length)

  try {
    const payload = verifyAccessToken(token)
    // req ki user id me role will help to verify during the authorization 
    req.user = {
      id: payload.sub,
      role: payload.role,
      scopeAdminId: payload.scopeAdminId,
      email: payload.email,
      name: payload.name,
    }
    next()
  } catch {
    next(unauthorized('Invalid or expired access token'))
  }
}
