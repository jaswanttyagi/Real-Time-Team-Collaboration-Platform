import { TaskPriority, TaskStatus } from '@prisma/client'
import { z } from 'zod'

const dateString = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date')

export const taskIdParamsSchema = z.object({
  id: z.string().uuid(),
})

// validation for listing the task with filterationa nd pagination
export const listTasksQuerySchema = z
  .object({
    projectId: z.string().uuid().optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    from: dateString.optional(),
    to: dateString.optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .refine(
    (value) => !value.from || !value.to || new Date(value.from) <= new Date(value.to),
    'The "from" date must be on or before the "to" date',
  )

  // Validation for creating a task
export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(2).max(180).optional(),
    description: z.string().trim().max(3000).nullable().optional(),
    assignedDeveloperId: z.string().uuid().nullable().optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueDate: dateString.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided')

export const updateTaskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
})
