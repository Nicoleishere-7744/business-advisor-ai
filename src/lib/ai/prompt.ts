import type { ChatMessage } from "@/lib/ai/openrouter";

// ساخت پرامپت نهایی از روی قالب مدیریت‌شده در پنل ادمین و پاسخ‌های فرم کاربر.

export type PromptField = {
  key: string;
  label: string;
  type: string;
};

export type AnswerValue = string | number | string[] | null | undefined;

/// مقدار خام پاسخ را به متن خوانا تبدیل می‌کند
export function formatAnswer(value: AnswerValue): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join("، ") : "—";
  return String(value);
}

/**
 * جای‌گذاری {{field_key}} در قالب.
 * فیلدهایی که در قالب استفاده نشده‌اند، در انتها به‌صورت «برچسب: مقدار» ضمیمه می‌شوند
 * تا افزودن فیلد جدید از پنل ادمین بدون ویرایش قالب هم به AI برسد.
 */
export function renderTemplate(
  template: string,
  fields: PromptField[],
  answers: Record<string, AnswerValue>,
): string {
  const used = new Set<string>();

  const rendered = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in answers)) return match;
    used.add(key);
    return formatAnswer(answers[key]);
  });

  const leftovers = fields.filter((field) => !used.has(field.key) && field.key in answers);
  if (leftovers.length === 0) return rendered;

  const extra = leftovers
    .map((field) => `- ${field.label}: ${formatAnswer(answers[field.key])}`)
    .join("\n");

  return `${rendered}\n\n## اطلاعات تکمیلی\n${extra}`;
}

export function buildConsultationMessages(params: {
  systemPrompt: string;
  userTemplate: string;
  fields: PromptField[];
  answers: Record<string, AnswerValue>;
}): ChatMessage[] {
  return [
    { role: "system", content: params.systemPrompt },
    {
      role: "user",
      content: renderTemplate(params.userTemplate, params.fields, params.answers),
    },
  ];
}

/// پیام‌های چت پیگیری: گزارش تولیدشده به‌عنوان زمینه به مدل داده می‌شود
export function buildFollowUpMessages(params: {
  report: string;
  history: Array<{ role: string; content: string }>;
  question: string;
}): ChatMessage[] {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "تو یک مشاور کسب‌وکار فارسی‌زبان هستی که پیش‌تر گزارش مشاوره زیر را برای همین کاربر تهیه کرده‌ای.",
        "به سوال‌های پیگیری کوتاه، دقیق و عملی پاسخ بده و به محتوای گزارش وفادار بمان.",
        "اگر سوال خارج از دامنه گزارش و اطلاعات کسب‌وکار است، صادقانه بگو و راهنمایی کن چه اطلاعاتی لازم است.",
        "پاسخ‌ها را با Markdown و به زبان فارسی بنویس.",
        "",
        "--- متن گزارش ---",
        params.report,
        "--- پایان گزارش ---",
      ].join("\n"),
    },
  ];

  for (const message of params.history) {
    messages.push({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    });
  }

  messages.push({ role: "user", content: params.question });
  return messages;
}

// ---------- قالب پیش‌فرض (در seed استفاده می‌شود و از پنل ادمین قابل ویرایش است) ----------

export const DEFAULT_SYSTEM_PROMPT = `تو یک مشاور ارشد کسب‌وکار با تجربه عملی در بازار ایران هستی.
وظیفه‌ات تولید یک گزارش مشاوره کاربردی، صریح و قابل اجرا بر اساس اطلاعاتی است که صاحب کسب‌وکار وارد کرده است.

قواعد نگارش:
- کل پاسخ به زبان فارسی روان و با قالب Markdown باشد.
- کلی‌گویی ممنوع؛ هر پیشنهاد باید مشخص، قابل اندازه‌گیری و متناسب با اندازه و بودجه همان کسب‌وکار باشد.
- اگر داده‌ای ناقص است، فرضِ خودت را شفاف بنویس و بر اساس آن ادامه بده.
- عدد و بازه زمانی بده؛ از جملات مبهم مثل «بازاریابی را تقویت کنید» پرهیز کن.
- بدون تعارف و مقدمه‌چینی؛ مستقیم سراغ تحلیل برو.

ساختار خروجی دقیقاً با همین سرفصل‌ها و به همین ترتیب:
## خلاصه وضعیت
## تحلیل بازار و رقبا
## نقاط قوت و ضعف
## فرصت‌ها و تهدیدها
## پیشنهادهای اجرایی (به ترتیب اولویت)
## برنامه ۳۰ / ۶۰ / ۹۰ روزه
## شاخص‌های کلیدی برای پیگیری`;

export const DEFAULT_USER_TEMPLATE = `اطلاعات کسب‌وکار من به شرح زیر است:

- نام کسب‌وکار: {{business_name}}
- صنعت / حوزه فعالیت: {{industry}}
- مرحله رشد: {{stage}}
- تعداد کارکنان: {{team_size}}
- بازار و مشتری هدف: {{target_market}}
- درآمد ماهانه تقریبی (تومان): {{monthly_revenue}}
- کانال‌های فروش و بازاریابی فعلی: {{sales_channels}}
- رقبای اصلی: {{competitors}}
- بزرگ‌ترین چالش فعلی: {{main_challenge}}
- هدف شش ماه آینده: {{six_month_goal}}

لطفاً بر اساس این اطلاعات، گزارش مشاوره کسب‌وکار را طبق ساختار خواسته‌شده تهیه کن.`;
