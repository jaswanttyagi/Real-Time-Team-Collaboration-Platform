import {z} from 'zod'

export const listClientsQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
})

export const createClientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120).optional(),
  contactEmail: z.string().email().optional(),
})

export const updateClientSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    contactName: z.string().trim().min(2).max(120).nullable().optional(),
    contactEmail: z.string().email().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided')

export const clientIdParamsSchema = z.object({
  id: z.string().uuid(),
})
