import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// next/font/google 経由の取得がこの開発環境のネットワーク事情で失敗するため、
// フォントファイルを事前ダウンロードしてセルフホストしている。
const mplusRounded = localFont({
  variable: "--font-mplus-rounded",
  src: [
    { path: "./fonts/mplus-rounded-1c-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/mplus-rounded-1c-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/mplus-rounded-1c-700.ttf", weight: "700", style: "normal" },
    { path: "./fonts/mplus-rounded-1c-800.ttf", weight: "800", style: "normal" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "明細ラボ",
  description: "給与・賞与管理アプリ",
  appleWebApp: {
    capable: true,
    title: "明細ラボ",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#33724c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${mplusRounded.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex h-dvh flex-col overflow-hidden">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
