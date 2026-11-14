import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@app/shared'
import { env } from '../config/env'
import { prisma } from '../db/prisma'

/**
 * better-auth handles *authentication*: password hashing, sessions stored in
 * Postgres, the session cookie, CSRF/origin checks and sign-in rate limiting.
 * *Authorization* (who may do what) is our own code — see ./guards.ts.
 */
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
        type: 'string',
        required: false,
        defaultValue: 'STUDENT',
        // Clients can never set the role, at sign-up or afterwards. Without this,
        // anyone could register as a teacher by adding `role` to the request body.
        input: false,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh the expiry at most once a day
  },

  // better-auth only enables this in production by default. We enable it in development
  // too so the behaviour is visible locally, and disable it for the automated tests,
  // which create many accounts in quick succession.
  rateLimit: {
    enabled: env.NODE_ENV !== 'test',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 60, max: 5 },
    },
  },
})

export type AuthSession = typeof auth.$Infer.Session
