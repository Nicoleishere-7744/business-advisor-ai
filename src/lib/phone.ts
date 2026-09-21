// نرمال‌سازی شماره موبایل ایران به فرمت E.164 (+989XXXXXXXXX)

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/// تبدیل ارقام فارسی/عربی به لاتین
export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (char) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(char);
    if (persianIndex > -1) return String(persianIndex);
    return String(ARABIC_DIGITS.indexOf(char));
  });
}

/// خروجی: شماره E.164 یا null اگر شماره معتبر نباشد
export function normalizePhone(input: string): string | null {
  if (!input) return null;
  let digits = toLatinDigits(input).replace(/[\s\-()]/g, "");

  if (digits.startsWith("+98")) digits = digits.slice(3);
  else if (digits.startsWith("0098")) digits = digits.slice(4);
  else if (digits.startsWith("98") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  if (!/^9\d{9}$/.test(digits)) return null;
  return `+98${digits}`;
}

/// نمایش محلی شماره: 09121234567
export function toLocalPhone(e164: string): string {
  if (e164.startsWith("+98")) return `0${e164.slice(3)}`;
  return e164;
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}
