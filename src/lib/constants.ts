// مقادیر ثابتی که به‌جای enum بومی دیتابیس استفاده می‌شوند
// (برای سازگاری همزمان SQLite و PostgreSQL همه‌شان در DB به‌صورت String ذخیره می‌شوند)

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CONSULTATION_STATUSES = [
  "awaiting_payment",
  "paid",
  "generating",
  "completed",
  "failed",
] as const;
export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];

export const CONSULTATION_STATUS_LABELS: Record<ConsultationStatus, string> = {
  awaiting_payment: "در انتظار پرداخت",
  paid: "پرداخت‌شده - آماده تولید",
  generating: "در حال تولید گزارش",
  completed: "تکمیل‌شده",
  failed: "ناموفق",
};

export const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "verified",
  "failed",
  "canceled",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "در انتظار پرداخت",
  paid: "پرداخت‌شده (تأیید نشده)",
  verified: "تأیید نهایی شده",
  failed: "ناموفق",
  canceled: "لغو شده",
};

export const FORM_FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "select",
  "multiselect",
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const FORM_FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: "متن کوتاه",
  textarea: "متن بلند",
  number: "عدد",
  select: "انتخاب یکی",
  multiselect: "انتخاب چندتایی",
};

export const DISCOUNT_TYPES = ["percent", "amount"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const AI_USAGE_KINDS = ["report", "chat"] as const;
export type AiUsageKind = (typeof AI_USAGE_KINDS)[number];

/// کلیدهای جدول Setting
export const SETTING_KEYS = {
  consultationPriceRial: "consultation_price_rial",
  followupMessageLimit: "followup_message_limit",
  platformName: "platform_name",
  supportPhone: "support_phone",
  openrouterApiKey: "openrouter_api_key",
  aiBaseUrl: "ai_base_url",
  ippanelToken: "ippanel_token",
  ippanelFrom: "ippanel_from",
  ippanelOtpPattern: "ippanel_otp_pattern",
  smsDevMode: "sms_dev_mode",
  zibalMerchant: "zibal_merchant",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/// تنظیماتی که باید رمزنگاری‌شده ذخیره و در UI ماسک شوند
export const SECRET_SETTING_KEYS: SettingKey[] = [
  SETTING_KEYS.openrouterApiKey,
  SETTING_KEYS.ippanelToken,
  SETTING_KEYS.zibalMerchant,
];

/// نگاشت تنظیمات به متغیر محیطی متناظر (fallback وقتی مقدار در DB نیست)
export const SETTING_ENV_FALLBACK: Partial<Record<SettingKey, string>> = {
  [SETTING_KEYS.openrouterApiKey]: "OPENROUTER_API_KEY",
  [SETTING_KEYS.aiBaseUrl]: "AI_BASE_URL",
  [SETTING_KEYS.ippanelToken]: "IPPANEL_TOKEN",
  [SETTING_KEYS.ippanelFrom]: "IPPANEL_FROM",
  [SETTING_KEYS.ippanelOtpPattern]: "IPPANEL_OTP_PATTERN",
  [SETTING_KEYS.smsDevMode]: "SMS_DEV_MODE",
  [SETTING_KEYS.zibalMerchant]: "ZIBAL_MERCHANT",
};

/// مقادیر پیش‌فرض تنظیمات غیرحساس
export const SETTING_DEFAULTS: Partial<Record<SettingKey, string>> = {
  [SETTING_KEYS.consultationPriceRial]: "2900000",
  [SETTING_KEYS.followupMessageLimit]: "5",
  [SETTING_KEYS.platformName]: "مشاور کسب‌وکار",
  [SETTING_KEYS.aiBaseUrl]: "https://openrouter.ai/api/v1",
};

// ---------- ثابت‌های رفتاری ----------

/// اعتبار کد ورود (ثانیه)
export const OTP_TTL_SECONDS = 120;
/// فاصله لازم بین دو درخواست کد برای یک شماره (ثانیه)
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
/// حداکثر تلاش برای وارد کردن کد اشتباه
export const OTP_MAX_ATTEMPTS = 5;
/// طول کد ورود
export const OTP_LENGTH = 5;
/// عمر نشست (ثانیه) — ۳۰ روز
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
/// نام کوکی نشست
export const SESSION_COOKIE = "ba_session";
/// اگر تولید گزارش بیش از این مدت روی «generating» بماند، اجازه تولید مجدد داده می‌شود (میلی‌ثانیه)
export const GENERATION_STALE_MS = 5 * 60 * 1000;
/// حداکثر طول پیام چت پیگیری
export const CHAT_MESSAGE_MAX_LENGTH = 1000;
