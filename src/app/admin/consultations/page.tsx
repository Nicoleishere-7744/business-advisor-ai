import Link from "next/link";
import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { Badge, Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import {
  CONSULTATION_STATUSES,
  CONSULTATION_STATUS_LABELS,
  type ConsultationStatus,
} from "@/lib/constants";
import { toLocalPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "مشاوره‌ها" };

const STATUS_TONE = {
  awaiting_payment: "warning",
  paid: "info",
  generating: "info",
  completed: "success",
  failed: "danger",
} as const;

export default async function AdminConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireAdminPage();
  const { status } = await searchParams;

  const validStatus = CONSULTATION_STATUSES.includes(status as ConsultationStatus)
    ? (status as ConsultationStatus)
    : null;

  const consultations = await prisma.consultation.findMany({
    where: validStatus ? { status: validStatus } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { phone: true } },
      payment: { select: { status: true } },
    },
  });

  return (
    <AdminPage user={user} activeHref="/admin/consultations">
      <PageHeader title="مشاوره‌ها" description="همه درخواست‌های مشاوره و وضعیت گزارش آن‌ها." />

      <Card className="mb-6">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/consultations"
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              !validStatus ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-muted",
            )}
          >
            همه
          </Link>
          {CONSULTATION_STATUSES.map((item) => (
            <Link
              key={item}
              href={`/admin/consultations?status=${item}`}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                validStatus === item
                  ? "bg-primary-soft text-primary"
                  : "text-muted hover:bg-surface-muted",
              )}
            >
              {CONSULTATION_STATUS_LABELS[item]}
            </Link>
          ))}
        </div>
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>عنوان</Th>
            <Th>کاربر</Th>
            <Th>وضعیت</Th>
            <Th>پرداخت</Th>
            <Th>مدل</Th>
            <Th>تاریخ</Th>
          </tr>
        </thead>
        <tbody>
          {consultations.length === 0 ? (
            <tr>
              <Td colSpan={6} className="py-8 text-center text-muted">
                مشاوره‌ای یافت نشد.
              </Td>
            </tr>
          ) : (
            consultations.map((consultation) => (
              <tr key={consultation.id}>
                <Td className="font-medium">
                  <Link
                    href={`/admin/consultations/${consultation.id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {consultation.title ?? "بدون عنوان"}
                  </Link>
                </Td>
                <Td dir="ltr" className="text-right text-muted">
                  {toLocalPhone(consultation.user.phone)}
                </Td>
                <Td>
                  <Badge tone={STATUS_TONE[consultation.status as ConsultationStatus]}>
                    {CONSULTATION_STATUS_LABELS[consultation.status as ConsultationStatus]}
                  </Badge>
                </Td>
                <Td className="text-muted">
                  {consultation.payment?.status === "verified" ? "تأیید شده" : "—"}
                </Td>
                <Td className="text-xs text-muted">{consultation.modelSlug ?? "—"}</Td>
                <Td className="text-muted">{formatDateTime(consultation.createdAt)}</Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </AdminPage>
  );
}
