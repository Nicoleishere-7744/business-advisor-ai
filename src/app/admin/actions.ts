"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { setSettings } from "@/lib/settings";
import { settlePaymentByTrackId } from "@/lib/payments/settle";
import { listModels } from "@/lib/ai/openrouter";
import { FORM_FIELD_TYPES, SETTING_KEYS, type SettingKey } from "@/lib/constants";

// اکشن‌های سمت سرور پنل مدیریت.
// Next به‌صورت داخلی روی Server Action ها بررسی Origin انجام می‌دهد.

export type ActionState = { ok: boolean; message: string } | null;

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("دسترسی مدیریتی ندارید.");
  }
  return user;
}

async function audit(
  adminId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  meta?: unknown,
) {
  await prisma.adminAuditLog
    .create({
      data: {
        adminId,
        action,
        targetType,
        targetId,
        metaJson: meta ? JSON.stringify(meta) : null,
      },
    })
    .catch(() => undefined);
}

function fail(message: string): ActionState {
  return { ok: false, message };
}

function done(message: string): ActionState {
  return { ok: true, message };
}

/// گزینه‌های select که در فرم به‌صورت خط‌به‌خط وارد می‌شوند
function parseOptionLines(raw: string): string | null {
  const options = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (options.length === 0) return null;
  return JSON.stringify(options.map((option) => ({ value: option, label: option })));
}

function optionalInt(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

// ---------- فرم‌ساز ----------

const fieldSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,49}$/, {
      message: "کلید باید انگلیسی، با حرف کوچک شروع شود و فقط شامل حروف، عدد و _ باشد.",
    }),
  label: z.string().trim().min(1, { message: "برچسب فیلد الزامی است." }).max(120),
  type: z.enum(FORM_FIELD_TYPES),
});

export async function saveFormField(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();

    const id = String(formData.get("id") ?? "");
    const parsed = fieldSchema.safeParse({
      key: formData.get("key"),
      label: formData.get("label"),
      type: formData.get("type"),
    });
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);

    const needsOptions = parsed.data.type === "select" || parsed.data.type === "multiselect";
    const optionsJson = parseOptionLines(String(formData.get("options") ?? ""));
    if (needsOptions && !optionsJson) {
      return fail("برای فیلدهای انتخابی حداقل یک گزینه لازم است.");
    }

    const data = {
      label: parsed.data.label,
      type: parsed.data.type,
      placeholder: String(formData.get("placeholder") ?? "").trim() || null,
      helpText: String(formData.get("helpText") ?? "").trim() || null,
      optionsJson: needsOptions ? optionsJson : null,
      required: formData.get("required") === "on",
      isActive: formData.get("isActive") === "on",
      minLength: optionalInt(formData.get("minLength")),
      maxLength: optionalInt(formData.get("maxLength")),
      minValue: optionalInt(formData.get("minValue")),
      maxValue: optionalInt(formData.get("maxValue")),
      order: optionalInt(formData.get("order")) ?? 0,
    };

    if (id) {
      await prisma.formField.update({ where: { id }, data });
      await audit(admin.id, "form_field.update", "FormField", id);
      revalidatePath("/admin/form");
      return done("فیلد به‌روزرسانی شد.");
    }

    const duplicate = await prisma.formField.findUnique({ where: { key: parsed.data.key } });
    if (duplicate) return fail("فیلدی با این کلید از قبل وجود دارد.");

    const created = await prisma.formField.create({ data: { key: parsed.data.key, ...data } });
    await audit(admin.id, "form_field.create", "FormField", created.id);
    revalidatePath("/admin/form");
    return done("فیلد جدید اضافه شد.");
  } catch (error) {
    console.error("[admin] saveFormField", error);
    return fail("ذخیره فیلد ناموفق بود.");
  }
}

export async function deleteFormField(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return fail("فیلد نامعتبر است.");

    await prisma.formField.delete({ where: { id } });
    await audit(admin.id, "form_field.delete", "FormField", id);
    revalidatePath("/admin/form");
    return done("فیلد حذف شد.");
  } catch (error) {
    console.error("[admin] deleteFormField", error);
    return fail("حذف فیلد ناموفق بود.");
  }
}

// ---------- پرامپت ----------

