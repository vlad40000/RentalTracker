import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo";

const COOKIE_NAME = "rental_demo_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function secret(): string {
  const value = process.env.DEMO_AUTH_SECRET;
  if (!value || value.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DEMO_AUTH_SECRET must contain at least 32 characters");
    }
    return "local-demo-secret-change-before-production-123456";
  }
  return value;
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSessionToken(): string {
  const payload = Buffer.from(JSON.stringify({ sub: "demo-owner", exp: Date.now() + MAX_AGE_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, received] = token.split(".");
  if (!payload || !received || !safeEqual(signature(payload), received)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; exp?: number };
    return decoded.sub === "demo-owner" && typeof decoded.exp === "number" && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  if (isDemoMode()) return true;
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

export async function requireSession(): Promise<void> {
  if (isDemoMode()) return;
  if (!(await isAuthenticated())) redirect("/login");
}

export async function setSessionCookie(): Promise<void> {
  if (isDemoMode()) return;
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  if (isDemoMode()) return;
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export function demoCredentialsMatch(email: string, password: string): boolean {
  if (isDemoMode()) return true;
  const expectedEmail = process.env.DEMO_OWNER_EMAIL ?? "owner@example.com";
  const expectedPassword = process.env.DEMO_OWNER_PASSWORD ?? "demo-only-change-me";
  return safeEqual(email.trim().toLowerCase(), expectedEmail.toLowerCase()) && safeEqual(password, expectedPassword);
}
