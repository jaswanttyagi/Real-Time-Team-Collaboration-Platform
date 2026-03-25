import { Role, type Prisma } from '@prisma/client'
import { prisma } from '../../prisma/client.js'
import { badRequest, conflict, notFound } from '../../lib/errors.js'
import { getLimit, getPage } from '../../lib/pagination.js'
import { buildWorkspaceUserWhere, isWorkspaceMemberRole, type WorkspaceUser } from '../../lib/workspace.js'
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

export const listUsers = async (
  user: WorkspaceUser,
  query: { role?: 'ADMIN' | 'PM' | 'DEVELOPER'; page?: number; limit?: number },
) => {
  const page = getPage(query.page?.toString())
  const limit = getLimit(query.limit?.toString())
  const where: Prisma.UserWhereInput = query.role
    ? query.role === Role.ADMIN
      ? { id: user.scopeAdminId, role: query.role }
      : { workspaceAdminId: user.scopeAdminId, role: query.role }
    : buildWorkspaceUserWhere(user.scopeAdminId)

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

export const listAssignableDevelopers = async (user: WorkspaceUser) =>
  prisma.user.findMany({
    where: {
      role: 'DEVELOPER',
      isActive: true,
      workspaceAdminId: user.scopeAdminId,
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
  actor: WorkspaceUser
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

  if (!isWorkspaceMemberRole(input.role)) {
    throw badRequest('Create admin accounts from the sign-up screen')
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email,
      role: input.role,
      workspaceAdminId: input.actor.scopeAdminId,
      passwordHash: await hashPassword(input.tempPassword),
    },
    select: selectUserFields,
  })

  return user
}

export const updateUser = async (
  actor: WorkspaceUser,
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

  if (existingUser.workspaceAdminId !== actor.scopeAdminId) {
    throw notFound('User not found')
  }

  if (existingUser.role === Role.ADMIN || input.role === Role.ADMIN) {
    throw badRequest('Admin accounts are managed through their own sign-in')
  }

  if (input.role && !isWorkspaceMemberRole(input.role)) {
    throw badRequest('Only PM and User roles can be assigned here')
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: input,
    select: selectUserFields,
  })

  return user
}
