import "server-only";
import { prisma } from "@/lib/db";
import { describeZibalStatus, verifyPayment } from "@/lib/payments/zibal";

// تأیید نهایی و تسویه یک تراکنش.
// هم از کال‌بک درگاه و هم از دکمه «وریفای مجدد» پنل مدیریت استفاده می‌شود.
// عملیات ایدمپوتنت است: فراخوانی دوباره وضعیت را خراب نمی‌کند و کد تخفیف را دوباره مصرف نمی‌کند.

export type SettleResult =
  | { ok: true; alreadySettled: boolean; consultationId: string }
  | { ok: false; error: string; consultationId?: string };

export async function settlePaymentByTrackId(trackId: string): Promise<SettleResult> {
  const payment = await prisma.payment.findUnique({
    where: { trackId },
    include: { consultation: { select: { id: true, status: true } } },
  });

  if (!payment) {
    return { ok: false, error: "تراکنش موردنظر پیدا نشد." };
  }

  if (payment.status === "verified") {
    return { ok: true, alreadySettled: true, consultationId: payment.consultationId };
  }

  const verification = await verifyPayment(trackId);

  if (!verification.ok) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "failed",
        zibalResult: verification.result,
        zibalStatus: verification.status,
        failureReason:
          verification.error ?? describeZibalStatus(verification.status) ?? "پرداخت ناموفق بود.",
      },
    });
    return {
      ok: false,
      error: verification.error ?? "پرداخت ناموفق بود.",
      consultationId: payment.consultationId,
    };
  }

  // بررسی تطابق مبلغ: جلوگیری از دستکاری مبلغ در مسیر پرداخت
  if (verification.amount !== undefined && verification.amount !== payment.amount) {
    console.error("[payment] amount mismatch", {
      paymentId: payment.id,
      expected: payment.amount,
      received: verification.amount,
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "failed",
        zibalResult: verification.result,
        zibalStatus: verification.status,
        failureReason: "مبلغ تأییدشده با مبلغ سفارش هم‌خوانی ندارد.",
      },
    });
    return {
      ok: false,
      error: "مبلغ تأییدشده با مبلغ سفارش هم‌خوانی ندارد. با پشتیبانی تماس بگیرید.",
      consultationId: payment.consultationId,
    };
  }

  const settledAt = new Date();

  // گذار وضعیت به‌صورت شرطی انجام می‌شود تا در فراخوانی همزمان فقط یک‌بار اثر کند
  const updated = await prisma.payment.updateMany({
    where: { id: payment.id, status: { not: "verified" } },
    data: {
      status: "verified",
      refNumber: verification.refNumber,
      cardNumber: verification.cardNumber,
      zibalResult: verification.result,
      zibalStatus: verification.status,
      paidAt: verification.paidAt ?? settledAt,
      verifiedAt: settledAt,
      failureReason: null,
    },
  });

  if (updated.count === 0) {
    // یک درخواست دیگر همزمان تسویه را انجام داده است
    return { ok: true, alreadySettled: true, consultationId: payment.consultationId };
  }

  await prisma.$transaction(async (tx) => {
    if (payment.discountCodeId) {
      await tx.discountCode.update({
        where: { id: payment.discountCodeId },
        data: { usedCount: { increment: 1 } },
      });
    }
    // فقط از حالت «در انتظار پرداخت» جلو می‌رویم تا گزارش تولیدشده بازنویسی نشود
    await tx.consultation.updateMany({
      where: { id: payment.consultationId, status: "awaiting_payment" },
      data: { status: "paid" },
    });
  });

  return { ok: true, alreadySettled: false, consultationId: payment.consultationId };
}
