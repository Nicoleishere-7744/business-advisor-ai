import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { hashOtp, safeEqual } from "@/lib/crypto";
import { toLatinDigits } from "@/lib/phone";
import { resetRateLimit } from "@/lib/ratelimit";
import { createSessionCookie } from "@/lib/auth/session";
import { OTP_LENGTH, OTP_MAX_ATTEMPTS } from "@/lib/constants";
import {
  assertSameOrigin,
  jsonError,
  jsonOk,
  readJson,
  serverError,
  zodError,
} from "@/lib/api";

// تأیید کد ورود و ساخت نشست

const schema = z.object({
  phone: z.string().min(1, { message: "شماره موبایل را وارد کنید." }),
  code: z.string().min(1, { message: "کد ورود را وارد کنید." }),
});

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  try {
    const body = await readJson(request);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return zodError(parsed.error);

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) return jsonError("شماره موبایل معتبر نیست.", 422, { field: "phone" });

    const code = toLatinDigits(parsed.data.code).replace(/\D/g, "");
    if (code.length !== OTP_LENGTH) {
      return jsonError("کد ورود معتبر نیست.", 422, { field: "code" });
    }

    const otp = await prisma.otpCode.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return jsonError("کدی برای این شماره ثبت نشده است. دوباره درخواست کد بدهید.", 400);
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      return jsonError("کد ورود منقضی شده است. کد جدید بگیرید.", 400);
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      return jsonError("تعداد تلاش‌های ناموفق زیاد بود. کد جدید بگیرید.", 429);
    }

    if (!safeEqual(otp.codeHash, hashOtp(phone, code))) {
      const updated = await prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });
      const remaining = Math.max(0, OTP_MAX_ATTEMPTS - updated.attempts);
      return jsonError(
        remaining > 0
          ? `کد وارد شده درست نیست. ${remaining} تلاش دیگر باقی مانده است.`
          : "تعداد تلاش‌های ناموفق زیاد بود. کد جدید بگیرید.",
        400,
        { field: "code" },
      );
    }

    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    // اولین ورود، ثبت‌نام هم هست
    const user = await prisma.user.upsert({
      where: { phone },
      create: { phone, lastLoginAt: new Date() },
      update: { lastLoginAt: new Date() },
      select: { id: true, phone: true, role: true, isBlocked: true, fullName: true },
    });

    if (user.isBlocked) {
      return jsonError("دسترسی این شماره مسدود شده است.", 403);
    }

    await createSessionCookie({
      userId: user.id,
      phone: user.phone,
      role: user.role === "admin" ? "admin" : "user",
    });

    await resetRateLimit(`otp:cooldown:${phone}`);
    await resetRateLimit(`otp:phone:${phone}`);

    return jsonOk({
      user: { id: user.id, phone: user.phone, fullName: user.fullName, role: user.role },
      isAdmin: user.role === "admin",
    });
  } catch (error) {
    return serverError("auth/otp/verify", error);
  }
}
