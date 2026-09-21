import "server-only";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/constants";

// کلاینت OpenRouter (سازگار با فرمت OpenAI)
// آدرس پایه از تنظیمات/متغیر محیطی خوانده می‌شود تا در صورت نیاز
// بتوان بدون تغییر کد به یک رله/پروکسی خارجی سوییچ کرد.

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  generationId?: string;
};

export type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  promptPrice?: number;
  completionPrice?: number;
};

async function getConfig() {
  const [apiKey, baseUrl] = await Promise.all([
    getSetting(SETTING_KEYS.openrouterApiKey),
    getSetting(SETTING_KEYS.aiBaseUrl),
  ]);
  return {
    apiKey,
    baseUrl: (baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
  };
}

function buildHeaders(apiKey: string): HeadersInit {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    // OpenRouter این دو هدر را برای شناسایی اپ استفاده می‌کند
    "HTTP-Referer": appUrl,
    "X-Title": "Business Advisor",
  };
}

export class AiConfigError extends Error {}
export class AiRequestError extends Error {}

/// لیست مدل‌های در دسترس روی OpenRouter (برای انتخاب در پنل ادمین)
export async function listModels(): Promise<OpenRouterModel[]> {
  const { apiKey, baseUrl } = await getConfig();
  if (!apiKey) throw new AiConfigError("کلید API هوش مصنوعی تنظیم نشده است.");

  const response = await fetch(`${baseUrl}/models`, {
    headers: buildHeaders(apiKey),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new AiRequestError(`دریافت فهرست مدل‌ها ناموفق بود (کد ${response.status}).`);
  }

  const payload = (await response.json()) as {
    data?: Array<{
      id: string;
      name?: string;
      description?: string;
      context_length?: number;
      pricing?: { prompt?: string; completion?: string };
    }>;
  };

  return (payload.data ?? []).map((model) => ({
    id: model.id,
    name: model.name ?? model.id,
    description: model.description,
    contextLength: model.context_length,
    promptPrice: model.pricing?.prompt ? Number(model.pricing.prompt) : undefined,
    completionPrice: model.pricing?.completion ? Number(model.pricing.completion) : undefined,
  }));
}

function parseUsage(usage: unknown): AiUsage {
  const u = (usage ?? {}) as Record<string, unknown>;
  return {
    promptTokens: Number(u.prompt_tokens ?? 0),
    completionTokens: Number(u.completion_tokens ?? 0),
    totalTokens: Number(u.total_tokens ?? 0),
    costUsd: Number(u.cost ?? 0),
  };
}

export type ChatCompletionResult = {
  content: string;
  usage: AiUsage;
};

/// فراخوانی غیراستریم (برای چت پیگیری و تست اتصال)
export async function chatCompletion(params: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<ChatCompletionResult> {
  const { apiKey, baseUrl } = await getConfig();
  if (!apiKey) throw new AiConfigError("کلید API هوش مصنوعی تنظیم نشده است.");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4000,
    }),
    signal: params.signal,
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[openrouter] chat failed", response.status, detail.slice(0, 500));
    throw new AiRequestError(`درخواست به سرویس هوش مصنوعی ناموفق بود (کد ${response.status}).`);
  }

  const payload = (await response.json()) as {
    id?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: unknown;
  };

  const content = payload.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new AiRequestError("پاسخ خالی از سرویس هوش مصنوعی دریافت شد.");
  }

  return { content, usage: { ...parseUsage(payload.usage), generationId: payload.id } };
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; usage: AiUsage };

/**
 * فراخوانی استریم به‌صورت AsyncGenerator.
 * رویداد پایانی شامل مصرف توکن و هزینه است (OpenRouter آن را در آخرین چانک می‌فرستد).
 */
export async function* streamChatCompletion(params: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}): AsyncGenerator<StreamEvent> {
  const { apiKey, baseUrl } = await getConfig();
  if (!apiKey) throw new AiConfigError("کلید API هوش مصنوعی تنظیم نشده است.");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4000,
      stream: true,
    }),
    signal: params.signal,
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    console.error("[openrouter] stream failed", response.status, detail.slice(0, 500));
    throw new AiRequestError(`درخواست به سرویس هوش مصنوعی ناموفق بود (کد ${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: AiUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // آخرین خط ممکن است ناقص باشد و باید در بافر بماند
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith(":")) continue; // خطوط کامنت/keep-alive
      if (!line.startsWith("data:")) continue;

      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;

      try {
        const chunk = JSON.parse(data) as {
          id?: string;
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: unknown;
        };
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) yield { type: "delta", text };
        if (chunk.usage) usage = { ...parseUsage(chunk.usage), generationId: chunk.id };
      } catch {
        // چانک ناقص یا غیرقابل تجزیه را نادیده می‌گیریم
      }
    }
  }

  yield { type: "done", usage };
}
