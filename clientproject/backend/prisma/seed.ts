import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { demoAccounts, ensureDemoWorkspace } from '../src/lib/demo-workspace.js'

const prisma = new PrismaClient()

ensureDemoWorkspace(prisma)
  .then(() => {
    console.log('Demo data ensured without deleting custom users or projects')
    console.log(`Admin: ${demoAccounts.admin.email} / ${demoAccounts.admin.password}`)
    console.log(`PM: ${demoAccounts.pm.email} / ${demoAccounts.pm.password}`)
    console.log(
      `Developer: ${demoAccounts.developer.email} / ${demoAccounts.developer.password}`,
    )
  })
  .catch(async (error) => {
    console.error('seed failed', error)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