export async function savePrompt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();

    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const systemPrompt = String(formData.get("systemPrompt") ?? "").trim();
    const userTemplate = String(formData.get("userTemplate") ?? "").trim();
    const isActive = formData.get("isActive") === "on";

    if (!name) return fail("نام قالب الزامی است.");
    if (systemPrompt.length < 20) return fail("پرامپت سیستمی خیلی کوتاه است.");
    if (userTemplate.length < 20) return fail("قالب پیام کاربر خیلی کوتاه است.");

    const saved = id
      ? await prisma.promptTemplate.update({
          where: { id },
          data: { name, systemPrompt, userTemplate, isActive },
        })
      : await prisma.promptTemplate.create({
          data: { name, systemPrompt, userTemplate, isActive },
        });

    // فقط یک قالب می‌تواند فعال باشد
    if (isActive) {
      await prisma.promptTemplate.updateMany({
        where: { id: { not: saved.id } },
        data: { isActive: false },
      });
    }

    await audit(admin.id, id ? "prompt.update" : "prompt.create", "PromptTemplate", saved.id);
    revalidatePath("/admin/prompts");
    return done("قالب پرامپت ذخیره شد.");
  } catch (error) {
    console.error("[admin] savePrompt", error);
    return fail("ذخیره قالب ناموفق بود.");
  }
}

export async function deletePrompt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const template = await prisma.promptTemplate.findUnique({ where: { id } });
    if (!template) return fail("قالب پیدا نشد.");
    if (template.isActive) return fail("قالب فعال را نمی‌توان حذف کرد. ابتدا قالب دیگری را فعال کنید.");

    await prisma.promptTemplate.delete({ where: { id } });
    await audit(admin.id, "prompt.delete", "PromptTemplate", id);
    revalidatePath("/admin/prompts");
    return done("قالب حذف شد.");
  } catch (error) {
    console.error("[admin] deletePrompt", error);
    return fail("حذف قالب ناموفق بود.");
  }
}

// ---------- مدل‌های هوش مصنوعی ----------

export async function saveModel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();

    const id = String(formData.get("id") ?? "");
    const modelSlug = String(formData.get("modelSlug") ?? "").trim();
    const displayName = String(formData.get("displayName") ?? "").trim();
    if (!modelSlug) return fail("شناسه مدل (slug) الزامی است.");
    if (!displayName) return fail("نام نمایشی مدل الزامی است.");

    const temperature = Number(formData.get("temperature") ?? 0.7);
    const maxTokens = Number(formData.get("maxTokens") ?? 4000);
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      return fail("temperature باید عددی بین ۰ تا ۲ باشد.");
    }
    if (!Number.isFinite(maxTokens) || maxTokens < 256 || maxTokens > 200000) {
      return fail("حداکثر توکن باید بین ۲۵۶ تا ۲۰۰۰۰۰ باشد.");
    }

    const isDefault = formData.get("isDefault") === "on";
    const isActive = formData.get("isActive") === "on";
    if (isDefault && !isActive) return fail("مدل پیش‌فرض باید فعال باشد.");

    const data = {
      displayName,
      description: String(formData.get("description") ?? "").trim() || null,
      temperature,
      maxTokens: Math.trunc(maxTokens),
      isActive,
      isDefault,
      order: optionalInt(formData.get("order")) ?? 0,
    };

    const saved = id
      ? await prisma.aiModelConfig.update({ where: { id }, data })
      : await prisma.aiModelConfig.upsert({
          where: { modelSlug },
          create: { modelSlug, ...data },
          update: data,
        });

    // فقط یک مدل می‌تواند پیش‌فرض باشد
    if (isDefault) {
      await prisma.aiModelConfig.updateMany({
        where: { id: { not: saved.id } },
        data: { isDefault: false },
      });
    }

    await audit(admin.id, "model.save", "AiModelConfig", saved.id, { modelSlug });
    revalidatePath("/admin/models");
    return done("مدل ذخیره شد.");
  } catch (error) {
    console.error("[admin] saveModel", error);
    return fail("ذخیره مدل ناموفق بود.");
  }
}

export async function setDefaultModel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const model = await prisma.aiModelConfig.findUnique({ where: { id } });
    if (!model) return fail("مدل پیدا نشد.");

    await prisma.$transaction([
      prisma.aiModelConfig.updateMany({ data: { isDefault: false }, where: {} }),
      prisma.aiModelConfig.update({
        where: { id },
        data: { isDefault: true, isActive: true },
      }),
    ]);

    await audit(admin.id, "model.set_default", "AiModelConfig", id, {
      modelSlug: model.modelSlug,
    });
    revalidatePath("/admin/models");
    return done(`مدل «${model.displayName}» به‌عنوان پیش‌فرض تنظیم شد.`);
  } catch (error) {
    console.error("[admin] setDefaultModel", error);
    return fail("تغییر مدل پیش‌فرض ناموفق بود.");
  }
}

