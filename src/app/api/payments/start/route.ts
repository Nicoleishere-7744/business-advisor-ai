import { z } from "zod";
import { prisma } from "@/lib/db";
import { requestPayment } from "@/lib/payments/zibal";
import { isDiscountError, quoteConsultation, ZIBAL_MIN_AMOUNT_RIAL } from "@/lib/pricing";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  assertSameOrigin,
  jsonError,
  jsonOk,
  readJson,
  requireApiUser,
  serverError,
  zodError,
} from "@/lib/api";

// شروع پرداخت یک مشاوره: قیمت‌گذاری، ساخت تراکنش و گرفتن لینک درگاه

const schema = z.object({
  consultationId: z.string().min(1),
  discountCode: z.string().trim().max(64).optional(),
});

function callbackUrl(request: Request): string {
  const base = process.env.APP_URL || new URL(request.url).origin;
  return `${base.replace(/\/+$/, "")}/api/payments/callback`;
}

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const limit = await checkRateLimit(`payment:start:${auth.user.id}`, 20, 3600);
    if (!limit.allowed) {
      return jsonError("تعداد تلاش‌های پرداخت زیاد است. کمی بعد دوباره تلاش کنید.", 429);
    }

    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) return zodError(parsed.error);

    const consultation = await prisma.consultation.findUnique({
      where: { id: parsed.data.consultationId },
      include: { payment: true },
    });

    if (!consultation || consultation.userId !== auth.user.id) {
      return jsonError("مشاوره موردنظر پیدا نشد.", 404);
    }
    if (consultation.status !== "awaiting_payment") {
      return jsonError("این مشاوره قبلاً پرداخت شده است.", 409);
    }
    if (consultation.payment?.status === "verified") {
      return jsonError("پرداخت این مشاوره قبلاً تأیید شده است.", 409);
    }

    const quote = await quoteConsultation(parsed.data.discountCode);
    if (isDiscountError(quote)) {
      return jsonError(quote.error, 422, { field: "discountCode" });
    }

    // تخفیف کامل: بدون رفتن به درگاه، مشاوره آزاد می‌شود
    if (quote.finalAmount < ZIBAL_MIN_AMOUNT_RIAL) {
      await prisma.$transaction(async (tx) => {
        await tx.payment.upsert({
          where: { consultationId: consultation.id },
          create: {
            userId: auth.user.id,
            consultationId: consultation.id,
            amount: 0,
            originalAmount: quote.originalAmount,
            discountCodeId: quote.discountCodeId,
            discountAmount: quote.originalAmount,
            status: "verified",
            paidAt: new Date(),
            verifiedAt: new Date(),
          },
          update: {
            amount: 0,
            originalAmount: quote.originalAmount,
            discountCodeId: quote.discountCodeId,
            discountAmount: quote.originalAmount,
            status: "verified",
            paidAt: new Date(),
            verifiedAt: new Date(),
            failureReason: null,
          },
        });

        if (quote.discountCodeId) {
          await tx.discountCode.update({
            where: { id: quote.discountCodeId },
            data: { usedCount: { increment: 1 } },
          });
        }

        await tx.consultation.update({
          where: { id: consultation.id },
          data: { status: "paid" },
        });
      });

      return jsonOk({ free: true, redirectUrl: `/consultation/${consultation.id}` });
    }

    const payment = await prisma.payment.upsert({
      where: { consultationId: consultation.id },
      create: {
        userId: auth.user.id,
        consultationId: consultation.id,
        amount: quote.finalAmount,
        originalAmount: quote.originalAmount,
        discountCodeId: quote.discountCodeId,
        discountAmount: quote.discountAmount,
        status: "pending",
      },
      update: {
        amount: quote.finalAmount,
        originalAmount: quote.originalAmount,
        discountCodeId: quote.discountCodeId,
        discountAmount: quote.discountAmount,
        status: "pending",
        trackId: null,
        failureReason: null,
      },
    });

    const result = await requestPayment({
      amount: quote.finalAmount,
      callbackUrl: callbackUrl(request),
      orderId: payment.id,
      mobile: auth.user.phone.replace("+98", "0"),
      description: `مشاوره کسب‌وکار - ${consultation.title ?? consultation.id}`,
    });

    if (!result.ok) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "failed", failureReason: result.error, zibalResult: result.result },
      });
      return jsonError(result.error, 502);
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { trackId: result.trackId },
    });

    return jsonOk({ free: false, redirectUrl: result.startUrl, amount: quote.finalAmount });
  } catch (error) {
    return serverError("payments/start", error);
  }
}
