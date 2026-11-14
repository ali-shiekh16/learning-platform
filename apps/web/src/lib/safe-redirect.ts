/**
 * Only follow redirects to paths inside this app.
 */
export function safeRedirect(target: string | null, fallback = '/'): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return fallback
  return target
}
