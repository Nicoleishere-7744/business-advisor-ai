import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";

// کمک‌تابع‌های مشترک Route Handler ها: پاسخ استاندارد، گارد احراز هویت و بررسی Origin.

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function zodError(error: ZodError) {
  const first = error.issues[0];
  return jsonError(first?.message ?? "ورودی نامعتبر است.", 422, {
    field: first?.path?.join("."),
  });
}

/// خطاهای غیرمنتظره را لاگ می‌کند ولی جزئیات را به کلاینت نمی‌دهد
export function serverError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
  return jsonError("خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.", 500);
}

/**
 * محافظت CSRF: درخواست‌های تغییردهنده باید از همین دامنه بیایند.
 * همراه با کوکی SameSite=Lax لایه دوم دفاع است.
 */
export function assertSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null; // درخواست‌های غیرمرورگری (مثل curl در تست) هدر Origin ندارند

  const allowed = new Set<string>();
  const appUrl = process.env.APP_URL;
  if (appUrl) allowed.add(new URL(appUrl).origin);
  allowed.add(new URL(request.url).origin);

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) allowed.add(`${forwardedProto}://${forwardedHost}`);

  if (!allowed.has(origin)) {
    return jsonError("درخواست از مبدأ نامعتبر رد شد.", 403);
  }
  return null;
}

export type AuthedContext = { user: CurrentUser };

/// اگر کاربر وارد نشده باشد پاسخ ۴۰۱ برمی‌گرداند
export async function requireApiUser(): Promise<
  { ok: true; user: CurrentUser } | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, response: jsonError("برای ادامه باید وارد شوید.", 401) };
  }
  return { ok: true, user };
}

/// اگر کاربر ادمین نباشد پاسخ ۴۰۱/۴۰۳ برمی‌گرداند
export async function requireApiAdmin(): Promise<
  { ok: true; user: CurrentUser } | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, response: jsonError("برای ادامه باید وارد شوید.", 401) };
  }
  if (user.role !== "admin") {
    return { ok: false, response: jsonError("دسترسی مدیریتی ندارید.", 403) };
  }
  return { ok: true, user };
}

/// IP کاربر پشت پراکسی/CDN
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/// بدنه JSON را می‌خواند و در صورت خرابی null برمی‌گرداند
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
