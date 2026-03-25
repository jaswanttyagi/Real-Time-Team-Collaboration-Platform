import { Role, type Prisma } from '@prisma/client'

export type WorkspaceUser = {
  id: string
  role: Role
  scopeAdminId: string
  email: string
  name: string
}

export const buildWorkspaceUserWhere = (scopeAdminId: string): Prisma.UserWhereInput => ({
  OR: [{ id: scopeAdminId }, { workspaceAdminId: scopeAdminId }],
})

export const isWorkspaceMemberRole = (role: Role) => role === Role.PM || role === Role.DEVELOPER
