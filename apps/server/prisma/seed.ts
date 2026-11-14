/**
 * Seed demo accounts. Safe to run repeatedly: existing accounts are left alone.
 *
 *   npm run db:seed -w @app/server
 *
 * Users are created through better-auth (so passwords are hashed exactly as on
 * real sign-up). Teachers then get their role with a direct database update,
 * because `role` is marked `input: false` — not even better-auth's own API may set it.
 */
import type { Role } from '@app/shared'
import { auth } from '../src/auth/auth'
import { prisma } from '../src/db/prisma'

const DEMO_PASSWORD = 'password123'

const DEMO_USERS: { name: string; email: string; role: Role }[] = [
  { name: 'Tara Teacher', email: 'teacher@demo.test', role: 'TEACHER' },
  { name: 'Theo Teacher', email: 'teacher2@demo.test', role: 'TEACHER' },
  { name: 'Sam Student', email: 'student@demo.test', role: 'STUDENT' },
  { name: 'Sara Student', email: 'student2@demo.test', role: 'STUDENT' },
  { name: 'Sid Student', email: 'student3@demo.test', role: 'STUDENT' },
]

async function seed() {
  for (const demo of DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: demo.email } })
    if (existing) {
      console.log(`• ${demo.email} already exists`)
      continue
    }

    const { user } = await auth.api.signUpEmail({
      body: { name: demo.name, email: demo.email, password: DEMO_PASSWORD },
    })

    if (demo.role !== 'STUDENT')
      await prisma.user.update({ where: { id: user.id }, data: { role: demo.role } })

    console.log(`✓ ${demo.email} (${demo.role})`)
  }
  console.log(`\nAll demo accounts use the password: ${DEMO_PASSWORD}`)
}

seed()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
