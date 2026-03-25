import { prisma } from '../../prisma/client.js'
import { conflict, notFound } from '../../lib/errors.js'
import { getLimit, getPage } from '../../lib/pagination.js'
import { hashPassword } from '../../lib/password.js'
import { assertPasswordStrength } from '../auth/auth.service.js'

const selectUserFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const

export const listUsers = async (query: { role?: 'ADMIN' | 'PM' | 'DEVELOPER'; page?: number; limit?: number }) => {
  const page = getPage(query.page?.toString())
  const limit = getLimit(query.limit?.toString())
  const where = query.role ? { role: query.role } : {}

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: selectUserFields,
    }),
    prisma.user.count({ where }),
  ])

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
}

export const listAssignableDevelopers = async () =>
  prisma.user.findMany({
    where: {
      role: 'DEVELOPER',
      isActive: true,
    },
    orderBy: {
      name: 'asc',
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  })

export const createUser = async (input: {
  name: string
  email: string
  role: 'ADMIN' | 'PM' | 'DEVELOPER'
  tempPassword: string
}) => {
  const email = input.email.toLowerCase()
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    throw conflict('Email is already in use')
  }

  assertPasswordStrength(input.tempPassword)

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email,
      role: input.role,
      passwordHash: await hashPassword(input.tempPassword),
    },
    select: selectUserFields,
  })

  return user
}

export const updateUser = async (
  userId: string,
  input: {
    name?: string
    role?: 'ADMIN' | 'PM' | 'DEVELOPER'
    isActive?: boolean
  },
) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!existingUser) {
    throw notFound('User not found')
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: input,
    select: selectUserFields,
  })

  return user
}
