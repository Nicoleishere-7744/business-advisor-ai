import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildFollowUpMessages } from "@/lib/ai/prompt";
import { AiConfigError, chatCompletion } from "@/lib/ai/openrouter";
import { getDefaultModel } from "@/lib/consultation";
import { getSettingNumber } from "@/lib/settings";
import { CHAT_MESSAGE_MAX_LENGTH, SETTING_KEYS } from "@/lib/constants";
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

// چت پیگیری روی گزارش تولیدشده، با سقف تعداد پیام قابل تنظیم از پنل مدیریت

const schema = z.object({
  message: z
    .string()
    .trim()
    .min(3, { message: "سوال شما خیلی کوتاه است." })
    .max(CHAT_MESSAGE_MAX_LENGTH, { message: "سوال شما بیش از حد طولانی است." }),
});

export const maxDuration = 120;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) return zodError(parsed.error);

    const { id } = await params;

    const consultation = await prisma.consultation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        reportMarkdown: true,
        modelSlug: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!consultation || consultation.userId !== auth.user.id) {
      return jsonError("مشاوره موردنظر پیدا نشد.", 404);
    }
    if (consultation.status !== "completed" || !consultation.reportMarkdown) {
      return jsonError("ابتدا باید گزارش مشاوره تولید شود.", 409);
    }

    const limit = await getSettingNumber(SETTING_KEYS.followupMessageLimit, 5);
    const asked = consultation.messages.filter((message) => message.role === "user").length;
    if (asked >= limit) {
      return jsonError(
        `سقف ${limit} سوال پیگیری برای این مشاوره تکمیل شده است. برای بررسی بیشتر مشاوره جدیدی ثبت کنید.`,
        429,
      );
    }

    const rate = await checkRateLimit(`chat:${auth.user.id}`, 30, 3600);
    if (!rate.allowed) {
      return jsonError("تعداد پیام‌ها در ساعت گذشته زیاد بود. کمی بعد تلاش کنید.", 429);
    }

    const model = await getDefaultModel();
    const modelSlug = consultation.modelSlug ?? model?.modelSlug;
    if (!modelSlug) {
      return jsonError("مدل هوش مصنوعی فعالی تنظیم نشده است.", 503);
    }

    const startedAt = Date.now();
    const result = await chatCompletion({
      model: modelSlug,
      messages: buildFollowUpMessages({
        report: consultation.reportMarkdown,
        history: consultation.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        question: parsed.data.message,
      }),
      temperature: model?.temperature ?? 0.6,
      maxTokens: Math.min(model?.maxTokens ?? 2000, 2000),
    });

    const [, assistantMessage] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: { consultationId: consultation.id, role: "user", content: parsed.data.message },
      }),
      prisma.chatMessage.create({
        data: { consultationId: consultation.id, role: "assistant", content: result.content },
      }),
    ]);

    await prisma.aiUsageLog.create({
      data: {
        userId: auth.user.id,
        consultationId: consultation.id,
        modelSlug,
        kind: "chat",
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        costUsd: result.usage.costUsd,
        generationId: result.usage.generationId,
        latencyMs: Date.now() - startedAt,
        success: true,
      },
    });

    return jsonOk({
      answer: result.content,
      messageId: assistantMessage.id,
      remaining: Math.max(0, limit - asked - 1),
    });
  } catch (error) {
    if (error instanceof AiConfigError) {
      return jsonError(error.message, 503);
    }
    return serverError("consultations/chat", error);
  }
}
