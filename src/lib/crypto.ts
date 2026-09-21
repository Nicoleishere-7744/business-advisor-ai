import crypto from "node:crypto";

// رمزنگاری متقارن برای مقادیر حساس جدول Setting
// قالب خروجی: enc:v1:<iv-base64>:<tag-base64>:<ciphertext-base64>

const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("APP_ENCRYPTION_KEY تنظیم نشده است.");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY باید دقیقاً ۶۴ کاراکتر hex (۳۲ بایت) باشد.");
  }
  return key;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  if (plain === "") return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (stored === "") return "";
  if (!isEncrypted(stored)) {
    // مقادیری که قبل از فعال شدن رمزنگاری ذخیره شده‌اند یا دستی وارد شده‌اند
    return stored;
  }
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("مقدار رمزنگاری‌شده معتبر نیست.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/// هش یک‌طرفه برای کد OTP (کد کوتاه است، پس نمک اختصاصی اضافه می‌کنیم)
export function hashOtp(phone: string, code: string): string {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET ?? "fallback-secret")
    .update(`${phone}:${code}`)
    .digest("hex");
}

/// مقایسه زمان‌ثابت برای جلوگیری از timing attack
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/// تولید کد عددی تصادفی با طول مشخص
export function generateNumericCode(length: number): string {
  let out = "";
  while (out.length < length) {
    out += crypto.randomInt(0, 10).toString();
  }
  return out;
}

/// ماسک کردن مقادیر حساس برای نمایش در پنل ادمین
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 6) return "•".repeat(value.length);
  return `${value.slice(0, 3)}${"•".repeat(Math.min(12, value.length - 6))}${value.slice(-3)}`;
}
