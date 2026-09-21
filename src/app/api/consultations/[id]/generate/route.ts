import { prisma } from "@/lib/db";
import { canGenerate, streamConsultationReport } from "@/lib/consultation";
import { AiConfigError } from "@/lib/ai/openrouter";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/constants";
import { checkRateLimit } from "@/lib/ratelimit";
import { assertSameOrigin, jsonError, requireApiUser, serverError } from "@/lib/api";

// تولید گزارش مشاوره به‌صورت استریم متنی.
// نوشتن نتیجه در دیتابیس مستقل از اتصال کلاینت انجام می‌شود.

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const { id } = await params;

    const consultation = await prisma.consultation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        generationStartedAt: true,
        payment: { select: { status: true } },
      },
    });

    if (!consultation || consultation.userId !== auth.user.id) {
      return jsonError("مشاوره موردنظر پیدا نشد.", 404);
    }

    // بدون پرداخت تأییدشده هیچ گزارشی تولید نمی‌شود
    if (consultation.payment?.status !== "verified") {
      return jsonError("برای دریافت گزارش ابتدا باید پرداخت را کامل کنید.", 403);
    }

    if (consultation.status === "completed") {
      return jsonError("گزارش این مشاوره قبلاً تولید شده است.", 409);
    }

    if (!canGenerate(consultation)) {
      return jsonError("تولید گزارش در حال انجام است. چند لحظه صبر کنید.", 409);
    }

    const limit = await checkRateLimit(`generate:${auth.user.id}`, 20, 3600);
    if (!limit.allowed) {
      return jsonError("تعداد درخواست‌های تولید گزارش زیاد بود. کمی بعد تلاش کنید.", 429);
    }

    // پیش از باز کردن استریم بررسی می‌کنیم؛ در غیر این‌صورت خطا وسط گزارش ظاهر می‌شود
    if (!(await getSetting(SETTING_KEYS.openrouterApiKey))) {
      return jsonError(
        "سرویس هوش مصنوعی هنوز پیکربندی نشده است. با پشتیبانی تماس بگیرید.",
        503,
      );
    }

    const stream = await streamConsultationReport({
      consultationId: consultation.id,
      userId: auth.user.id,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof AiConfigError) {
      return jsonError(error.message, 503);
    }
    return serverError("consultations/generate", error);
  }
}
