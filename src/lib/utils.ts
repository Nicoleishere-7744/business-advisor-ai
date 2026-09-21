import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/// ترکیب کلاس‌های Tailwind با حذف تعارض‌ها
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
