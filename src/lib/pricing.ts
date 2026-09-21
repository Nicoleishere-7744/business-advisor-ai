import "server-only";
import { prisma } from "@/lib/db";
import { getSettingNumber } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/constants";

// محاسبه مبلغ نهایی مشاوره با در نظر گرفتن کد تخفیف

export type PriceQuote = {
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  discountCodeId: string | null;
  discountCode: string | null;
};

export type DiscountError = { error: string };

export async function getConsultationPrice(): Promise<number> {
  return getSettingNumber(SETTING_KEYS.consultationPriceRial, 2_900_000);
}

/**
 * قیمت‌گذاری یک مشاوره. اگر کد تخفیف نامعتبر باشد پیام خطای فارسی برمی‌گردد.
 * مبالغ همه به ریال هستند.
 */
export async function quoteConsultation(rawCode?: string | null): Promise<PriceQuote | DiscountError> {
  const originalAmount = await getConsultationPrice();

  const code = rawCode?.trim().toUpperCase();
  if (!code) {
    return {
      originalAmount,
      discountAmount: 0,
      finalAmount: originalAmount,
      discountCodeId: null,
      discountCode: null,
    };
  }

  const discount = await prisma.discountCode.findUnique({ where: { code } });
  if (!discount || !discount.isActive) {
    return { error: "کد تخفیف معتبر نیست." };
  }
  if (discount.expiresAt && discount.expiresAt.getTime() < Date.now()) {
    return { error: "این کد تخفیف منقضی شده است." };
  }
  if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
    return { error: "ظرفیت استفاده از این کد تخفیف تکمیل شده است." };
  }
  if (originalAmount < discount.minAmount) {
    return { error: "مبلغ سفارش برای استفاده از این کد کافی نیست." };
  }

  const discountAmount =
    discount.type === "percent"
      ? Math.floor((originalAmount * Math.min(100, Math.max(0, discount.value))) / 100)
      : Math.min(originalAmount, Math.max(0, discount.value));

  return {
    originalAmount,
    discountAmount,
    finalAmount: Math.max(0, originalAmount - discountAmount),
    discountCodeId: discount.id,
    discountCode: discount.code,
  };
}

export function isDiscountError(value: PriceQuote | DiscountError): value is DiscountError {
  return "error" in value;
}

/**
 * حداقل مبلغ قابل پذیرش در درگاه زیبال ۱۰٬۰۰۰ ریال است.
 * مبالغ کمتر (مثلاً بعد از تخفیف زیاد) باید بدون درگاه رایگان حساب شوند.
 */
export const ZIBAL_MIN_AMOUNT_RIAL = 10_000;
