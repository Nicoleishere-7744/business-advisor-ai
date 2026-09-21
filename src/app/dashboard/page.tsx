import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { Badge, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireUserPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { CONSULTATION_STATUS_LABELS, type ConsultationStatus } from "@/lib/constants";
import { USER_NAV } from "@/lib/nav";

export const metadata: Metadata = { title: "مشاوره‌های من" };

const STATUS_TONE = {
  awaiting_payment: "warning",
  paid: "info",
  generating: "info",
  completed: "success",
  failed: "danger",
} as const;

export default async function DashboardPage() {
  const user = await requireUserPage("/dashboard");

  const consultations = await prisma.consultation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      completedAt: true,
    },
  });

  return (
    <AppShell user={user} nav={USER_NAV} activeHref="/dashboard">
      <PageHeader
        title="مشاوره‌های من"
        description="گزارش‌های دریافتی و درخواست‌های در جریان شما."
        action={<LinkButton href="/consultation/new">مشاوره جدید</LinkButton>}
      />

      {consultations.length === 0 ? (
        <EmptyState
          title="هنوز مشاوره‌ای ثبت نکرده‌اید"
          description="اطلاعات کسب‌وکارتان را وارد کنید تا اولین گزارش اختصاصی‌تان تولید شود."
          action={<LinkButton href="/consultation/new">شروع اولین مشاوره</LinkButton>}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>عنوان</Th>
              <Th>وضعیت</Th>
              <Th>تاریخ ثبت</Th>
              <Th>تاریخ تکمیل</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {consultations.map((consultation) => {
              const status = consultation.status as ConsultationStatus;
              return (
                <tr key={consultation.id}>
                  <Td className="font-medium">{consultation.title ?? "بدون عنوان"}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[status]}>
                      {CONSULTATION_STATUS_LABELS[status]}
                    </Badge>
                  </Td>
                  <Td className="text-muted">{formatDateTime(consultation.createdAt)}</Td>
                  <Td className="text-muted">{formatDateTime(consultation.completedAt)}</Td>
                  <Td className="text-left">
                    <Link
                      href={`/consultation/${consultation.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {status === "awaiting_payment" ? "پرداخت" : "مشاهده"}
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </AppShell>
  );
}
