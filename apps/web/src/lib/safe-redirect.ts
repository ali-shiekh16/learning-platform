/**
 * Only follow redirects to paths inside this app. Without this check, a link like
 * /sign-in?redirect=https://evil.example could send users to another site after
 * they sign in (an "open redirect").
 */
export function safeRedirect(target: string | null, fallback = '/'): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return fallback
  return target
}
