// قالب‌بندی اعداد، مبالغ و تاریخ‌ها برای نمایش فارسی

const numberFormatter = new Intl.NumberFormat("fa-IR");

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/// مبلغ ریالی را به تومان نمایش می‌دهد (واحد پرداخت زیبال ریال است)
export function formatRialAsToman(rial: number): string {
  return `${numberFormatter.format(Math.round(rial / 10))} تومان`;
}

export function formatRial(rial: number): string {
  return `${numberFormatter.format(rial)} ریال`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

/// هزینه دلاری فراخوانی‌های AI (اعداد بسیار کوچک)
export function formatUsd(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.01) return `$${value.toFixed(5)}`;
  return `$${value.toFixed(3)}`;
}

/// نمایش شماره کارت به صورت ماسک‌شده
export function formatCardNumber(value: string | null | undefined): string {
  if (!value) return "—";
  return value;
}
