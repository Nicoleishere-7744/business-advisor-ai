import Link from "next/link";
import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { ActionForm } from "@/components/admin/action-form";
import { Badge, Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { reverifyPayment } from "@/app/admin/actions";
import { formatDateTime, formatRialAsToman } from "@/lib/format";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUSES, type PaymentStatus } from "@/lib/constants";
import { describeZibalStatus } from "@/lib/payments/zibal";
import { toLocalPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "تراکنش‌ها" };

const STATUS_TONE: Record<PaymentStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  pending: "warning",
  paid: "info",
  verified: "success",
  failed: "danger",
  canceled: "neutral",
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireAdminPage();
  const { status } = await searchParams;

  const validStatus = PAYMENT_STATUSES.includes(status as PaymentStatus)
    ? (status as PaymentStatus)
    : null;

  const payments = await prisma.payment.findMany({
    where: validStatus ? { status: validStatus } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { phone: true } },
      discountCode: { select: { code: true } },
    },
  });

  return (
    <AdminPage user={user} activeHref="/admin/payments">
      <PageHeader
        title="تراکنش‌ها"
        description="وضعیت پرداخت‌ها و امکان وریفای مجدد تراکنش‌های معلق."
      />

      <Card className="mb-6">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/payments"
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              !validStatus ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-muted",
            )}
          >
            همه
          </Link>
          {PAYMENT_STATUSES.map((item) => (
            <Link
              key={item}
              href={`/admin/payments?status=${item}`}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                validStatus === item
                  ? "bg-primary-soft text-primary"
                  : "text-muted hover:bg-surface-muted",
              )}
            >
              {PAYMENT_STATUS_LABELS[item]}
            </Link>
          ))}
        </div>
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>کاربر</Th>
            <Th>مبلغ</Th>
            <Th>وضعیت</Th>
            <Th>شناسه پیگیری</Th>
            <Th>تاریخ</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr>
              <Td colSpan={6} className="py-8 text-center text-muted">
                تراکنشی یافت نشد.
              </Td>
            </tr>
          ) : (
            payments.map((payment) => {
              const paymentStatus = payment.status as PaymentStatus;
              return (
                <tr key={payment.id}>
                  <Td dir="ltr" className="text-right">
                    {toLocalPhone(payment.user.phone)}
                  </Td>
                  <Td>
                    {formatRialAsToman(payment.amount)}
                    {payment.discountCode ? (
                      <p className="mt-1 text-xs text-muted">کد: {payment.discountCode.code}</p>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[paymentStatus]}>
                      {PAYMENT_STATUS_LABELS[paymentStatus]}
                    </Badge>
                    {payment.failureReason ? (
                      <p className="mt-1 text-xs text-danger">{payment.failureReason}</p>
                    ) : payment.zibalStatus !== null ? (
                      <p className="mt-1 text-xs text-muted">
                        {describeZibalStatus(payment.zibalStatus)}
                      </p>
                    ) : null}
                  </Td>
                  <Td dir="ltr" className="text-right text-xs text-muted">
                    {payment.trackId ?? "—"}
                    {payment.refNumber ? <p className="mt-1">Ref: {payment.refNumber}</p> : null}
                  </Td>
                  <Td className="text-muted">{formatDateTime(payment.createdAt)}</Td>
                  <Td className="text-left">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/consultations/${payment.consultationId}`}
                        className="text-sm text-primary hover:underline"
                      >
                        مشاوره
                      </Link>
                      {payment.trackId && payment.status !== "verified" ? (
                        <ActionForm
                          action={reverifyPayment}
                          submitLabel="وریفای مجدد"
                          submitVariant="secondary"
                          submitSize="sm"
                          hideMessage
                        >
                          <input type="hidden" name="id" value={payment.id} />
                        </ActionForm>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              );
            })
          )}
        </tbody>
      </Table>
    </AdminPage>
  );
}
