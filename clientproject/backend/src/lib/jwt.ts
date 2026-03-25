import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'
import { env } from '../config/env.js'

type AccessPayload = {
  sub: string
  role: Role
  email: string
  name: string
}

type RefreshPayload = {
  sub: string
  sessionId: string
}

export const signAccessToken = (payload: AccessPayload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  })
// in paylaod we append the role so if wrong user try to verify the token cant verify 
export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload & AccessPayload

export const signRefreshToken = (payload: RefreshPayload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET,{
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` as jwt.SignOptions['expiresIn'],
  })

export const verifyRefreshToken = (token: string) =>
    jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload & RefreshPayload

// token hashing

export const hashToken = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex')
