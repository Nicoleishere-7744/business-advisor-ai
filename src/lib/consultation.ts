import "server-only";
import { prisma } from "@/lib/db";
import {
  buildConsultationMessages,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_TEMPLATE,
  type AnswerValue,
} from "@/lib/ai/prompt";
import {
  AiConfigError,
  streamChatCompletion,
  type AiUsage,
  type ChatMessage,
} from "@/lib/ai/openrouter";
import { toFieldDefinition, type FormFieldDefinition } from "@/lib/validation/dynamic-form";
import { GENERATION_STALE_MS } from "@/lib/constants";

// منطق مشترک تولید گزارش مشاوره.
// نکته کلیدی: نوشتن نتیجه در دیتابیس مستقل از اتصال کلاینت انجام می‌شود؛
// اگر کاربر وسط استریم صفحه را ببندد، گزارش باز هم کامل ذخیره می‌شود.

export async function getActiveFormFields(): Promise<FormFieldDefinition[]> {
  const rows = await prisma.formField.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toFieldDefinition);
}

export async function getActivePromptTemplate() {
  const template = await prisma.promptTemplate.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  return (
    template ?? {
      id: null,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      userTemplate: DEFAULT_USER_TEMPLATE,
    }
  );
}

export async function getDefaultModel() {
  const model =
    (await prisma.aiModelConfig.findFirst({ where: { isActive: true, isDefault: true } })) ??
    (await prisma.aiModelConfig.findFirst({
      where: { isActive: true },
      orderBy: { order: "asc" },
    }));
  return model;
}

export function parseAnswers(answersJson: string): Record<string, AnswerValue> {
  try {
    const parsed = JSON.parse(answersJson);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, AnswerValue>) : {};
  } catch {
    return {};
  }
}

/// اسنپ‌شات فیلدها در لحظه ثبت مشاوره (تا تغییرات بعدی فرم گزارش‌های قدیمی را خراب نکند)
export function parseFieldsSnapshot(snapshot: string | null): FormFieldDefinition[] {
  if (!snapshot) return [];
  try {
    const parsed = JSON.parse(snapshot);
    return Array.isArray(parsed) ? (parsed as FormFieldDefinition[]) : [];
  } catch {
    return [];
  }
}

/// آیا این مشاوره در وضعیتی هست که بتوان برایش گزارش تولید کرد؟
export function canGenerate(consultation: {
  status: string;
  generationStartedAt: Date | null;
}): boolean {
  if (consultation.status === "paid" || consultation.status === "failed") return true;
  if (consultation.status === "generating") {
    const startedAt = consultation.generationStartedAt?.getTime() ?? 0;
    return Date.now() - startedAt > GENERATION_STALE_MS;
  }
  return false;
}

export type PreparedGeneration = {
  messages: ChatMessage[];
  modelSlug: string;
  temperature: number;
  maxTokens: number;
  promptTemplateId: string | null;
};

export async function prepareGeneration(consultationId: string): Promise<PreparedGeneration> {
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
  });
  if (!consultation) throw new Error("مشاوره یافت نشد.");

  const model = await getDefaultModel();
  if (!model) {
    throw new AiConfigError("هیچ مدل هوش مصنوعی فعالی در پنل مدیریت تعریف نشده است.");
  }

  const template = await getActivePromptTemplate();
  const snapshot = parseFieldsSnapshot(consultation.fieldsSnapshot);
  const fields = snapshot.length > 0 ? snapshot : await getActiveFormFields();

  const messages = buildConsultationMessages({
    systemPrompt: template.systemPrompt,
    userTemplate: template.userTemplate,
    fields: fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
    })),
    answers: parseAnswers(consultation.answersJson),
  });

  return {
    messages,
    // اگر ادمین برای این مشاوره مدل خاصی ثبت کرده باشد همان مقدم است
    modelSlug: consultation.modelSlug ?? model.modelSlug,
    temperature: model.temperature,
    maxTokens: model.maxTokens,
    promptTemplateId: "id" in template ? template.id : null,
  };
}

async function logUsage(params: {
  userId: string;
  consultationId: string;
  modelSlug: string;
  usage: AiUsage;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}) {
  await prisma.aiUsageLog.create({
    data: {
      userId: params.userId,
      consultationId: params.consultationId,
      modelSlug: params.modelSlug,
      kind: "report",
      promptTokens: params.usage.promptTokens,
      completionTokens: params.usage.completionTokens,
      totalTokens: params.usage.totalTokens,
      costUsd: params.usage.costUsd,
      generationId: params.usage.generationId,
      latencyMs: params.latencyMs,
      success: params.success,
      errorMessage: params.errorMessage,
    },
  });
}

/**
 * گزارش را تولید می‌کند و به‌صورت متن ساده استریم می‌کند.
 * جریان تولید در پس‌زمینه ادامه پیدا می‌کند حتی اگر کلاینت قطع شود.
 */
export async function streamConsultationReport(params: {
  consultationId: string;
  userId: string;
}): Promise<ReadableStream<Uint8Array>> {
  const prepared = await prepareGeneration(params.consultationId);

  await prisma.consultation.update({
    where: { id: params.consultationId },
    data: {
      status: "generating",
      modelSlug: prepared.modelSlug,
      promptTemplateId: prepared.promptTemplateId,
      generationStartedAt: new Date(),
      errorMessage: null,
    },
  });

  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let clientGone = false;

  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
    cancel() {
      // کاربر صفحه را بست؛ تولید در پس‌زمینه ادامه می‌یابد
      clientGone = true;
    },
  });

  const push = (text: string) => {
    if (clientGone || !controller) return;
    try {
      controller.enqueue(encoder.encode(text));
    } catch {
      clientGone = true;
    }
  };

  const close = () => {
    if (clientGone || !controller) return;
    try {
      controller.close();
    } catch {
      // قبلاً بسته شده
    }
  };

  // اجرای جداشده: منتظر کلاینت نمی‌ماند
  void (async () => {
    const startedAt = Date.now();
    let content = "";
    let usage: AiUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
    };

    try {
      for await (const event of streamChatCompletion({
        model: prepared.modelSlug,
        messages: prepared.messages,
        temperature: prepared.temperature,
        maxTokens: prepared.maxTokens,
      })) {
        if (event.type === "delta") {
          content += event.text;
          push(event.text);
        } else {
          usage = event.usage;
        }
      }

      if (!content.trim()) {
        throw new Error("پاسخ خالی از سرویس هوش مصنوعی دریافت شد.");
      }

      await prisma.consultation.update({
        where: { id: params.consultationId },
        data: {
          status: "completed",
          reportMarkdown: content,
          completedAt: new Date(),
          errorMessage: null,
        },
      });

      await logUsage({
        userId: params.userId,
        consultationId: params.consultationId,
        modelSlug: prepared.modelSlug,
        usage,
        latencyMs: Date.now() - startedAt,
        success: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "خطای ناشناخته در تولید گزارش.";
      console.error("[consultation] generation failed", error);

      await prisma.consultation
        .update({
          where: { id: params.consultationId },
          data: { status: "failed", errorMessage: message },
        })
        .catch(() => undefined);

      await logUsage({
        userId: params.userId,
        consultationId: params.consultationId,
        modelSlug: prepared.modelSlug,
        usage,
        latencyMs: Date.now() - startedAt,
        success: false,
        errorMessage: message,
      }).catch(() => undefined);

      push(`\n\n⚠️ ${message}`);
    } finally {
      close();
    }
  })();

  return stream;
}
