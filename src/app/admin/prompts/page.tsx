import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { PromptEditor } from "@/components/admin/prompt-editor";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_TEMPLATE } from "@/lib/ai/prompt";

export const metadata: Metadata = { title: "قالب پرامپت" };

export default async function AdminPromptsPage() {
  const user = await requireAdminPage();

  const [templates, fields] = await Promise.all([
    prisma.promptTemplate.findMany({ orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }] }),
    prisma.formField.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: { key: true, label: true },
    }),
  ]);

  return (
    <AdminPage user={user} activeHref="/admin/prompts">
      <PageHeader
        title="قالب پرامپت"
        description="متنی که همراه اطلاعات کاربر به هوش مصنوعی فرستاده می‌شود."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="کلیدهای در دسترس"
            description="این کلیدها را در قالب پیام کاربر بنویس تا با پاسخ کاربر جایگزین شوند."
          />
          <div className="flex flex-wrap gap-2">
            {fields.map((field) => (
              <span
                key={field.key}
                className="rounded-lg bg-surface-muted px-2.5 py-1.5 text-xs"
                title={field.label}
              >
                <span dir="ltr">{`{{${field.key}}}`}</span>
                <span className="mr-2 text-muted">{field.label}</span>
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs leading-6 text-muted">
            هر فیلد فعالی که در قالب استفاده نشود، به‌صورت خودکار در بخش «اطلاعات تکمیلی» به
            انتهای پیام اضافه می‌شود؛ پس افزودن فیلد جدید نیازی به ویرایش قالب ندارد.
          </p>
        </Card>

        <PromptEditor
          templates={templates.map((template) => ({
            id: template.id,
            name: template.name,
            systemPrompt: template.systemPrompt,
            userTemplate: template.userTemplate,
            isActive: template.isActive,
          }))}
          defaults={{
            systemPrompt: DEFAULT_SYSTEM_PROMPT,
            userTemplate: DEFAULT_USER_TEMPLATE,
          }}
        />
      </div>
    </AdminPage>
  );
}
