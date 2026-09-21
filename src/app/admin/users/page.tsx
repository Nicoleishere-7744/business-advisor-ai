import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { ActionForm } from "@/components/admin/action-form";
import { Badge, Card, Input, PageHeader, Table, Td, Th, Button } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { toggleUserAdmin, toggleUserBlock } from "@/app/admin/actions";
import { formatDateTime, formatNumber } from "@/lib/format";
import { normalizePhone, toLocalPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "کاربران" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAdminPage();
  const { q } = await searchParams;

  // جستجو هم با شماره محلی و هم با فرمت E.164 کار می‌کند
  const normalized = q ? normalizePhone(q) : null;
  const where = q
    ? {
        OR: [
          { phone: { contains: normalized ?? q } },
          { fullName: { contains: q } },
        ],
      }
    : {};

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      _count: { select: { consultations: true } },
    },
  });

  return (
    <AdminPage user={user} activeHref="/admin/users">
      <PageHeader title="کاربران" description="جستجو، مسدودسازی و مدیریت دسترسی کاربران." />

      <Card className="mb-6">
        <form className="flex flex-wrap gap-3">
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="جستجو با شماره موبایل یا نام"
            className="max-w-72"
          />
          <Button type="submit" variant="secondary">
            جستجو
          </Button>
        </form>
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>شماره موبایل</Th>
            <Th>نام</Th>
            <Th>نقش</Th>
            <Th>مشاوره‌ها</Th>
            <Th>عضویت</Th>
            <Th>آخرین ورود</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <Td colSpan={7} className="py-8 text-center text-muted">
                کاربری یافت نشد.
              </Td>
            </tr>
          ) : (
            users.map((row) => (
              <tr key={row.id}>
                <Td dir="ltr" className="text-right font-medium">
                  {toLocalPhone(row.phone)}
                </Td>
                <Td className="text-muted">{row.fullName ?? "—"}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={row.role === "admin" ? "info" : "neutral"}>
                      {row.role === "admin" ? "مدیر" : "کاربر"}
                    </Badge>
                    {row.isBlocked ? <Badge tone="danger">مسدود</Badge> : null}
                  </div>
                </Td>
                <Td>{formatNumber(row._count.consultations)}</Td>
                <Td className="text-muted">{formatDateTime(row.createdAt)}</Td>
                <Td className="text-muted">{formatDateTime(row.lastLoginAt)}</Td>
                <Td className="text-left">
                  {row.id === user.id ? (
                    <span className="text-xs text-muted">حساب شما</span>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <ActionForm
                        action={toggleUserBlock}
                        submitLabel={row.isBlocked ? "رفع مسدودی" : "مسدود کن"}
                        submitVariant={row.isBlocked ? "secondary" : "danger"}
                        submitSize="sm"
                        hideMessage
                      >
                        <input type="hidden" name="id" value={row.id} />
                      </ActionForm>
                      <ActionForm
                        action={toggleUserAdmin}
                        submitLabel={row.role === "admin" ? "حذف دسترسی مدیر" : "مدیر کن"}
                        submitVariant="ghost"
                        submitSize="sm"
                        confirm="نقش این کاربر تغییر کند؟"
                        hideMessage
                      >
                        <input type="hidden" name="id" value={row.id} />
                      </ActionForm>
                    </div>
                  )}
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </AdminPage>
  );
}
