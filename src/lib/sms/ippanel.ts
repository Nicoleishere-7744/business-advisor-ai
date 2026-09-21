import "server-only";
import { getSetting, getSettingBoolean } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/constants";

// کلاینت سرویس پیامک IPPanel (Edge API)
// مستندات: https://ippanelcom.github.io/Edge-Document/docs/send/
// نکته: هدر Authorization بدون پیشوند Bearer فرستاده می‌شود.

const IPPANEL_BASE_URL = "https://edge.ippanel.com/v1";

type IppanelResponse = {
  data?: { message_outbox_ids?: number[] };
  meta?: { status?: boolean; message?: string; message_code?: string };
};

export type SmsResult = {
  ok: boolean;
  /// در حالت توسعه پیامکی ارسال نمی‌شود
  simulated: boolean;
  messageId?: number;
  error?: string;
};

async function postToIppanel(token: string, body: unknown): Promise<SmsResult> {
  let response: Response;
  try {
    response = await fetch(`${IPPANEL_BASE_URL}/api/send`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[ippanel] network error", error);
    return { ok: false, simulated: false, error: "ارتباط با سرویس پیامک برقرار نشد." };
  }

  let payload: IppanelResponse = {};
  try {
    payload = (await response.json()) as IppanelResponse;
  } catch {
    // بعضی خطاها بدنه JSON ندارند
  }

  if (!response.ok || payload.meta?.status !== true) {
    const message = payload.meta?.message ?? `خطای سرویس پیامک (کد ${response.status})`;
    console.error("[ippanel] send failed", {
      status: response.status,
      code: payload.meta?.message_code,
      message,
    });
    return { ok: false, simulated: false, error: message };
  }

  return {
    ok: true,
    simulated: false,
    messageId: payload.data?.message_outbox_ids?.[0],
  };
}

/**
 * ارسال کد ورود با پترن.
 * در حالت SMS_DEV_MODE کد فقط در کنسول سرور چاپ می‌شود.
 */
export async function sendOtpSms(phoneE164: string, code: string): Promise<SmsResult> {
  const devMode = await getSettingBoolean(SETTING_KEYS.smsDevMode, false);
  if (devMode) {
    console.info(`\n[SMS_DEV_MODE] کد ورود برای ${phoneE164}: ${code}\n`);
    return { ok: true, simulated: true };
  }

  const [token, fromNumber, patternCode] = await Promise.all([
    getSetting(SETTING_KEYS.ippanelToken),
    getSetting(SETTING_KEYS.ippanelFrom),
    getSetting(SETTING_KEYS.ippanelOtpPattern),
  ]);

  if (!token || !fromNumber || !patternCode) {
    return {
      ok: false,
      simulated: false,
      error: "تنظیمات سرویس پیامک کامل نیست. با پشتیبانی تماس بگیرید.",
    };
  }

  return postToIppanel(token, {
    sending_type: "pattern",
    from_number: fromNumber,
    code: patternCode,
    recipients: [phoneE164],
    params: { code },
  });
}

/// ارسال پیامک متنی ساده (اطلاع‌رسانی آماده شدن گزارش و مشابه آن)
export async function sendPlainSms(phoneE164: string, message: string): Promise<SmsResult> {
  const devMode = await getSettingBoolean(SETTING_KEYS.smsDevMode, false);
  if (devMode) {
    console.info(`\n[SMS_DEV_MODE] پیامک به ${phoneE164}: ${message}\n`);
    return { ok: true, simulated: true };
  }

  const [token, fromNumber] = await Promise.all([
    getSetting(SETTING_KEYS.ippanelToken),
    getSetting(SETTING_KEYS.ippanelFrom),
  ]);

  if (!token || !fromNumber) {
    return { ok: false, simulated: false, error: "تنظیمات سرویس پیامک کامل نیست." };
  }

  return postToIppanel(token, {
    sending_type: "webservice",
    from_number: fromNumber,
    message,
    params: { recipients: [phoneE164] },
  });
}
