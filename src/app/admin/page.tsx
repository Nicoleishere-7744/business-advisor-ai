import Link from "next/link";
import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { Badge, Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDateTime, formatNumber, formatRialAsToman, formatUsd } from "@/lib/format";
import { CONSULTATION_STATUS_LABELS, type ConsultationStatus } from "@/lib/constants";
import { toLocalPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "داشبورد مدیریت" };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const user = await requireAdminPage();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [
    usersCount,
    consultationsCount,
    completedCount,
    revenue,
    revenue30,
    aiCost,
    recentConsultations,
    pendingPayments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.consultation.count(),
    prisma.consultation.count({ where: { status: "completed" } }),
    prisma.payment.aggregate({ where: { status: "verified" }, _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: { status: "verified", verifiedAt: { gte: since } },
      _sum: { amount: true },
    }),
    prisma.aiUsageLog.aggregate({ _sum: { costUsd: true } }),
    prisma.consultation.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { phone: true } } },
    }),
    prisma.payment.count({ where: { status: { in: ["pending", "paid"] } } }),
  ]);

  return (
    <AdminPage user={user} activeHref="/admin">
      <PageHeader title="داشبورد" description="نمای کلی وضعیت پلتفرم" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="کاربران" value={formatNumber(usersCount)} />
        <Stat
          label="مشاوره‌ها"
          value={formatNumber(consultationsCount)}
          hint={`${formatNumber(completedCount)} گزارش تکمیل‌شده`}
        />
        <Stat
          label="درآمد کل"
          value={formatRialAsToman(revenue._sum.amount ?? 0)}
          hint={`۳۰ روز اخیر: ${formatRialAsToman(revenue30._sum.amount ?? 0)}`}
        />
        <Stat
          label="هزینه هوش مصنوعی"
          value={formatUsd(aiCost._sum.costUsd ?? 0)}
          hint={pendingPayments > 0 ? `${formatNumber(pendingPayments)} پرداخت معلق` : undefined}
        />
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">آخرین مشاوره‌ها</h2>
          <Link href="/admin/consultations" className="text-sm text-primary hover:underline">
            مشاهده همه
          </Link>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>عنوان</Th>
              <Th>کاربر</Th>
              <Th>وضعیت</Th>
              <Th>مدل</Th>
              <Th>تاریخ</Th>
            </tr>
          </thead>
          <tbody>
            {recentConsultations.length === 0 ? (
              <tr>
                <Td colSpan={5} className="py-8 text-center text-muted">
                  هنوز مشاوره‌ای ثبت نشده است.
                </Td>
              </tr>
            ) : (
              recentConsultations.map((consultation) => (
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
                    <Badge>
                      {CONSULTATION_STATUS_LABELS[consultation.status as ConsultationStatus]}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-muted">{consultation.modelSlug ?? "—"}</Td>
                  <Td className="text-muted">{formatDateTime(consultation.createdAt)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </AdminPage>
  );
}
