import Link from "next/link";
import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { Badge, Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDateTime, formatNumber, formatUsd } from "@/lib/format";
import { toLocalPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "مصرف هوش مصنوعی" };

const RANGES = [
  { key: "7", label: "۷ روز اخیر" },
  { key: "30", label: "۳۰ روز اخیر" },
  { key: "90", label: "۹۰ روز اخیر" },
  { key: "all", label: "همه" },
] as const;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold" dir="ltr">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireAdminPage();
  const { range } = await searchParams;

  const activeRange = RANGES.find((item) => item.key === range) ?? RANGES[1];
  const days = activeRange.key === "all" ? null : Number(activeRange.key);
  const since = days ? new Date(Date.now() - days * 86400_000) : null;
  const where = since ? { createdAt: { gte: since } } : {};

  const [totals, byModel, recent, failures] = await Promise.all([
    prisma.aiUsageLog.aggregate({
      where,
      _sum: { costUsd: true, totalTokens: true, promptTokens: true, completionTokens: true },
      _count: true,
    }),
    prisma.aiUsageLog.groupBy({
      by: ["modelSlug"],
      where,
      _sum: { costUsd: true, totalTokens: true },
      _count: true,
    }),
    prisma.aiUsageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { phone: true } } },
    }),
    prisma.aiUsageLog.count({ where: { ...where, success: false } }),
  ]);

  const totalCost = totals._sum.costUsd ?? 0;
  const totalCalls = totals._count;

  return (
    <AdminPage user={user} activeHref="/admin/usage">
      <PageHeader
        title="مصرف و هزینه هوش مصنوعی"
        description="بر اساس مقادیر usage که OpenRouter در هر پاسخ برمی‌گرداند."
      />

      <Card className="mb-6">
        <div className="flex flex-wrap gap-2">
          {RANGES.map((item) => (
            <Link
              key={item.key}
              href={`/admin/usage?range=${item.key}`}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                activeRange.key === item.key
                  ? "bg-primary-soft text-primary"
                  : "text-muted hover:bg-surface-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="هزینه کل" value={formatUsd(totalCost)} />
        <Stat
          label="تعداد فراخوانی"
          value={formatNumber(totalCalls)}
          hint={failures > 0 ? `${formatNumber(failures)} ناموفق` : undefined}
        />
        <Stat label="مجموع توکن" value={formatNumber(totals._sum.totalTokens ?? 0)} />
        <Stat
          label="میانگین هزینه هر فراخوانی"
          value={formatUsd(totalCalls > 0 ? totalCost / totalCalls : 0)}
        />
      </div>

      <div className="mt-8 space-y-8">
        <div>
          <h2 className="mb-4 font-bold">تفکیک به مدل</h2>
          <Table>
            <thead>
              <tr>
                <Th>مدل</Th>
                <Th>تعداد</Th>
                <Th>توکن</Th>
                <Th>هزینه</Th>
              </tr>
            </thead>
            <tbody>
              {byModel.length === 0 ? (
                <tr>
                  <Td colSpan={4} className="py-8 text-center text-muted">
                    داده‌ای در این بازه ثبت نشده است.
                  </Td>
                </tr>
              ) : (
                byModel
                  .slice()
                  .sort((a, b) => (b._sum.costUsd ?? 0) - (a._sum.costUsd ?? 0))
                  .map((row) => (
                    <tr key={row.modelSlug}>
                      <Td dir="ltr" className="text-right text-xs">
                        {row.modelSlug}
                      </Td>
                      <Td>{formatNumber(row._count)}</Td>
                      <Td>{formatNumber(row._sum.totalTokens ?? 0)}</Td>
                      <Td dir="ltr" className="text-right">
                        {formatUsd(row._sum.costUsd ?? 0)}
                      </Td>
                    </tr>
                  ))
              )}
            </tbody>
          </Table>
        </div>

        <div>
          <h2 className="mb-4 font-bold">آخرین فراخوانی‌ها</h2>
          <Table>
            <thead>
              <tr>
                <Th>تاریخ</Th>
                <Th>کاربر</Th>
                <Th>نوع</Th>
                <Th>مدل</Th>
                <Th>توکن</Th>
                <Th>هزینه</Th>
                <Th>وضعیت</Th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="py-8 text-center text-muted">
                    داده‌ای ثبت نشده است.
                  </Td>
                </tr>
              ) : (
                recent.map((log) => (
                  <tr key={log.id}>
                    <Td className="text-muted">{formatDateTime(log.createdAt)}</Td>
                    <Td dir="ltr" className="text-right text-muted">
                      {log.user ? toLocalPhone(log.user.phone) : "—"}
                    </Td>
                    <Td>{log.kind === "chat" ? "چت پیگیری" : "گزارش"}</Td>
                    <Td dir="ltr" className="text-right text-xs text-muted">
                      {log.modelSlug}
                    </Td>
                    <Td>{formatNumber(log.totalTokens)}</Td>
                    <Td dir="ltr" className="text-right">
                      {formatUsd(log.costUsd)}
                    </Td>
                    <Td>
                      {log.success ? (
                        <Badge tone="success">موفق</Badge>
                      ) : (
                        <Badge tone="danger">ناموفق</Badge>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </div>
    </AdminPage>
  );
}
