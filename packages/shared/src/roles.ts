import { z } from 'zod'

/**
 * The two roles in the platform. Stored as a plain string column in the database
 * (see ADR 006 for why it is not a Prisma enum) and narrowed with this schema.
 */
export const ROLES = ['STUDENT', 'TEACHER'] as const

export const roleSchema = z.enum(ROLES)
export type Role = z.infer<typeof roleSchema>

export const isTeacher = (role: string): boolean => role === 'TEACHER'
