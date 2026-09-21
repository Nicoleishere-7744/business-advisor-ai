import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ConsultationForm } from "@/components/consultation-form";
import { Alert, PageHeader } from "@/components/ui";
import { requireUserPage } from "@/lib/auth/session";
import { getActiveFormFields } from "@/lib/consultation";
import { getConsultationPrice } from "@/lib/pricing";
import { USER_NAV } from "@/lib/nav";

export const metadata: Metadata = { title: "مشاوره جدید" };

export default async function NewConsultationPage() {
  const user = await requireUserPage("/consultation/new");
  const [fields, price] = await Promise.all([getActiveFormFields(), getConsultationPrice()]);

  return (
    <AppShell user={user} nav={USER_NAV} activeHref="/consultation/new">
      <PageHeader
        title="درخواست مشاوره جدید"
        description="هرچه اطلاعات دقیق‌تری بدهی، گزارش کاربردی‌تری می‌گیری."
      />

      {fields.length === 0 ? (
        <Alert tone="warning">
          فرم مشاوره هنوز پیکربندی نشده است. لطفاً بعداً دوباره سر بزنید.
        </Alert>
      ) : (
        <ConsultationForm fields={fields} price={price} />
      )}
    </AppShell>
  );
}
