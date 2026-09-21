import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { FormFieldEditor } from "@/components/admin/form-field-editor";
import { Badge, Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { parseFieldOptions } from "@/lib/validation/dynamic-form";
import { FORM_FIELD_TYPE_LABELS, type FormFieldType } from "@/lib/constants";

export const metadata: Metadata = { title: "فرم‌ساز" };

export default async function AdminFormPage() {
  const user = await requireAdminPage();
  const fields = await prisma.formField.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <AdminPage user={user} activeHref="/admin/form">
      <PageHeader
        title="فرم‌ساز اطلاعات کسب‌وکار"
        description="فیلدهای این فرم مستقیماً به پرامپت هوش مصنوعی می‌روند. کلید هر فیلد در قالب پرامپت با {{key}} قابل استفاده است."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="فیلدهای فعلی" />
          <Table>
            <thead>
              <tr>
                <Th>ترتیب</Th>
                <Th>برچسب</Th>
                <Th>کلید</Th>
                <Th>نوع</Th>
                <Th>وضعیت</Th>
              </tr>
            </thead>
            <tbody>
              {fields.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="py-8 text-center text-muted">
                    هنوز فیلدی تعریف نشده است.
                  </Td>
                </tr>
              ) : (
                fields.map((field) => (
                  <tr key={field.id}>
                    <Td className="text-muted">{field.order}</Td>
                    <Td className="font-medium">
                      {field.label}
                      {field.required ? <span className="text-danger"> *</span> : null}
                    </Td>
                    <Td dir="ltr" className="text-right text-xs text-muted">
                      {`{{${field.key}}}`}
                    </Td>
                    <Td className="text-muted">
                      {FORM_FIELD_TYPE_LABELS[field.type as FormFieldType] ?? field.type}
                    </Td>
                    <Td>
                      <Badge tone={field.isActive ? "success" : "neutral"}>
                        {field.isActive ? "فعال" : "غیرفعال"}
                      </Badge>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>

        <FormFieldEditor
          fields={fields.map((field) => ({
            id: field.id,
            key: field.key,
            label: field.label,
            type: field.type as FormFieldType,
            placeholder: field.placeholder,
            helpText: field.helpText,
            optionLines: parseFieldOptions(field.optionsJson)
              .map((option) => option.label)
              .join("\n"),
            required: field.required,
            isActive: field.isActive,
            minLength: field.minLength,
            maxLength: field.maxLength,
            minValue: field.minValue,
            maxValue: field.maxValue,
            order: field.order,
          }))}
        />
      </div>
    </AdminPage>
  );
}
