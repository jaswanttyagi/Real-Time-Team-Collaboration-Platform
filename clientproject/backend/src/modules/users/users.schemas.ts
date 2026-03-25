import { Role } from '@prisma/client'
import { z } from 'zod'

export const listUsersQuerySchema = z.object({
  role: z.nativeEnum(Role).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
})

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  tempPassword: z.string().min(8).max(128),
})

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    role: z.nativeEnum(Role).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided')

export const userIdParamsSchema = z.object({
  id: z.string().uuid(),
})
