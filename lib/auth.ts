/**
 * Authentication is intentionally disabled for the public sales demo.
 *
 * These exports remain only as compatibility shims for legacy server-action
 * imports. They perform no credential, cookie, token, or session work.
 */
export function createSessionToken(): string {
  return "open-demo";
}

export function verifySessionToken(_token?: string): boolean {
  return true;
}

export async function isAuthenticated(): Promise<boolean> {
  return true;
}

export async function requireSession(): Promise<void> {}

export async function setSessionCookie(): Promise<void> {}

export async function clearSessionCookie(): Promise<void> {}

export function demoCredentialsMatch(_email: string, _password: string): boolean {
  return true;
}
