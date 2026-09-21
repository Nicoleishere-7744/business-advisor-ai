"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, FieldError, Input, Label, Spinner } from "@/components/ui";
import { OTP_LENGTH } from "@/lib/constants";
import { isValidPhone, toLatinDigits } from "@/lib/phone";

// فرم ورود دو مرحله‌ای: شماره موبایل ← کد پیامکی

type Step = "phone" | "code";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  async function requestCode(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);
    setNotice(null);

    if (!isValidPhone(phone)) {
      setError("شماره موبایل معتبر نیست. مثال: 09121234567");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "ارسال کد ناموفق بود.");
        if (typeof data.retryAfter === "number") setResendIn(data.retryAfter);
        return;
      }

      setStep("code");
      setCode("");
      setResendIn(data.resendAfter ?? 60);
      setNotice(
        data.devMode
          ? "حالت توسعه فعال است؛ کد ورود در کنسول سرور چاپ شده است."
          : "کد ورود برایتان پیامک شد.",
      );
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (code.length !== OTP_LENGTH) {
      setError(`کد ورود باید ${OTP_LENGTH} رقم باشد.`);
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "تأیید کد ناموفق بود.");
        return;
      }

      router.replace(nextPath || (data.isAdmin ? "/admin" : "/dashboard"));
      router.refresh();
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setPending(false);
    }
  }

  if (step === "phone") {
    return (
      <form onSubmit={requestCode} className="space-y-5" noValidate>
        <div>
          <Label htmlFor="phone">شماره موبایل</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            className="text-left"
            placeholder="09121234567"
            value={phone}
            onChange={(event) => setPhone(toLatinDigits(event.target.value))}
            disabled={pending}
          />
          <FieldError>{error}</FieldError>
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Spinner /> : null}
          {pending ? "در حال ارسال…" : "دریافت کد ورود"}
        </Button>

        <p className="text-center text-xs leading-6 text-muted">
          با ورود، شرایط استفاده از سرویس را می‌پذیرید. ثبت‌نام جداگانه لازم نیست؛ اولین ورود
          حساب شما را می‌سازد.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-5" noValidate>
      {notice ? <Alert tone="info">{notice}</Alert> : null}

      <div>
        <Label htmlFor="code">کد {OTP_LENGTH} رقمی ارسال‌شده</Label>
        <Input
          id="code"
          ref={codeInputRef}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          className="text-center text-lg tracking-[0.5em]"
          maxLength={OTP_LENGTH}
          placeholder="- - - - -"
          value={code}
          onChange={(event) =>
            setCode(toLatinDigits(event.target.value).replace(/\D/g, "").slice(0, OTP_LENGTH))
          }
          disabled={pending}
        />
        <FieldError>{error}</FieldError>
        <p className="mt-2 text-xs text-muted">
          کد به شماره <span dir="ltr">{phone}</span> ارسال شد.{" "}
          <button
            type="button"
            className="text-primary underline"
            onClick={() => {
              setStep("phone");
              setError(null);
              setNotice(null);
            }}
          >
            تغییر شماره
          </button>
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Spinner /> : null}
        {pending ? "در حال بررسی…" : "ورود به حساب"}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={pending || resendIn > 0}
        onClick={() => requestCode()}
      >
        {resendIn > 0 ? `ارسال مجدد کد تا ${resendIn} ثانیه دیگر` : "ارسال مجدد کد"}
      </Button>
    </form>
  );
}
