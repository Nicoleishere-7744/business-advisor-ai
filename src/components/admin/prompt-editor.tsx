"use client";

import { useActionState, useState } from "react";
import { Alert, Card, CardHeader, HelpText, Input, Label, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/admin/action-form";
import { deletePrompt, savePrompt } from "@/app/admin/actions";

// ویرایش قالب‌های پرامپت

type TemplateRow = {
  id: string;
  name: string;
  systemPrompt: string;
  userTemplate: string;
  isActive: boolean;
};

export function PromptEditor({
  templates,
  defaults,
}: {
  templates: TemplateRow[];
  defaults: { systemPrompt: string; userTemplate: string };
}) {
  const activeTemplate = templates.find((template) => template.isActive) ?? templates[0];
  const [selectedId, setSelectedId] = useState(activeTemplate?.id ?? "");
  const [saveState, saveAction] = useActionState(savePrompt, null);
  const [deleteState, deleteAction] = useActionState(deletePrompt, null);

  const editing = templates.find((template) => template.id === selectedId) ?? {
    id: "",
    name: "",
    systemPrompt: defaults.systemPrompt,
    userTemplate: defaults.userTemplate,
    isActive: templates.length === 0,
  };

  return (
    <Card>
      <CardHeader
        title={editing.id ? "ویرایش قالب" : "قالب جدید"}
        description="فقط یک قالب می‌تواند فعال باشد؛ فعال کردن یک قالب بقیه را غیرفعال می‌کند."
        action={
          <Select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="w-64"
          >
            <option value="">+ قالب جدید</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
                {template.isActive ? " (فعال)" : ""}
              </option>
            ))}
          </Select>
        }
      />

      <form key={editing.id || "new"} action={saveAction} className="space-y-5">
        <input type="hidden" name="id" value={editing.id} />

        <div>
          <Label htmlFor="name">نام قالب</Label>
          <Input id="name" name="name" defaultValue={editing.name} />
        </div>

        <div>
          <Label htmlFor="systemPrompt">پرامپت سیستمی (نقش و قواعد نگارش)</Label>
          <Textarea
            id="systemPrompt"
            name="systemPrompt"
            className="min-h-64 font-mono text-xs leading-6"
            defaultValue={editing.systemPrompt}
          />
          <HelpText>ساختار سرفصل‌های گزارش را همین‌جا تعیین کن.</HelpText>
        </div>

        <div>
          <Label htmlFor="userTemplate">قالب پیام کاربر</Label>
          <Textarea
            id="userTemplate"
            name="userTemplate"
            className="min-h-56 font-mono text-xs leading-6"
            defaultValue={editing.userTemplate}
          />
          <HelpText>
            <span dir="ltr">{"{{field_key}}"}</span> با پاسخ کاربر جایگزین می‌شود.
          </HelpText>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={editing.isActive} />
          این قالب فعال باشد
        </label>

        {saveState ? (
          <Alert tone={saveState.ok ? "success" : "danger"}>{saveState.message}</Alert>
        ) : null}

        <SubmitButton>{editing.id ? "ذخیره تغییرات" : "ساخت قالب"}</SubmitButton>
      </form>

      {editing.id && !editing.isActive ? (
        <form action={deleteAction} className="mt-6 border-t border-border pt-6">
          <input type="hidden" name="id" value={editing.id} />
          {deleteState ? (
            <Alert tone={deleteState.ok ? "success" : "danger"} className="mb-4">
              {deleteState.message}
            </Alert>
          ) : null}
          <SubmitButton variant="danger" size="sm" confirm="این قالب حذف شود؟">
            حذف قالب
          </SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}
