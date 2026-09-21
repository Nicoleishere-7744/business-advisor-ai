"use client";

import { useActionState, useState } from "react";
import {
  Alert,
  Card,
  CardHeader,
  HelpText,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import { SubmitButton } from "@/components/admin/action-form";
import { deleteFormField, saveFormField } from "@/app/admin/actions";
import { FORM_FIELD_TYPES, FORM_FIELD_TYPE_LABELS, type FormFieldType } from "@/lib/constants";

// افزودن/ویرایش فیلدهای فرم داینامیک

type FieldRow = {
  id: string;
  key: string;
  label: string;
  type: FormFieldType;
  placeholder: string | null;
  helpText: string | null;
  optionLines: string;
  required: boolean;
  isActive: boolean;
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  order: number;
};

const EMPTY: FieldRow = {
  id: "",
  key: "",
  label: "",
  type: "text",
  placeholder: null,
  helpText: null,
  optionLines: "",
  required: true,
  isActive: true,
  minLength: null,
  maxLength: null,
  minValue: null,
  maxValue: null,
  order: 0,
};

export function FormFieldEditor({ fields }: { fields: FieldRow[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [saveState, saveAction] = useActionState(saveFormField, null);
  const [deleteState, deleteAction] = useActionState(deleteFormField, null);

  const editing = fields.find((field) => field.id === selectedId) ?? EMPTY;
  const [type, setType] = useState<FormFieldType>(editing.type);

  // با تعویض فیلد انتخاب‌شده، فرم و نوع باید ریست شوند
  function selectField(id: string) {
    setSelectedId(id);
    setType(fields.find((field) => field.id === id)?.type ?? "text");
  }

  const needsOptions = type === "select" || type === "multiselect";

  return (
    <Card>
      <CardHeader
        title={editing.id ? `ویرایش فیلد «${editing.label}»` : "افزودن فیلد جدید"}
        action={
          <Select
            value={selectedId}
            onChange={(event) => selectField(event.target.value)}
            className="w-56"
          >
            <option value="">+ فیلد جدید</option>
            {fields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.label}
              </option>
            ))}
          </Select>
        }
      />

      <form key={editing.id || "new"} action={saveAction} className="space-y-5">
        <input type="hidden" name="id" value={editing.id} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="label">برچسب (متنی که کاربر می‌بیند)</Label>
            <Input id="label" name="label" defaultValue={editing.label} />
          </div>
          <div>
            <Label htmlFor="key">کلید انگلیسی</Label>
            <Input
              id="key"
              name="key"
              defaultValue={editing.key}
              dir="ltr"
              className="text-left"
              placeholder="business_name"
              readOnly={Boolean(editing.id)}
            />
            <HelpText>
              {editing.id
                ? "کلید فیلد ذخیره‌شده قابل تغییر نیست."
                : "در قالب پرامپت به شکل {{key}} استفاده می‌شود."}
            </HelpText>
          </div>

          <div>
            <Label htmlFor="type">نوع فیلد</Label>
            <Select
              id="type"
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as FormFieldType)}
            >
              {FORM_FIELD_TYPES.map((item) => (
                <option key={item} value={item}>
                  {FORM_FIELD_TYPE_LABELS[item]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="order">ترتیب نمایش</Label>
            <Input
              id="order"
              name="order"
              type="number"
              defaultValue={editing.order}
              dir="ltr"
              className="text-left"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="placeholder">متن راهنمای داخل فیلد</Label>
            <Input id="placeholder" name="placeholder" defaultValue={editing.placeholder ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="helpText">توضیح زیر فیلد</Label>
            <Input id="helpText" name="helpText" defaultValue={editing.helpText ?? ""} />
          </div>

          {needsOptions ? (
            <div className="sm:col-span-2">
              <Label htmlFor="options">گزینه‌ها (هر خط یک گزینه)</Label>
              <Textarea id="options" name="options" defaultValue={editing.optionLines} />
            </div>
          ) : null}

          {type === "number" ? (
            <>
              <div>
                <Label htmlFor="minValue">حداقل مقدار</Label>
                <Input
                  id="minValue"
                  name="minValue"
                  type="number"
                  defaultValue={editing.minValue ?? ""}
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div>
                <Label htmlFor="maxValue">حداکثر مقدار</Label>
                <Input
                  id="maxValue"
                  name="maxValue"
                  type="number"
                  defaultValue={editing.maxValue ?? ""}
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </>
          ) : null}

          {type === "text" || type === "textarea" ? (
            <>
              <div>
                <Label htmlFor="minLength">حداقل طول متن</Label>
                <Input
                  id="minLength"
                  name="minLength"
                  type="number"
                  defaultValue={editing.minLength ?? ""}
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div>
                <Label htmlFor="maxLength">حداکثر طول متن</Label>
                <Input
                  id="maxLength"
                  name="maxLength"
                  type="number"
                  defaultValue={editing.maxLength ?? ""}
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </>
          ) : null}

          <div className="flex items-end gap-6 pb-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="required" defaultChecked={editing.required} />
              پر کردن الزامی است
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={editing.isActive} />
              فعال (در فرم نمایش داده شود)
            </label>
          </div>
        </div>

        {saveState ? (
          <Alert tone={saveState.ok ? "success" : "danger"}>{saveState.message}</Alert>
        ) : null}

        <SubmitButton>{editing.id ? "ذخیره تغییرات" : "افزودن فیلد"}</SubmitButton>
      </form>

      {editing.id ? (
        <form action={deleteAction} className="mt-6 border-t border-border pt-6">
          <input type="hidden" name="id" value={editing.id} />
          {deleteState ? (
            <Alert tone={deleteState.ok ? "success" : "danger"} className="mb-4">
              {deleteState.message}
            </Alert>
          ) : null}
          <HelpText>
            برای حذف نکردن سوابق، معمولاً بهتر است فیلد را غیرفعال کنی نه حذف.
          </HelpText>
          <div className="mt-3">
            <SubmitButton variant="danger" size="sm" confirm="این فیلد برای همیشه حذف شود؟">
              حذف فیلد
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
