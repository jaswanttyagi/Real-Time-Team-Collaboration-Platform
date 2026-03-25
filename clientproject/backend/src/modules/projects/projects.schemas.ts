import { ProjectStatus, TaskPriority, TaskStatus } from '@prisma/client'
import { z } from 'zod'

const dateString = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date')

export const projectIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export const projectTaskParamsSchema = z.object({
  projectId: z.string().uuid(),
})

export const listProjectsQuerySchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional(),
  clientId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
})

export const createProjectSchema = z
  .object({
    clientId: z.string().uuid(),
    name: z.string().trim().min(2).max(150),
    description: z.string().trim().max(2000).optional(),
    category: z.string().trim().min(2).max(120),
    developerInstructions: z.string().trim().min(5).max(3000),
    endDate: dateString.optional(),
    projectManagerId: z.string().uuid().optional(),
  })

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    category: z.string().trim().min(2).max(120).nullable().optional(),
    developerInstructions: z.string().trim().min(5).max(3000).nullable().optional(),
    status: z.nativeEnum(ProjectStatus).optional(),
    endDate: dateString.nullable().optional(),
    projectManagerId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided')

export const assignProjectSchema = z.object({
  developerId: z.string().uuid(),
})

export const updateProjectStatusSchema = z.object({
  status: z.nativeEnum(ProjectStatus),
})

export const createTaskSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(3000).optional(),
  assignedDeveloperId: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority),
  dueDate: dateString.nullable().optional(),
})
