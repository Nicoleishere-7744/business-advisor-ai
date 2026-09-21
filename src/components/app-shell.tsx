import Link from "next/link";
import type { CurrentUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";
import { toLocalPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

// پوسته مشترک صفحه‌های کاربر و پنل مدیریت

export type NavItem = { href: string; label: string };

export function AppShell({
  user,
  nav,
  activeHref,
  children,
  brandHref = "/dashboard",
  brandLabel = "مشاور کسب‌وکار",
}: {
  user: CurrentUser;
  nav: NavItem[];
  activeHref?: string;
  children: React.ReactNode;
  brandHref?: string;
  brandLabel?: string;
}) {
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link href={brandHref} className="shrink-0 font-bold">
            {brandLabel}
          </Link>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {nav.map((item) => {
              const active =
                activeHref === item.href ||
                (activeHref?.startsWith(`${item.href}/`) && item.href !== "/admin");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary-soft font-medium text-primary"
                      : "text-muted hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            {user.role === "admin" ? (
              <Link
                href="/admin"
                className="hidden rounded-lg px-2 py-1 text-xs text-muted hover:text-foreground sm:block"
              >
                پنل مدیریت
              </Link>
            ) : null}
            <span dir="ltr" className="hidden text-xs text-muted sm:block">
              {toLocalPhone(user.phone)}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
