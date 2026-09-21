import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "مشاور کسب‌وکار | مشاوره آنلاین با هوش مصنوعی",
    template: "%s | مشاور کسب‌وکار",
  },
  description:
    "اطلاعات کسب‌وکارت را وارد کن و در چند دقیقه یک گزارش مشاوره اختصاصی و قابل اجرا تحویل بگیر.",
};

export const viewport: Viewport = {
  themeColor: "#1f5fd0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        {/* فونت وزیرمتن از CDN؛ در صورت در دسترس نبودن، فونت سیستم فارسی جایگزین می‌شود */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
        />
        <style
          // متغیر فونت را جدا نگه می‌داریم تا تعویض فونت فقط یک‌جا باشد
          dangerouslySetInnerHTML={{ __html: ":root{--font-vazir:'Vazirmatn';}" }}
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
