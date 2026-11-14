import { z } from 'zod'

export const ROLES = ['STUDENT', 'TEACHER'] as const

export const roleSchema = z.enum(ROLES)
export type Role = z.infer<typeof roleSchema>

export const isTeacher = (role: string): boolean => role === 'TEACHER'
