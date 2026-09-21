import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { ModelEditor } from "@/components/admin/model-editor";
import { ActionForm } from "@/components/admin/action-form";
import { Badge, Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { setDefaultModel } from "@/app/admin/actions";

export const metadata: Metadata = { title: "مدل‌های هوش مصنوعی" };

export default async function AdminModelsPage() {
  const user = await requireAdminPage();
  const models = await prisma.aiModelConfig.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <AdminPage user={user} activeHref="/admin/models">
      <PageHeader
        title="مدل‌های هوش مصنوعی"
        description="مدل‌های قابل استفاده را مدیریت کن و مدل پیش‌فرض تولید گزارش را انتخاب کن."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="مدل‌های تعریف‌شده"
            description="گزارش‌ها با مدل پیش‌فرض تولید می‌شوند."
          />
          <Table>
            <thead>
              <tr>
                <Th>نام</Th>
                <Th>شناسه (slug)</Th>
                <Th>وضعیت</Th>
                <Th>پارامترها</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {models.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="py-8 text-center text-muted">
                    هنوز مدلی تعریف نشده است.
                  </Td>
                </tr>
              ) : (
                models.map((model) => (
                  <tr key={model.id}>
                    <Td className="font-medium">
                      {model.displayName}
                      {model.description ? (
                        <p className="mt-1 text-xs font-normal text-muted">{model.description}</p>
                      ) : null}
                    </Td>
                    <Td dir="ltr" className="text-right text-xs text-muted">
                      {model.modelSlug}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {model.isDefault ? <Badge tone="success">پیش‌فرض</Badge> : null}
                        <Badge tone={model.isActive ? "info" : "neutral"}>
                          {model.isActive ? "فعال" : "غیرفعال"}
                        </Badge>
                      </div>
                    </Td>
                    <Td className="text-xs text-muted">
                      <span dir="ltr">
                        temp {model.temperature} · max {model.maxTokens}
                      </span>
                    </Td>
                    <Td className="text-left">
                      {model.isDefault ? null : (
                        <ActionForm
                          action={setDefaultModel}
                          submitLabel="پیش‌فرض کن"
                          submitVariant="secondary"
                          submitSize="sm"
                          hideMessage
                        >
                          <input type="hidden" name="id" value={model.id} />
                        </ActionForm>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>

        <ModelEditor
          models={models.map((model) => ({
            id: model.id,
            modelSlug: model.modelSlug,
            displayName: model.displayName,
            description: model.description,
            temperature: model.temperature,
            maxTokens: model.maxTokens,
            isActive: model.isActive,
            isDefault: model.isDefault,
            order: model.order,
          }))}
        />
      </div>
    </AdminPage>
  );
}
