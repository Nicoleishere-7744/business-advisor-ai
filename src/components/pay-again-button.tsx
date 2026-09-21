"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input, Label, Spinner } from "@/components/ui";

// شروع (یا تکرار) پرداخت یک مشاوره ثبت‌شده

export function PayAgainButton({ consultationId }: { consultationId: string }) {
  const router = useRouter();
  const [discountCode, setDiscountCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/payments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultationId,
          discountCode: discountCode.trim() || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "شروع پرداخت ناموفق بود.");
        return;
      }

      if (data.free) {
        router.push(data.redirectUrl);
        router.refresh();
        return;
      }

      window.location.href = data.redirectUrl;
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-w-64">
        <Label htmlFor="discount-retry">کد تخفیف (اختیاری)</Label>
        <Input
          id="discount-retry"
          value={discountCode}
          onChange={(event) => setDiscountCode(event.target.value.toUpperCase())}
          disabled={pending}
        />
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button onClick={start} disabled={pending}>
        {pending ? <Spinner /> : null}
        {pending ? "در حال انتقال…" : "پرداخت و دریافت گزارش"}
      </Button>
    </div>
  );
}
