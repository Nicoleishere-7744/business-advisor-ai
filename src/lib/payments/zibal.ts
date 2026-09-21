import "server-only";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/constants";

// کلاینت درگاه پرداخت زیبال
// مستندات: https://github.com/zibalco  |  مرچنت «zibal» = حالت سندباکس

const ZIBAL_BASE_URL = "https://gateway.zibal.ir";

/// کدهای نتیجه (result) پاسخ‌های زیبال
export const ZIBAL_RESULT_MESSAGES: Record<number, string> = {
  100: "با موفقیت تأیید شد",
  102: "merchant یافت نشد",
  103: "merchant غیرفعال است",
  104: "merchant نامعتبر است",
  105: "مبلغ باید بیشتر از ۱٬۰۰۰ ریال باشد",
  106: "آدرس بازگشت (callbackUrl) نامعتبر است",
  113: "مبلغ تراکنش از سقف مجاز بیشتر است",
  201: "این تراکنش قبلاً تأیید شده است",
  202: "سفارش پرداخت نشده یا پرداخت ناموفق بوده است",
  203: "شناسه تراکنش (trackId) نامعتبر است",
};

/// کدهای وضعیت (status) تراکنش
export const ZIBAL_STATUS_MESSAGES: Record<number, string> = {
  [-1]: "در انتظار پرداخت",
  [-2]: "خطای داخلی درگاه",
  1: "پرداخت شده و تأیید شده",
  2: "پرداخت شده ولی تأیید نشده",
  3: "تراکنش توسط کاربر لغو شد",
  4: "شماره کارت نامعتبر است",
  5: "موجودی حساب کافی نیست",
  6: "رمز واردشده اشتباه است",
  7: "تعداد درخواست‌ها بیش از حد مجاز است",
  8: "تعداد پرداخت اینترنتی روزانه بیش از حد مجاز است",
  9: "مبلغ پرداخت اینترنتی روزانه بیش از حد مجاز است",
  10: "صادرکننده کارت نامعتبر است",
  11: "خطای سوییچ بانکی",
  12: "کارت قابل دسترسی نیست",
};

export function describeZibalResult(result?: number | null): string {
  if (result === null || result === undefined) return "بدون کد نتیجه";
  return ZIBAL_RESULT_MESSAGES[result] ?? `کد نتیجه ناشناخته (${result})`;
}

export function describeZibalStatus(status?: number | null): string {
  if (status === null || status === undefined) return "بدون کد وضعیت";
  return ZIBAL_STATUS_MESSAGES[status] ?? `کد وضعیت ناشناخته (${status})`;
}

type ZibalRequestResponse = {
  trackId?: number;
  result?: number;
  message?: string;
};

type ZibalVerifyResponse = {
  paidAt?: string;
  amount?: number;
  result?: number;
  status?: number;
  refNumber?: number | string;
  cardNumber?: string;
  orderId?: string;
  message?: string;
};

async function postToZibal<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch(`${ZIBAL_BASE_URL}/v1/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return (await response.json()) as T;
  } catch (error) {
    console.error(`[zibal] ${path} failed`, error);
    return null;
  }
}

export type ZibalRequestResult =
  | { ok: true; trackId: string; startUrl: string }
  | { ok: false; result?: number; error: string };

/**
 * ایجاد تراکنش جدید.
 * @param amount مبلغ به ریال
 */
export async function requestPayment(params: {
  amount: number;
  callbackUrl: string;
  orderId: string;
  mobile?: string;
  description?: string;
}): Promise<ZibalRequestResult> {
  const merchant = await getSetting(SETTING_KEYS.zibalMerchant);
  if (!merchant) {
    return { ok: false, error: "شناسه پذیرنده درگاه پرداخت تنظیم نشده است." };
  }

  const payload = await postToZibal<ZibalRequestResponse>("request", {
    merchant,
    amount: params.amount,
    callbackUrl: params.callbackUrl,
    orderId: params.orderId,
    ...(params.mobile ? { mobile: params.mobile } : {}),
    ...(params.description ? { description: params.description } : {}),
  });

  if (!payload) {
    return { ok: false, error: "ارتباط با درگاه پرداخت برقرار نشد." };
  }
  if (payload.result !== 100 || !payload.trackId) {
    return {
      ok: false,
      result: payload.result,
      error: describeZibalResult(payload.result),
    };
  }

  const trackId = String(payload.trackId);
  return { ok: true, trackId, startUrl: getStartUrl(trackId) };
}

export function getStartUrl(trackId: string): string {
  return `${ZIBAL_BASE_URL}/start/${trackId}`;
}

export type ZibalVerifyResult = {
  /// آیا تراکنش موفق و قابل قبول است؟ (۱۰۰ = تأیید شد، ۲۰۱ = قبلاً تأیید شده)
  ok: boolean;
  /// آیا این فراخوانی نشان می‌دهد تراکنش پیش‌تر تأیید شده بود؟
  alreadyVerified: boolean;
  result?: number;
  status?: number;
  amount?: number;
  refNumber?: string;
  cardNumber?: string;
  paidAt?: Date;
  error?: string;
};

export async function verifyPayment(trackId: string): Promise<ZibalVerifyResult> {
  const merchant = await getSetting(SETTING_KEYS.zibalMerchant);
  if (!merchant) {
    return { ok: false, alreadyVerified: false, error: "شناسه پذیرنده تنظیم نشده است." };
  }

  const payload = await postToZibal<ZibalVerifyResponse>("verify", { merchant, trackId });
  if (!payload) {
    return { ok: false, alreadyVerified: false, error: "ارتباط با درگاه پرداخت برقرار نشد." };
  }

  const alreadyVerified = payload.result === 201;
  const ok = payload.result === 100 || alreadyVerified;

  return {
    ok,
    alreadyVerified,
    result: payload.result,
    status: payload.status,
    amount: payload.amount,
    refNumber: payload.refNumber !== undefined ? String(payload.refNumber) : undefined,
    cardNumber: payload.cardNumber,
    paidAt: payload.paidAt ? new Date(payload.paidAt) : undefined,
    error: ok ? undefined : describeZibalResult(payload.result),
  };
}
