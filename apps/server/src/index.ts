import { env, isProduction } from './config/env'
import { buildApp } from './app'
import { prisma } from './db/prisma'
import { createSocketServer } from './realtime/socket'

const app = await buildApp({
  trustProxy: env.TRUST_PROXY,
  logger: isProduction
    ? { level: 'info' }
    : { level: 'debug', transport: { target: 'pino-pretty', options: { ignore: 'pid,hostname' } } },
})

createSocketServer(app)

async function shutdown(signal: string) {
  app.log.info(`${signal} received, shutting down`)
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
} catch (err) {
  console.error(`Failed to start the server on port ${env.PORT}:`, err)
  process.exit(1)
}
