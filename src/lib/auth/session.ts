import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/constants";
import { signSession, verifySession, type SessionPayload } from "@/lib/auth/jwt";

// کمک‌تابع‌های نشست برای Server Component ها و Route Handler ها.
// همیشه وضعیت کاربر از دیتابیس هم بررسی می‌شود تا مسدودسازی فوری اثر کند.

export type CurrentUser = {
  id: string;
  phone: string;
  fullName: string | null;
  role: "user" | "admin";
};

export async function createSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/// کاربر فعلی یا null. کاربران مسدودشده و حذف‌شده null برمی‌گردانند.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, phone: true, fullName: true, role: true, isBlocked: true },
  });
  if (!user || user.isBlocked) return null;

  return {
    id: user.id,
    phone: user.phone,
    fullName: user.fullName,
    role: user.role === "admin" ? "admin" : "user",
  };
}

/// برای صفحه‌ها: در صورت نبود نشست به صفحه ورود هدایت می‌کند
export async function requireUserPage(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login";
    redirect(target);
  }
  return user;
}

/// برای صفحه‌های پنل ادمین
export async function requireAdminPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fadmin");
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
