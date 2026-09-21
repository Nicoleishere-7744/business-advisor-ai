"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, Spinner } from "@/components/ui";
import type { ActionState } from "@/app/admin/actions";

// پوشش مشترک فرم‌های پنل مدیریت روی Server Action ها:
// وضعیت pending، نمایش پیام موفقیت/خطا و دکمه ارسال.

type ServerAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  confirm,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {pending ? <Spinner /> : null}
      {children}
    </Button>
  );
}

export function ActionForm({
  action,
  children,
  className,
  submitLabel,
  submitVariant = "primary",
  submitSize = "md",
  confirm,
  hideMessage = false,
}: {
  action: ServerAction;
  children?: React.ReactNode;
  className?: string;
  submitLabel: string;
  submitVariant?: "primary" | "secondary" | "ghost" | "danger";
  submitSize?: "sm" | "md";
  confirm?: string;
  hideMessage?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className={className}>
      {children}
      {!hideMessage && state ? (
        <Alert tone={state.ok ? "success" : "danger"} className="my-4">
          {state.message}
        </Alert>
      ) : null}
      <SubmitButton variant={submitVariant} size={submitSize} confirm={confirm}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
