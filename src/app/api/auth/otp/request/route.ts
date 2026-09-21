import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { generateNumericCode, hashOtp } from "@/lib/crypto";
import { checkRateLimit, pruneRateLimits } from "@/lib/ratelimit";
import { sendOtpSms } from "@/lib/sms/ippanel";
import {
  OTP_LENGTH,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
} from "@/lib/constants";
import {
  assertSameOrigin,
  getClientIp,
  jsonError,
  jsonOk,
  readJson,
  serverError,
  zodError,
} from "@/lib/api";

// درخواست کد ورود یک‌بارمصرف

const schema = z.object({
  phone: z.string().min(1, { message: "شماره موبایل را وارد کنید." }),
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

    const ip = getClientIp(request);

    // سه لایه محدودیت: فاصله بین ارسال‌ها، سقف ساعتی هر شماره، سقف ساعتی هر IP
    const cooldown = await checkRateLimit(`otp:cooldown:${phone}`, 1, OTP_RESEND_COOLDOWN_SECONDS);
    if (!cooldown.allowed) {
      return jsonError(
        `برای درخواست کد جدید ${cooldown.retryAfterSeconds} ثانیه صبر کنید.`,
        429,
        { retryAfter: cooldown.retryAfterSeconds },
      );
    }

    const hourlyPhone = await checkRateLimit(`otp:phone:${phone}`, 5, 3600);
    if (!hourlyPhone.allowed) {
      return jsonError("تعداد درخواست‌های کد برای این شماره زیاد بود. یک ساعت دیگر تلاش کنید.", 429);
    }

    const hourlyIp = await checkRateLimit(`otp:ip:${ip}`, 20, 3600);
    if (!hourlyIp.allowed) {
      return jsonError("تعداد درخواست‌ها از این دستگاه زیاد بود. بعداً تلاش کنید.", 429);
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (user?.isBlocked) {
      return jsonError("دسترسی این شماره مسدود شده است. با پشتیبانی تماس بگیرید.", 403);
    }

    const code = generateNumericCode(OTP_LENGTH);

    // کدهای قبلی همین شماره باطل می‌شوند تا فقط آخرین کد معتبر بماند
    await prisma.otpCode.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    await prisma.otpCode.create({
      data: {
        phone,
        codeHash: hashOtp(phone, code),
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
        ip,
      },
    });

    const result = await sendOtpSms(phone, code);
    if (!result.ok) {
      return jsonError(result.error ?? "ارسال پیامک ناموفق بود.", 502);
    }

    void pruneRateLimits().catch(() => undefined);

    return jsonOk({
      expiresIn: OTP_TTL_SECONDS,
      resendAfter: OTP_RESEND_COOLDOWN_SECONDS,
      /// در حالت توسعه به کلاینت اعلام می‌کنیم کد در کنسول سرور چاپ شده است
      devMode: result.simulated,
    });
  } catch (error) {
    return serverError("auth/otp/request", error);
  }
}
