import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { settlePaymentByTrackId } from "@/lib/payments/settle";
import { describeZibalStatus } from "@/lib/payments/zibal";

// بازگشت کاربر از درگاه زیبال.
// زیبال کاربر را با ریدایرکت مرورگر به این آدرس برمی‌گرداند، پس روی localhost هم کار می‌کند.

function resultRedirect(request: Request, params: Record<string, string>) {
  const base = process.env.APP_URL || new URL(request.url).origin;
  const url = new URL("/payment/result", base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const trackId = url.searchParams.get("trackId");
  const success = url.searchParams.get("success");
  const statusParam = url.searchParams.get("status");

  if (!trackId) {
    return resultRedirect(request, {
      state: "error",
      message: "اطلاعات بازگشتی از درگاه ناقص بود.",
    });
  }

  // کاربر پرداخت را لغو کرده یا تراکنش ناموفق بوده است
  if (success === "0") {
    const status = statusParam ? Number(statusParam) : null;
    await prisma.payment
      .updateMany({
        where: { trackId, status: { not: "verified" } },
        data: {
          status: status === 3 ? "canceled" : "failed",
          zibalStatus: status,
          failureReason: describeZibalStatus(status),
        },
      })
      .catch(() => undefined);

    const payment = await prisma.payment.findUnique({
      where: { trackId },
      select: { consultationId: true },
    });

    return resultRedirect(request, {
      state: "failed",
      message: describeZibalStatus(status),
      ...(payment ? { consultationId: payment.consultationId } : {}),
    });
  }

  const settled = await settlePaymentByTrackId(trackId);

  if (!settled.ok) {
    return resultRedirect(request, {
      state: "failed",
      message: settled.error,
      ...(settled.consultationId ? { consultationId: settled.consultationId } : {}),
    });
  }

  return resultRedirect(request, {
    state: "success",
    consultationId: settled.consultationId,
  });
}
