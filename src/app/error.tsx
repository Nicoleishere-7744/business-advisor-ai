"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-lg font-bold">مشکلی پیش آمد</h1>
        <p className="mt-2 text-sm text-muted">
          خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کن؛ اگر تکرار شد با پشتیبانی تماس بگیر.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-muted" dir="ltr">
            کد خطا: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>تلاش دوباره</Button>
          <LinkButton href="/dashboard" variant="secondary">
            بازگشت به داشبورد
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
