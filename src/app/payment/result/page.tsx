import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Alert, Card, LinkButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "نتیجه پرداخت" };

// صفحه واسط بعد از بازگشت از درگاه.
// در حالت موفق کاربر مستقیم به صفحه مشاوره می‌رود و تولید گزارش شروع می‌شود.

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string; consultationId?: string }>;
}) {
  const { state, message, consultationId } = await searchParams;
  const user = await getCurrentUser();

  if (state === "success" && consultationId) {
    redirect(`/consultation/${consultationId}?generate=1`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Card className="text-center">
          <h1 className="text-lg font-bold">پرداخت انجام نشد</h1>
          <Alert tone="danger" className="mt-4 text-right">
            {message ?? "تراکنش شما تکمیل نشد."}
          </Alert>
          <p className="mt-4 text-sm leading-7 text-muted">
            اگر مبلغی از حساب شما کسر شده باشد، طبق قوانین بانکی حداکثر تا ۷۲ ساعت به‌صورت
            خودکار برمی‌گردد.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {consultationId ? (
              <LinkButton href={`/consultation/${consultationId}`}>تلاش دوباره</LinkButton>
            ) : null}
            <LinkButton href={user ? "/dashboard" : "/"} variant="secondary">
              {user ? "بازگشت به داشبورد" : "بازگشت به صفحه اصلی"}
            </LinkButton>
          </div>
        </Card>
      </div>
    </main>
  );
}
