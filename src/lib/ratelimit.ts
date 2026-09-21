import { prisma } from "@/lib/db";

// محدودسازی نرخ با پنجره ثابت، ذخیره‌شده در دیتابیس.
// روی SQLite و Postgres یکسان کار می‌کند و به Redis نیاز ندارد.

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /// ثانیه‌های باقی‌مانده تا باز شدن پنجره
  retryAfterSeconds: number;
};

/**
 * @param key شناسه یکتای محدودیت، مثلاً `otp:+989121234567`
 * @param limit حداکثر تعداد مجاز در پنجره
 * @param windowSeconds طول پنجره به ثانیه
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  const windowExpired =
    !existing || now.getTime() - existing.windowStart.getTime() >= windowSeconds * 1000;

  if (windowExpired) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  const elapsed = now.getTime() - existing.windowStart.getTime();
  const retryAfterSeconds = Math.max(1, Math.ceil((windowSeconds * 1000 - elapsed) / 1000));

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  return {
    allowed: true,
    remaining: limit - existing.count - 1,
    retryAfterSeconds,
  };
}

/// پاک کردن یک محدودیت (مثلاً بعد از ورود موفق)
export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

/// حذف پنجره‌های منقضی‌شده؛ گاه‌به‌گاه از مسیرهای پرتردد صدا زده می‌شود
export async function pruneRateLimits(olderThanSeconds = 86400): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
  await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: cutoff } } });
}
