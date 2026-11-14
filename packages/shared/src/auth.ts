import { z } from 'zod'
import { roleSchema } from './roles'

/**
 * Input rules for the sign-up and sign-in forms. The web app validates with these
 * before sending, and the server enforces the same limits in better-auth's config.
 */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export const signInSchema = z.object({
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
})
export type SignInInput = z.infer<typeof signInSchema>

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(60, 'Name must be at most 60 characters'),
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`),
})
export type SignUpInput = z.infer<typeof signUpSchema>

/** The user object the API exposes. Never includes credentials or session data. */
export const publicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: roleSchema,
})
export type PublicUser = z.infer<typeof publicUserSchema>
