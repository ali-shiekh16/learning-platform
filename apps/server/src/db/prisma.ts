import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { env } from '../config/env'

/**
 * One Prisma client for the whole process. Prisma 7 talks to Postgres through a
 * driver adapter (node-postgres here) instead of a bundled query engine binary.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })

export const prisma = new PrismaClient({ adapter })
