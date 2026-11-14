import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@app/shared'
import { env } from '../config/env'
import { prisma } from '../db/prisma'

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: '/api/auth',
  trustedOrigins: [env.BETTER_AUTH_URL],

  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    autoSignIn: true,
  },

  user: {
    additionalFields: {
      role: {
        // * Clients can never set the role
        type: 'string',
        required: false,
        defaultValue: 'STUDENT',
        input: false,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh the expiry at most once a day
  },

  // Counted per client IP and path; the IP comes from the X-Forwarded-For header our
  // Fastify adapter sets (see auth.routes.ts). Enabled in every environment.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 60, max: 5 },
    },
  },
})

export type AuthSession = typeof auth.$Infer.Session