export async function deleteModel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const model = await prisma.aiModelConfig.findUnique({ where: { id } });
    if (!model) return fail("مدل پیدا نشد.");
    if (model.isDefault) return fail("مدل پیش‌فرض را نمی‌توان حذف کرد.");

    await prisma.aiModelConfig.delete({ where: { id } });
    await audit(admin.id, "model.delete", "AiModelConfig", id);
    revalidatePath("/admin/models");
    return done("مدل حذف شد.");
  } catch (error) {
    console.error("[admin] deleteModel", error);
    return fail("حذف مدل ناموفق بود.");
  }
}

/// واکشی فهرست مدل‌های OpenRouter برای انتخاب سریع در پنل
export async function fetchOpenRouterModels(): Promise<
  { ok: true; models: Array<{ id: string; name: string }> } | { ok: false; message: string }
> {
  try {
    await requireAdmin();
    const models = await listModels();
    return {
      ok: true,
      models: models
        .map((model) => ({ id: model.id, name: model.name }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    };
  } catch (error) {
    console.error("[admin] fetchOpenRouterModels", error);
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "دریافت فهرست مدل‌ها از OpenRouter ناموفق بود.",
    };
  }
}

// ---------- تنظیمات ----------

const SETTING_FORM_KEYS: SettingKey[] = [
  SETTING_KEYS.platformName,
  SETTING_KEYS.supportPhone,
  SETTING_KEYS.consultationPriceRial,
  SETTING_KEYS.followupMessageLimit,
  SETTING_KEYS.aiBaseUrl,
  SETTING_KEYS.openrouterApiKey,
  SETTING_KEYS.ippanelToken,
  SETTING_KEYS.ippanelFrom,
  SETTING_KEYS.ippanelOtpPattern,
  SETTING_KEYS.smsDevMode,
  SETTING_KEYS.zibalMerchant,
];

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();

    const price = Number(formData.get(SETTING_KEYS.consultationPriceRial) ?? "");
    if (!Number.isFinite(price) || price < 0) {
      return fail("مبلغ مشاوره باید عددی معتبر (به ریال) باشد.");
    }

    const chatLimit = Number(formData.get(SETTING_KEYS.followupMessageLimit) ?? "");
    if (!Number.isFinite(chatLimit) || chatLimit < 0 || chatLimit > 50) {
      return fail("سقف سوال پیگیری باید عددی بین ۰ تا ۵۰ باشد.");
    }

    const entries: Partial<Record<SettingKey, string>> = {};
    for (const key of SETTING_FORM_KEYS) {
      const raw = formData.get(key);
      if (raw === null) continue;
      const value = String(raw).trim();

      // فیلدهای حساس در UI ماسک می‌شوند؛ مقدار خالی یعنی «تغییرش نده»
      const isSecretField =
        key === SETTING_KEYS.openrouterApiKey || key === SETTING_KEYS.ippanelToken;
      if (isSecretField && value === "") continue;

      entries[key] = value;
    }

    entries[SETTING_KEYS.smsDevMode] = formData.get(SETTING_KEYS.smsDevMode) === "on" ? "true" : "false";

    await setSettings(entries);
    await audit(admin.id, "settings.update", "Setting", undefined, {
      keys: Object.keys(entries),
    });

    revalidatePath("/admin/settings");
    return done("تنظیمات ذخیره شد.");
  } catch (error) {
    console.error("[admin] saveSettings", error);
    return fail("ذخیره تنظیمات ناموفق بود.");
  }
}

// ---------- کد تخفیف ----------

