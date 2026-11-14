import { env, isProduction } from './config/env'
import { buildApp } from './app'
import { prisma } from './db/prisma'
import { createSocketServer } from './realtime/socket'

const app = await buildApp({
  logger: isProduction
    ? { level: 'info' }
    : { level: 'debug', transport: { target: 'pino-pretty', options: { ignore: 'pid,hostname' } } },
})

createSocketServer(app)

/** Close sockets, HTTP and the database pool cleanly on Ctrl+C or a container stop. */
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
  // e.g. EADDRINUSE: log through stderr directly — the pretty-print logger runs in a
  // worker thread and can lose its last lines when the process exits right away.
  console.error(`Failed to start the server on port ${env.PORT}:`, err)
  process.exit(1)
}
