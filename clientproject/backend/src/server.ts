import http from 'node:http'
import { app } from './app.js'
import { env } from './config/env.js'
import { prisma } from './prisma/client.js'
import { registerOverdueJob } from './jobs/overdue.job.js'
import { initializeSocket } from './socket/index.js'

const server = http.createServer(app)

const boot = async () => {
  await prisma.$connect()
  await prisma.user.count()

  initializeSocket(server)
  registerOverdueJob()

  server.listen(env.PORT, () => {
    console.log(`API server listening on port ${env.PORT}`)
  })
}

boot().catch(async (error) => {
  console.error('Failed to start API server', error)
  await prisma.$disconnect()
  process.exit(1)
})

const shutdown = async () => {
  await prisma.$disconnect()
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
