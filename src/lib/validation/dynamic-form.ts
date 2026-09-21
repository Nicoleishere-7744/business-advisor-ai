import { z } from "zod";
import type { FormFieldType } from "@/lib/constants";

// ساخت اسکیمای zod از روی رکوردهای FormField.
// همین تابع هم در سرور (اعتبارسنجی نهایی) و هم در کلاینت (نمایش خطا) استفاده می‌شود
// تا قوانین اعتبارسنجی همیشه یکی باشند.

export type FormFieldOption = { value: string; label: string };

export type FormFieldDefinition = {
  id: string;
  key: string;
  label: string;
  type: FormFieldType;
  placeholder?: string | null;
  helpText?: string | null;
  options: FormFieldOption[];
  required: boolean;
  minLength?: number | null;
  maxLength?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  order: number;
};

/// options ذخیره‌شده به‌صورت رشته JSON را با تحمل خطا تجزیه می‌کند
export function parseFieldOptions(optionsJson: string | null | undefined): FormFieldOption[] {
  if (!optionsJson) return [];
  try {
    const parsed = JSON.parse(optionsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): FormFieldOption | null => {
        if (typeof item === "string") return { value: item, label: item };
        if (item && typeof item === "object" && "value" in item) {
          const value = String((item as Record<string, unknown>).value);
          const label = String((item as Record<string, unknown>).label ?? value);
          return { value, label };
        }
        return null;
      })
      .filter((item): item is FormFieldOption => item !== null);
  } catch {
    return [];
  }
}

type FormFieldRow = {
  id: string;
  key: string;
  label: string;
  type: string;
  placeholder: string | null;
  helpText: string | null;
  optionsJson: string | null;
  required: boolean;
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  order: number;
};

export function toFieldDefinition(row: FormFieldRow): FormFieldDefinition {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type as FormFieldType,
    placeholder: row.placeholder,
    helpText: row.helpText,
    options: parseFieldOptions(row.optionsJson),
    required: row.required,
    minLength: row.minLength,
    maxLength: row.maxLength,
    minValue: row.minValue,
    maxValue: row.maxValue,
    order: row.order,
  };
}

function buildFieldSchema(field: FormFieldDefinition): z.ZodTypeAny {
  const allowedValues = field.options.map((option) => option.value);
  // پیام یکسان برای «مقدار ارسال نشده» تا خطای پیش‌فرض انگلیسی zod به کاربر نرسد
  const missing = { required_error: `«${field.label}» الزامی است.` };

  switch (field.type) {
    case "number": {
      let schema = z.coerce.number({
        ...missing,
        invalid_type_error: `«${field.label}» باید عدد باشد.`,
      });
      if (field.minValue !== null && field.minValue !== undefined) {
        schema = schema.min(field.minValue, {
          message: `«${field.label}» نباید کمتر از ${field.minValue} باشد.`,
        });
      }
      if (field.maxValue !== null && field.maxValue !== undefined) {
        schema = schema.max(field.maxValue, {
          message: `«${field.label}» نباید بیشتر از ${field.maxValue} باشد.`,
        });
      }
      return field.required
        ? schema
        : z.union([schema, z.literal("").transform(() => null), z.null()]).optional();
    }

    case "select": {
      const base = z.string(missing).refine((value) => allowedValues.includes(value), {
        message: `مقدار انتخاب‌شده برای «${field.label}» معتبر نیست.`,
      });
      if (field.required) return base;
      return z.union([base, z.literal("")]).optional();
    }

    case "multiselect": {
      let schema = z.array(
        z.string().refine((value) => allowedValues.includes(value), {
          message: `مقدار انتخاب‌شده برای «${field.label}» معتبر نیست.`,
        }),
        missing,
      );
      if (field.required) {
        schema = schema.min(1, { message: `حداقل یک گزینه برای «${field.label}» انتخاب کنید.` });
      }
      return field.required ? schema : schema.optional();
    }

    default: {
      // text و textarea
      let schema = z.string(missing).trim();
      const min = field.minLength ?? (field.required ? 1 : 0);
      if (min > 0) {
        schema = schema.min(min, {
          message:
            min === 1
              ? `«${field.label}» الزامی است.`
              : `«${field.label}» باید حداقل ${min} کاراکتر باشد.`,
        });
      }
      schema = schema.max(field.maxLength ?? 2000, {
        message: `«${field.label}» بیش از حد طولانی است.`,
      });
      return field.required ? schema : schema.optional();
    }
  }
}

/// اسکیمای کل فرم بر اساس فیلدهای فعال
export function buildFormSchema(fields: FormFieldDefinition[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    shape[field.key] = buildFieldSchema(field);
  }
  // فیلدهای ناشناخته حذف می‌شوند تا داده اضافی وارد پرامپت نشود
  return z.object(shape).strip();
}

/// مقدار اولیه فرم در کلاینت
export function emptyFormValues(fields: FormFieldDefinition[]): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  for (const field of fields) {
    values[field.key] = field.type === "multiselect" ? [] : "";
  }
  return values;
}
