import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "ورود و عضویت" };

/// فقط مسیرهای داخلی به‌عنوان مقصد بازگشت پذیرفته می‌شوند (جلوگیری از open redirect)
function safeNextPath(value: string | undefined): string {
  if (!value) return "";
  if (!value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);

  if (user) {
    redirect(nextPath || (user.role === "admin" ? "/admin" : "/dashboard"));
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-xl font-bold">
            مشاور کسب‌وکار
          </Link>
          <p className="mt-2 text-sm text-muted">
            برای ورود یا ساخت حساب، شماره موبایلت را وارد کن.
          </p>
        </div>

        <Card>
          <LoginForm nextPath={nextPath} />
        </Card>

        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-muted hover:text-foreground">
            بازگشت به صفحه اصلی
          </Link>
        </p>
      </div>
    </main>
  );
}
