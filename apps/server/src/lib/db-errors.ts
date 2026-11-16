/** Prisma's error for a unique constraint (or unique index) violation. */
export const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
