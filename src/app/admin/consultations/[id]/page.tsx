import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { parseAnswers, parseFieldsSnapshot } from "@/lib/consultation";
import { formatAnswer } from "@/lib/ai/prompt";
import { formatDateTime, formatRialAsToman, formatUsd } from "@/lib/format";
import {
  CONSULTATION_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type ConsultationStatus,
  type PaymentStatus,
} from "@/lib/constants";
import { toLocalPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "جزئیات مشاوره" };

export default async function AdminConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminPage();
  const { id } = await params;

  const consultation = await prisma.consultation.findUnique({
    where: { id },
    include: {
      user: { select: { phone: true, fullName: true } },
      payment: { include: { discountCode: { select: { code: true } } } },
      messages: { orderBy: { createdAt: "asc" } },
      aiUsageLogs: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!consultation) notFound();

  const answers = parseAnswers(consultation.answersJson);
  const fields = parseFieldsSnapshot(consultation.fieldsSnapshot);
  const totalCost = consultation.aiUsageLogs.reduce((sum, log) => sum + log.costUsd, 0);
  const totalTokens = consultation.aiUsageLogs.reduce((sum, log) => sum + log.totalTokens, 0);

  return (
    <AdminPage user={user} activeHref="/admin/consultations">
      <PageHeader
        title={consultation.title ?? "بدون عنوان"}
        description={`کاربر: ${toLocalPhone(consultation.user.phone)} · ثبت در ${formatDateTime(consultation.createdAt)}`}
        action={
          <Badge>{CONSULTATION_STATUS_LABELS[consultation.status as ConsultationStatus]}</Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {consultation.errorMessage ? (
            <Alert tone="danger">خطای تولید: {consultation.errorMessage}</Alert>
          ) : null}

          <Card>
            <CardHeader title="گزارش تولیدشده" />
            {consultation.reportMarkdown ? (
              <article className="report-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {consultation.reportMarkdown}
                </ReactMarkdown>
              </article>
            ) : (
              <p className="py-6 text-center text-sm text-muted">هنوز گزارشی تولید نشده است.</p>
            )}
          </Card>

          {consultation.messages.length > 0 ? (
            <Card>
              <CardHeader title="سوال‌های پیگیری" />
              <div className="space-y-4">
                {consultation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.role === "user"
                        ? "rounded-2xl bg-primary-soft px-4 py-3 text-sm"
                        : "rounded-2xl bg-surface-muted px-4 py-3 text-sm"
                    }
                  >
                    <p className="mb-1.5 text-xs font-medium text-muted">
                      {message.role === "user" ? "کاربر" : "مشاور"}
                    </p>
                    <div className="report-prose text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
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

          <Card>
            <CardHeader title="پرداخت" />
            {consultation.payment ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">وضعیت</dt>
                  <dd>{PAYMENT_STATUS_LABELS[consultation.payment.status as PaymentStatus]}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">مبلغ</dt>
                  <dd>{formatRialAsToman(consultation.payment.amount)}</dd>
                </div>
                {consultation.payment.discountCode ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">کد تخفیف</dt>
                    <dd>{consultation.payment.discountCode.code}</dd>
                  </div>
                ) : null}
                {consultation.payment.refNumber ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">شماره پیگیری</dt>
                    <dd dir="ltr">{consultation.payment.refNumber}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">تاریخ پرداخت</dt>
                  <dd>{formatDateTime(consultation.payment.paidAt)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted">تراکنشی ثبت نشده است.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="مصرف هوش مصنوعی" />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">مدل</dt>
                <dd dir="ltr" className="text-xs">
                  {consultation.modelSlug ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">مجموع توکن</dt>
                <dd>{totalTokens}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">هزینه</dt>
                <dd dir="ltr">{formatUsd(totalCost)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">تعداد فراخوانی</dt>
                <dd>{consultation.aiUsageLogs.length}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </AdminPage>
  );
}