export async function saveDiscount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();

    const id = String(formData.get("id") ?? "");
    const code = String(formData.get("code") ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      return fail("کد تخفیف باید ۳ تا ۳۲ کاراکتر انگلیسی/عدد باشد.");
    }

    const type = String(formData.get("type") ?? "percent");
    if (type !== "percent" && type !== "amount") return fail("نوع تخفیف نامعتبر است.");

    const value = Number(formData.get("value") ?? 0);
    if (!Number.isFinite(value) || value <= 0) return fail("مقدار تخفیف باید بزرگ‌تر از صفر باشد.");
    if (type === "percent" && value > 100) return fail("درصد تخفیف نمی‌تواند بیش از ۱۰۰ باشد.");

    const expiresRaw = String(formData.get("expiresAt") ?? "").trim();
    const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) return fail("تاریخ انقضا نامعتبر است.");

    const data = {
      type,
      value: Math.trunc(value),
      minAmount: optionalInt(formData.get("minAmount")) ?? 0,
      maxUses: optionalInt(formData.get("maxUses")),
      expiresAt,
      isActive: formData.get("isActive") === "on",
    };

    if (id) {
      await prisma.discountCode.update({ where: { id }, data });
      await audit(admin.id, "discount.update", "DiscountCode", id);
      revalidatePath("/admin/discounts");
      return done("کد تخفیف به‌روزرسانی شد.");
    }

    const duplicate = await prisma.discountCode.findUnique({ where: { code } });
    if (duplicate) return fail("این کد تخفیف از قبل وجود دارد.");

    const created = await prisma.discountCode.create({ data: { code, ...data } });
    await audit(admin.id, "discount.create", "DiscountCode", created.id, { code });
    revalidatePath("/admin/discounts");
    return done("کد تخفیف ساخته شد.");
  } catch (error) {
    console.error("[admin] saveDiscount", error);
    return fail("ذخیره کد تخفیف ناموفق بود.");
  }
}

export async function deleteDiscount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");

    const used = await prisma.payment.count({ where: { discountCodeId: id } });
    if (used > 0) {
      // برای حفظ یکپارچگی سوابق پرداخت، کد استفاده‌شده فقط غیرفعال می‌شود
      await prisma.discountCode.update({ where: { id }, data: { isActive: false } });
      await audit(admin.id, "discount.deactivate", "DiscountCode", id);
      revalidatePath("/admin/discounts");
      return done("این کد در تراکنش‌ها استفاده شده بود؛ به‌جای حذف، غیرفعال شد.");
    }

    await prisma.discountCode.delete({ where: { id } });
    await audit(admin.id, "discount.delete", "DiscountCode", id);
    revalidatePath("/admin/discounts");
    return done("کد تخفیف حذف شد.");
  } catch (error) {
    console.error("[admin] deleteDiscount", error);
    return fail("حذف کد تخفیف ناموفق بود.");
  }
}

// ---------- کاربران ----------

export async function toggleUserBlock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (id === admin.id) return fail("نمی‌توانید حساب خودتان را مسدود کنید.");

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return fail("کاربر پیدا نشد.");

    await prisma.user.update({ where: { id }, data: { isBlocked: !target.isBlocked } });
    await audit(admin.id, target.isBlocked ? "user.unblock" : "user.block", "User", id);

    revalidatePath("/admin/users");
    return done(target.isBlocked ? "کاربر رفع مسدودیت شد." : "کاربر مسدود شد.");
  } catch (error) {
    console.error("[admin] toggleUserBlock", error);
    return fail("تغییر وضعیت کاربر ناموفق بود.");
  }
}

export async function toggleUserAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (id === admin.id) return fail("نمی‌توانید نقش خودتان را تغییر دهید.");

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return fail("کاربر پیدا نشد.");

    const nextRole = target.role === "admin" ? "user" : "admin";
    await prisma.user.update({ where: { id }, data: { role: nextRole } });
    await audit(admin.id, "user.role", "User", id, { role: nextRole });

    revalidatePath("/admin/users");
    return done(nextRole === "admin" ? "کاربر به مدیر تبدیل شد." : "دسترسی مدیریت گرفته شد.");
  } catch (error) {
    console.error("[admin] toggleUserAdmin", error);
    return fail("تغییر نقش کاربر ناموفق بود.");
  }
}

// ---------- تراکنش‌ها ----------

export async function reverifyPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return fail("تراکنش پیدا نشد.");
    if (!payment.trackId) return fail("این تراکنش شناسه پیگیری درگاه ندارد.");

    const result = await settlePaymentByTrackId(payment.trackId);
    await audit(admin.id, "payment.reverify", "Payment", id, { ok: result.ok });

    revalidatePath("/admin/payments");
    return result.ok
      ? done(result.alreadySettled ? "این تراکنش از قبل تأیید شده بود." : "تراکنش تأیید شد.")
      : fail(result.error);
  } catch (error) {
    console.error("[admin] reverifyPayment", error);
    return fail("وریفای مجدد ناموفق بود.");
  }
}
