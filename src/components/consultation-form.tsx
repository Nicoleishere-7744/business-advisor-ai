"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  FieldError,
  HelpText,
  Input,
  Label,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import {
  buildFormSchema,
  emptyFormValues,
  type FormFieldDefinition,
} from "@/lib/validation/dynamic-form";
import { formatRialAsToman } from "@/lib/format";
import { toLatinDigits } from "@/lib/phone";

// فرم داینامیک اطلاعات کسب‌وکار.
// همان اسکیمای zod سرور اینجا هم استفاده می‌شود تا قوانین اعتبارسنجی یکی باشند.

type Values = Record<string, string | string[]>;

export function ConsultationForm({
  fields,
  price,
}: {
  fields: FormFieldDefinition[];
  price: number;
}) {
  const router = useRouter();
  const schema = useMemo(() => buildFormSchema(fields), [fields]);
  const [values, setValues] = useState<Values>(() => emptyFormValues(fields));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [discountCode, setDiscountCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function setValue(key: string, value: string | string[]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function toggleMulti(key: string, option: string) {
    const current = values[key];
    const list = Array.isArray(current) ? current : [];
    setValue(key, list.includes(option) ? list.filter((item) => item !== option) : [...list, option]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setFormError("لطفاً خطاهای مشخص‌شده را برطرف کنید.");
      const firstKey = Object.keys(fieldErrors)[0];
      if (firstKey) {
        document.getElementById(`field-${firstKey}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      return;
    }

    setPending(true);
    try {
      const createResponse = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: parsed.data }),
      });
      const created = await createResponse.json();

      if (!createResponse.ok) {
        setFormError(created.error ?? "ثبت اطلاعات ناموفق بود.");
        if (created.field) setErrors({ [created.field]: created.error });
        return;
      }

      const payResponse = await fetch("/api/payments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultationId: created.consultationId,
          discountCode: discountCode.trim() || undefined,
        }),
      });
      const payment = await payResponse.json();

      if (!payResponse.ok) {
        // مشاوره ثبت شده؛ کاربر می‌تواند از داشبورد دوباره پرداخت را شروع کند
        setFormError(
          `${payment.error ?? "شروع پرداخت ناموفق بود."} اطلاعات شما ذخیره شد و می‌توانید از داشبورد پرداخت را تکرار کنید.`,
        );
        return;
      }

      if (payment.free) {
        router.push(payment.redirectUrl);
        return;
      }

      window.location.href = payment.redirectUrl;
    } catch {
      setFormError("ارتباط با سرور برقرار نشد.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Card>
        <div className="space-y-6">
          {fields.map((field) => {
            const value = values[field.key];
            const error = errors[field.key];
            const inputId = `field-${field.key}`;

            return (
              <div key={field.key} id={inputId}>
                <Label htmlFor={`${inputId}-control`}>
                  {field.label}
                  {field.required ? <span className="text-danger"> *</span> : null}
                </Label>

                {field.type === "textarea" ? (
                  <Textarea
                    id={`${inputId}-control`}
                    placeholder={field.placeholder ?? ""}
                    maxLength={field.maxLength ?? undefined}
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) => setValue(field.key, event.target.value)}
                    disabled={pending}
                  />
                ) : field.type === "select" ? (
                  <Select
                    id={`${inputId}-control`}
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) => setValue(field.key, event.target.value)}
                    disabled={pending}
                  >
                    <option value="">— انتخاب کنید —</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : field.type === "multiselect" ? (
                  <div className="flex flex-wrap gap-2">
                    {field.options.map((option) => {
                      const list = Array.isArray(value) ? value : [];
                      const active = list.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={pending}
                          onClick={() => toggleMulti(field.key, option.value)}
                          className={
                            active
                              ? "rounded-xl border border-primary bg-primary-soft px-3 py-2 text-sm text-primary"
                              : "rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted hover:border-primary/40"
                          }
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : field.type === "number" ? (
                  <Input
                    id={`${inputId}-control`}
                    inputMode="numeric"
                    dir="ltr"
                    className="text-left"
                    placeholder={field.placeholder ?? ""}
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) =>
                      setValue(field.key, toLatinDigits(event.target.value).replace(/[^\d-]/g, ""))
                    }
                    disabled={pending}
                  />
                ) : (
                  <Input
                    id={`${inputId}-control`}
                    placeholder={field.placeholder ?? ""}
                    maxLength={field.maxLength ?? undefined}
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) => setValue(field.key, event.target.value)}
                    disabled={pending}
                  />
                )}

                <HelpText>{field.helpText}</HelpText>
                <FieldError>{error}</FieldError>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-52 flex-1">
            <Label htmlFor="discount">کد تخفیف (اختیاری)</Label>
            <Input
              id="discount"
              value={discountCode}
              onChange={(event) => setDiscountCode(event.target.value.toUpperCase())}
              placeholder="مثلاً: WELCOME"
              disabled={pending}
            />
          </div>
          <div className="text-sm text-muted">
            مبلغ قابل پرداخت:{" "}
            <strong className="text-foreground">{formatRialAsToman(price)}</strong>
            <p className="mt-1 text-xs">تخفیف در مرحله پرداخت اعمال می‌شود.</p>
          </div>
        </div>
      </Card>

      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          {pending ? "در حال انتقال به درگاه…" : "ثبت و پرداخت"}
        </Button>
        <p className="text-xs text-muted">
          پس از پرداخت موفق، گزارش بلافاصله تولید می‌شود.
        </p>
      </div>
    </form>
  );
}
