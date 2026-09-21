import type { NavItem } from "@/components/app-shell";

// منوی ناوبری بخش کاربر و پنل مدیریت

export const USER_NAV: NavItem[] = [
  { href: "/dashboard", label: "مشاوره‌های من" },
  { href: "/consultation/new", label: "مشاوره جدید" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "داشبورد" },
  { href: "/admin/consultations", label: "مشاوره‌ها" },
  { href: "/admin/users", label: "کاربران" },
  { href: "/admin/payments", label: "تراکنش‌ها" },
  { href: "/admin/form", label: "فرم‌ساز" },
  { href: "/admin/prompts", label: "پرامپت" },
  { href: "/admin/models", label: "مدل‌های AI" },
  { href: "/admin/usage", label: "مصرف AI" },
  { href: "/admin/discounts", label: "کد تخفیف" },
  { href: "/admin/settings", label: "تنظیمات" },
];
