import Link from "next/link";
import { Card, LinkButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { getConsultationPrice } from "@/lib/pricing";
import { getActiveFormFields } from "@/lib/consultation";
import { formatRialAsToman } from "@/lib/format";

// صفحه اصلی عمومی

export default async function HomePage() {
  const [user, price, fields] = await Promise.all([
    getCurrentUser(),
    getConsultationPrice(),
    getActiveFormFields(),
  ]);

  const steps = [
    {
      title: "اطلاعات کسب‌وکارت را وارد کن",
      body: `یک فرم ${fields.length} بخشی درباره بازار، درآمد، رقبا و چالش اصلی کسب‌وکارت.`,
    },
    {
      title: "هزینه مشاوره را پرداخت کن",
      body: "پرداخت امن از طریق درگاه زیبال؛ بدون اشتراک و بدون تمدید خودکار.",
    },
    {
      title: "گزارش اختصاصی‌ات را بگیر",
      body: "تحلیل وضعیت، اولویت‌های اجرایی و برنامه ۳۰/۶۰/۹۰ روزه — به‌علاوه امکان پرسش پیگیری.",
    },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <span className="font-bold">مشاور کسب‌وکار</span>
          {user ? (
            <LinkButton href={user.role === "admin" ? "/admin" : "/dashboard"} size="sm">
              ورود به حساب
            </LinkButton>
          ) : (
            <LinkButton href="/login" size="sm">
              ورود / عضویت
            </LinkButton>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 text-center sm:py-24">
          <h1 className="text-3xl font-bold leading-relaxed sm:text-4xl sm:leading-relaxed">
            مشاوره کسب‌وکار اختصاصی،
            <br />
            در کمتر از پنج دقیقه
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-muted sm:text-lg">
            اطلاعات واقعی کسب‌وکارت را وارد کن و یک گزارش تحلیلی و قابل اجرا تحویل بگیر — نه
            توصیه‌های کلی و تکراری.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <LinkButton href={user ? "/consultation/new" : "/login?next=%2Fconsultation%2Fnew"}>
              شروع مشاوره
            </LinkButton>
            <span className="text-sm text-muted">
              هزینه هر مشاوره: <strong className="text-foreground">{formatRialAsToman(price)}</strong>
            </span>
          </div>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-3">
          {steps.map((step, index) => (
            <Card key={step.title}>
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary-soft text-sm font-bold text-primary">
                {index + 1}
              </span>
              <h2 className="mt-4 font-bold">{step.title}</h2>
              <p className="mt-2 text-sm leading-7 text-muted">{step.body}</p>
            </Card>
          ))}
        </section>

        <section className="pb-20">
          <Card className="text-center">
            <h2 className="text-lg font-bold">در گزارش چه چیزی می‌گیری؟</h2>
            <ul className="mx-auto mt-5 grid max-w-2xl gap-2.5 text-sm text-muted sm:grid-cols-2">
              {[
                "خلاصه وضعیت فعلی کسب‌وکار",
                "تحلیل بازار و رقبا",
                "نقاط قوت و ضعف",
                "فرصت‌ها و تهدیدها",
                "پیشنهادهای اجرایی اولویت‌بندی‌شده",
                "برنامه ۳۰ / ۶۰ / ۹۰ روزه",
                "شاخص‌های کلیدی برای پیگیری",
                "امکان پرسیدن سوال پیگیری",
              ].map((item) => (
                <li key={item} className="rounded-lg bg-surface-muted px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted">
        <Link href="/login" className="hover:text-foreground">
          ورود به حساب کاربری
        </Link>
      </footer>
    </div>
  );
}
