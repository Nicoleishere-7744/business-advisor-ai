import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { getSettings, hasStoredValue } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/constants";

export const metadata: Metadata = { title: "تنظیمات" };

export default async function AdminSettingsPage() {
  const user = await requireAdminPage();

  const values = await getSettings([
    SETTING_KEYS.platformName,
    SETTING_KEYS.supportPhone,
    SETTING_KEYS.consultationPriceRial,
    SETTING_KEYS.followupMessageLimit,
    SETTING_KEYS.aiBaseUrl,
    SETTING_KEYS.ippanelFrom,
    SETTING_KEYS.ippanelOtpPattern,
    SETTING_KEYS.smsDevMode,
    SETTING_KEYS.zibalMerchant,
  ]);

  // مقادیر حساس هرگز به کلاینت فرستاده نمی‌شوند؛ فقط وضعیت «تنظیم‌شده یا نه»
  const [openrouterKey, ippanelToken] = await Promise.all([
    getSettings([SETTING_KEYS.openrouterApiKey]),
    getSettings([SETTING_KEYS.ippanelToken]),
  ]);

  const secretsState = {
    openrouterConfigured: Boolean(openrouterKey[SETTING_KEYS.openrouterApiKey]),
    openrouterFromEnv: !(await hasStoredValue(SETTING_KEYS.openrouterApiKey)),
    ippanelConfigured: Boolean(ippanelToken[SETTING_KEYS.ippanelToken]),
    ippanelFromEnv: !(await hasStoredValue(SETTING_KEYS.ippanelToken)),
  };

  return (
    <AdminPage user={user} activeHref="/admin/settings">
      <PageHeader
        title="تنظیمات"
        description="کلیدهای سرویس‌ها، قیمت‌گذاری و پیکربندی پیامک و درگاه پرداخت."
      />
      <SettingsForm
        values={{
          platformName: values[SETTING_KEYS.platformName],
          supportPhone: values[SETTING_KEYS.supportPhone],
          consultationPriceRial: values[SETTING_KEYS.consultationPriceRial],
          followupMessageLimit: values[SETTING_KEYS.followupMessageLimit],
          aiBaseUrl: values[SETTING_KEYS.aiBaseUrl],
          ippanelFrom: values[SETTING_KEYS.ippanelFrom],
          ippanelOtpPattern: values[SETTING_KEYS.ippanelOtpPattern],
          smsDevMode: values[SETTING_KEYS.smsDevMode] === "true",
          zibalMerchant: values[SETTING_KEYS.zibalMerchant],
        }}
        secrets={secretsState}
      />
    </AdminPage>
  );
}
