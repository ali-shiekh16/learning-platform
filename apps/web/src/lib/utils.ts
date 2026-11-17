export { cn } from 'cn'

/** "Tara Teacher" → "TT", for avatars. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
