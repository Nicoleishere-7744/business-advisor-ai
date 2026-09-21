import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <p className="text-5xl font-bold text-muted">۴۰۴</p>
        <h1 className="mt-4 text-lg font-bold">صفحه‌ای که دنبالش بودی پیدا نشد</h1>
        <p className="mt-2 text-sm text-muted">
          ممکن است آدرس اشتباه باشد یا این محتوا متعلق به حساب دیگری باشد.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <LinkButton href="/dashboard">مشاوره‌های من</LinkButton>
          <LinkButton href="/" variant="secondary">
            صفحه اصلی
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
