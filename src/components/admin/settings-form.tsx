"use client";

import { useActionState } from "react";
import { Alert, Card, CardHeader, HelpText, Input, Label, Select } from "@/components/ui";
import { SubmitButton } from "@/components/admin/action-form";
import { saveSettings } from "@/app/admin/actions";
import { SETTING_KEYS } from "@/lib/constants";
import { formatRialAsToman } from "@/lib/format";

// فرم تنظیمات پلتفرم.
// کلیدهای حساس هرگز از سرور خوانده و نمایش داده نمی‌شوند؛ فقط وضعیتشان اعلام می‌شود
// و اگر ادمین فیلد را خالی بگذارد، مقدار قبلی دست‌نخورده می‌ماند.

type Props = {
  values: {
    platformName: string;
    supportPhone: string;
    consultationPriceRial: string;
    followupMessageLimit: string;
    aiBaseUrl: string;
    ippanelFrom: string;
    ippanelOtpPattern: string;
    smsDevMode: boolean;
    zibalMerchant: string;
  };
  secrets: {
    openrouterConfigured: boolean;
    openrouterFromEnv: boolean;
    ippanelConfigured: boolean;
    ippanelFromEnv: boolean;
  };
};

function SecretStatus({ configured, fromEnv }: { configured: boolean; fromEnv: boolean }) {
  if (!configured) {
    return <HelpText>هنوز تنظیم نشده است.</HelpText>;
  }
  return (
    <HelpText>
      {fromEnv
        ? "در حال حاضر از متغیر محیطی خوانده می‌شود. برای جایگزینی، مقدار جدید را وارد کنید."
        : "مقدار ذخیره‌شده است. برای حفظ آن، این فیلد را خالی بگذارید."}
    </HelpText>
  );
}

export function SettingsForm({ values, secrets }: Props) {
  const [state, formAction] = useActionState(saveSettings, null);
  const price = Number(values.consultationPriceRial);

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader title="عمومی" />
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="platformName">نام پلتفرم</Label>
            <Input
              id="platformName"
              name={SETTING_KEYS.platformName}
              defaultValue={values.platformName}
            />
          </div>
          <div>
            <Label htmlFor="supportPhone">شماره پشتیبانی</Label>
            <Input
              id="supportPhone"
              name={SETTING_KEYS.supportPhone}
              defaultValue={values.supportPhone}
              dir="ltr"
              className="text-left"
            />
          </div>
          <div>
            <Label htmlFor="price">مبلغ هر مشاوره (ریال)</Label>
            <Input
              id="price"
              name={SETTING_KEYS.consultationPriceRial}
              defaultValue={values.consultationPriceRial}
              inputMode="numeric"
              dir="ltr"
              className="text-left"
            />
            <HelpText>
              {Number.isFinite(price) ? `معادل ${formatRialAsToman(price)}` : "عدد را به ریال وارد کنید."}
            </HelpText>
          </div>
          <div>
            <Label htmlFor="chatLimit">سقف سوال پیگیری هر مشاوره</Label>
            <Input
              id="chatLimit"
              name={SETTING_KEYS.followupMessageLimit}
              defaultValue={values.followupMessageLimit}
              inputMode="numeric"
              dir="ltr"
              className="text-left"
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="هوش مصنوعی (OpenRouter)"
          description="اگر به رله یا پروکسی خارجی نیاز داری، فقط آدرس پایه را عوض کن."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="aiBaseUrl">آدرس پایه API</Label>
            <Input
              id="aiBaseUrl"
              name={SETTING_KEYS.aiBaseUrl}
              defaultValue={values.aiBaseUrl}
              dir="ltr"
              className="text-left"
              placeholder="https://openrouter.ai/api/v1"
            />
          </div>
          <div>
            <Label htmlFor="openrouterKey">کلید API</Label>
            <Input
              id="openrouterKey"
              name={SETTING_KEYS.openrouterApiKey}
              type="password"
              autoComplete="new-password"
              dir="ltr"
              className="text-left"
              placeholder={secrets.openrouterConfigured ? "••••••••" : "sk-or-v1-…"}
            />
            <SecretStatus
              configured={secrets.openrouterConfigured}
              fromEnv={secrets.openrouterFromEnv}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="پیامک (آی‌پی‌پنل)" />
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="ippanelToken">توکن API</Label>
            <Input
              id="ippanelToken"
              name={SETTING_KEYS.ippanelToken}
              type="password"
              autoComplete="new-password"
              dir="ltr"
              className="text-left"
              placeholder={secrets.ippanelConfigured ? "••••••••" : "توکن آی‌پی‌پنل"}
            />
            <SecretStatus
              configured={secrets.ippanelConfigured}
              fromEnv={secrets.ippanelFromEnv}
            />
          </div>
          <div>
            <Label htmlFor="ippanelFrom">شماره فرستنده</Label>
            <Input
              id="ippanelFrom"
              name={SETTING_KEYS.ippanelFrom}
              defaultValue={values.ippanelFrom}
              dir="ltr"
              className="text-left"
              placeholder="+983000505"
            />
            <HelpText>در قالب E.164 وارد شود.</HelpText>
          </div>
          <div>
            <Label htmlFor="otpPattern">کد پترن کد ورود</Label>
            <Input
              id="otpPattern"
              name={SETTING_KEYS.ippanelOtpPattern}
              defaultValue={values.ippanelOtpPattern}
              dir="ltr"
              className="text-left"
            />
            <HelpText>پترن باید یک پارامتر با نام code داشته باشد.</HelpText>
          </div>
          <div>
            <Label htmlFor="smsDevMode">حالت توسعه پیامک</Label>
            <Select
              id="smsDevMode"
              name={SETTING_KEYS.smsDevMode}
              defaultValue={values.smsDevMode ? "on" : "off"}
            >
              <option value="off">غیرفعال — پیامک واقعی ارسال شود</option>
              <option value="on">فعال — کد فقط در کنسول سرور چاپ شود</option>
            </Select>
            <HelpText>در پروداکشن حتماً غیرفعال باشد.</HelpText>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="درگاه پرداخت (زیبال)" />
        <div className="max-w-md">
          <Label htmlFor="zibalMerchant">شناسه پذیرنده</Label>
          <Input
            id="zibalMerchant"
            name={SETTING_KEYS.zibalMerchant}
            defaultValue={values.zibalMerchant}
            dir="ltr"
            className="text-left"
          />
          <HelpText>
            مقدار «zibal» یعنی حالت سندباکس؛ برای پرداخت واقعی شناسه پذیرنده خودت را بگذار.
          </HelpText>
        </div>
      </Card>

      {state ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      <SubmitButton>ذخیره تنظیمات</SubmitButton>
    </form>
  );
}
