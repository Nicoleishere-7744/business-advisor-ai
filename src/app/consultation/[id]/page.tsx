import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { FollowUpChat } from "@/components/followup-chat";
import { ReportView } from "@/components/report-view";
import { PayAgainButton } from "@/components/pay-again-button";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { requireUserPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { parseAnswers, parseFieldsSnapshot } from "@/lib/consultation";
import { formatAnswer } from "@/lib/ai/prompt";
import { formatDateTime, formatRialAsToman } from "@/lib/format";
import { getSettingNumber } from "@/lib/settings";
import {
  CONSULTATION_STATUS_LABELS,
  SETTING_KEYS,
  type ConsultationStatus,
} from "@/lib/constants";
import { USER_NAV } from "@/lib/nav";

export const metadata: Metadata = { title: "گزارش مشاوره" };

const STATUS_TONE = {
  awaiting_payment: "warning",
  paid: "info",
  generating: "info",
  completed: "success",
  failed: "danger",
} as const;

export default async function ConsultationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generate?: string }>;
}) {
  const user = await requireUserPage();
  const { id } = await params;
  const { generate } = await searchParams;

  const consultation = await prisma.consultation.findUnique({
    where: { id },
    include: {
      payment: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!consultation || consultation.userId !== user.id) notFound();

  const status = consultation.status as ConsultationStatus;
  const paid = consultation.payment?.status === "verified";
  const chatLimit = await getSettingNumber(SETTING_KEYS.followupMessageLimit, 5);

  const answers = parseAnswers(consultation.answersJson);
  const fields = parseFieldsSnapshot(consultation.fieldsSnapshot);

  return (
    <AppShell user={user} nav={USER_NAV} activeHref="/dashboard">
      <PageHeader
        title={consultation.title ?? "گزارش مشاوره"}
        description={`ثبت‌شده در ${formatDateTime(consultation.createdAt)}`}
        action={<Badge tone={STATUS_TONE[status]}>{CONSULTATION_STATUS_LABELS[status]}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {!paid ? (
            <Card>
              <CardHeader
                title="در انتظار پرداخت"
                description="برای دریافت گزارش، پرداخت را کامل کنید."
              />
              {consultation.payment?.failureReason ? (
                <Alert tone="danger" className="mb-4">
                  {consultation.payment.failureReason}
                </Alert>
              ) : null}
              <PayAgainButton consultationId={consultation.id} />
            </Card>
          ) : (
            <ReportView
              consultationId={consultation.id}
              initialReport={consultation.reportMarkdown}
              initialStatus={consultation.status}
              initialError={consultation.errorMessage}
              autoStart={generate === "1" && status !== "completed"}
            />
          )}

          {status === "completed" && consultation.reportMarkdown ? (
            <FollowUpChat
              consultationId={consultation.id}
              limit={chatLimit}
              initialMessages={consultation.messages.map((message) => ({
                id: message.id,
                role: message.role,
                content: message.content,
              }))}
            />
          ) : null}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="اطلاعات ثبت‌شده" />
            <dl className="space-y-3 text-sm">
              {fields.map((field) => (
                <div key={field.key}>
                  <dt className="text-xs text-muted">{field.label}</dt>
                  <dd className="mt-0.5 leading-7">{formatAnswer(answers[field.key])}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {consultation.payment ? (
            <Card className="no-print">
              <CardHeader title="پرداخت" />
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">مبلغ</dt>
                  <dd>{formatRialAsToman(consultation.payment.amount)}</dd>
                </div>
                {consultation.payment.discountAmount > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">تخفیف</dt>
                    <dd>{formatRialAsToman(consultation.payment.discountAmount)}</dd>
                  </div>
                ) : null}
                {consultation.payment.refNumber ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">شماره پیگیری</dt>
                    <dd dir="ltr">{consultation.payment.refNumber}</dd>
                  </div>
                ) : null}
                {consultation.payment.paidAt ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">تاریخ پرداخت</dt>
                    <dd>{formatDateTime(consultation.payment.paidAt)}</dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}
