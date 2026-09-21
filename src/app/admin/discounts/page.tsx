import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { DiscountEditor } from "@/components/admin/discount-editor";
import { Badge, Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDate, formatRialAsToman } from "@/lib/format";

export const metadata: Metadata = { title: "کدهای تخفیف" };

export default async function AdminDiscountsPage() {
  const user = await requireAdminPage();
  const discounts = await prisma.discountCode.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <AdminPage user={user} activeHref="/admin/discounts">
      <PageHeader title="کدهای تخفیف" description="ساخت و مدیریت کدهای تخفیف درصدی یا مبلغی." />

      <div className="space-y-6">
        <Card>
          <CardHeader title="کدهای موجود" />
          <Table>
            <thead>
              <tr>
                <Th>کد</Th>
                <Th>مقدار</Th>
                <Th>استفاده</Th>
                <Th>انقضا</Th>
                <Th>وضعیت</Th>
              </tr>
            </thead>
            <tbody>
              {discounts.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="py-8 text-center text-muted">
                    هنوز کد تخفیفی ساخته نشده است.
                  </Td>
                </tr>
              ) : (
                discounts.map((discount) => {
                  const expired =
                    discount.expiresAt !== null && discount.expiresAt.getTime() < Date.now();
                  const exhausted =
                    discount.maxUses !== null && discount.usedCount >= discount.maxUses;
                  return (
                    <tr key={discount.id}>
                      <Td dir="ltr" className="text-right font-medium">
                        {discount.code}
                      </Td>
                      <Td>
                        {discount.type === "percent"
                          ? `${discount.value}٪`
                          : formatRialAsToman(discount.value)}
                        {discount.minAmount > 0 ? (
                          <p className="mt-1 text-xs text-muted">
                            حداقل سفارش: {formatRialAsToman(discount.minAmount)}
                          </p>
                        ) : null}
                      </Td>
                      <Td className="text-muted">
                        {discount.usedCount}
                        {discount.maxUses !== null ? ` از ${discount.maxUses}` : " (نامحدود)"}
                      </Td>
                      <Td className="text-muted">{formatDate(discount.expiresAt)}</Td>
                      <Td>
                        {!discount.isActive ? (
                          <Badge tone="neutral">غیرفعال</Badge>
                        ) : expired ? (
                          <Badge tone="danger">منقضی</Badge>
                        ) : exhausted ? (
                          <Badge tone="warning">ظرفیت تکمیل</Badge>
                        ) : (
                          <Badge tone="success">فعال</Badge>
                        )}
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </Card>

        <DiscountEditor
          discounts={discounts.map((discount) => ({
            id: discount.id,
            code: discount.code,
            type: discount.type,
            value: discount.value,
            minAmount: discount.minAmount,
            maxUses: discount.maxUses,
            expiresAt: discount.expiresAt ? discount.expiresAt.toISOString().slice(0, 10) : "",
            isActive: discount.isActive,
          }))}
        />
      </div>
    </AdminPage>
  );
}
