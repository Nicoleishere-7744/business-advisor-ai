import { AppShell } from "@/components/app-shell";
import type { CurrentUser } from "@/lib/auth/session";
import { ADMIN_NAV } from "@/lib/nav";

// پوسته مشترک صفحه‌های پنل مدیریت

export function AdminPage({
  user,
  activeHref,
  children,
}: {
  user: CurrentUser;
  activeHref: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      user={user}
      nav={ADMIN_NAV}
      activeHref={activeHref}
      brandHref="/admin"
      brandLabel="پنل مدیریت"
    >
      {children}
    </AppShell>
  );
}
