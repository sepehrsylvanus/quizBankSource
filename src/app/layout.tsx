import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Header from "@/components/header";

export const metadata: Metadata = {
  title: {
    default: "بانک سؤال | پلتفرم آزمون آنلاین با تصحیح هوش مصنوعی",
    template: "%s | بانک سؤال",
  },
  description:
    "پلتفرم بانک سؤال: آزمون‌های چهارگزینه‌ای، صحیح/غلط و تشریحی با تصحیح خودکار و هوش مصنوعی، پنل مدیریت کامل و سامانهٔ درخواست.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        {/* Vazirmatn Persian font via CDN (graceful fallback when offline) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
        />
      </head>
      <body>
        <Suspense fallback={null}>
          <Header />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
