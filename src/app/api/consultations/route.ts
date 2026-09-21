import { prisma } from "@/lib/db";
import { getActiveFormFields } from "@/lib/consultation";
import { buildFormSchema } from "@/lib/validation/dynamic-form";
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

// ثبت یک درخواست مشاوره جدید (هنوز پرداخت نشده)

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const limit = await checkRateLimit(`consultation:create:${auth.user.id}`, 10, 3600);
    if (!limit.allowed) {
      return jsonError("تعداد درخواست‌های ثبت‌شده زیاد است. کمی بعد تلاش کنید.", 429);
    }

    const body = await readJson(request);
    if (!body || typeof body !== "object") {
      return jsonError("داده ارسالی معتبر نیست.", 400);
    }

    const fields = await getActiveFormFields();
    if (fields.length === 0) {
      return jsonError("فرم مشاوره هنوز پیکربندی نشده است. با پشتیبانی تماس بگیرید.", 503);
    }

    // اعتبارسنجی نهایی همیشه سمت سرور و بر اساس فیلدهای فعالِ همین لحظه انجام می‌شود
    const schema = buildFormSchema(fields);
    const parsed = schema.safeParse((body as { answers?: unknown }).answers ?? {});
    if (!parsed.success) return zodError(parsed.error);

    const answers = parsed.data as Record<string, unknown>;
    const titleField = fields.find((field) => field.type === "text") ?? fields[0];
    const rawTitle = titleField ? answers[titleField.key] : undefined;
    const title = typeof rawTitle === "string" && rawTitle.trim() ? rawTitle.trim() : null;

    const consultation = await prisma.consultation.create({
      data: {
        userId: auth.user.id,
        status: "awaiting_payment",
        answersJson: JSON.stringify(answers),
        // اسنپ‌شات فیلدها تا تغییرات بعدی فرم، گزارش‌های قدیمی را خراب نکند
        fieldsSnapshot: JSON.stringify(fields),
        title,
      },
      select: { id: true },
    });

    return jsonOk({ consultationId: consultation.id });
  } catch (error) {
    return serverError("consultations/create", error);
  }
}
